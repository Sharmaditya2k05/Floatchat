"""Retrieval over the schema docs.

Default backend is a dependency-free TF-IDF cosine retriever so the whole
demo runs offline with no model downloads. Set EMBED_BACKEND=sentence-transformers
(and install that package) to switch to dense MiniLM embeddings.
"""
from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from pathlib import Path

INDEX_PATH = Path(__file__).parent / "index.json"

_TOKEN_RE = re.compile(r"[a-z0-9_ऀ-ॿ஀-௿]+")


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class TfidfIndex:
    def __init__(self, docs: list[dict], idf: dict[str, float]):
        self.docs = docs
        self.idf = idf
        self.vectors = [self._vec(d["text"]) for d in docs]

    def _vec(self, text: str) -> dict[str, float]:
        tf = Counter(tokenize(text))
        v = {t: (1 + math.log(c)) * self.idf.get(t, 0.0) for t, c in tf.items()}
        norm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / norm for t, x in v.items()}

    @classmethod
    def build(cls, docs: list[dict]) -> "TfidfIndex":
        n = len(docs)
        df: Counter = Counter()
        for d in docs:
            df.update(set(tokenize(d["text"])))
        idf = {t: math.log((1 + n) / (1 + c)) + 1 for t, c in df.items()}
        return cls(docs, idf)

    def save(self, path: Path = INDEX_PATH) -> None:
        path.write_text(json.dumps({"docs": self.docs, "idf": self.idf}), encoding="utf-8")

    @classmethod
    def load(cls, path: Path = INDEX_PATH) -> "TfidfIndex":
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(data["docs"], data["idf"])

    def search(self, query: str, k: int = 6) -> list[dict]:
        q = self._vec(query)
        scored = []
        for doc, v in zip(self.docs, self.vectors):
            score = sum(w * v.get(t, 0.0) for t, w in q.items())
            scored.append((score, doc))
        scored.sort(key=lambda x: -x[0])
        return [d for s, d in scored[:k]]


def get_retriever():
    """Return an object with .search(query, k) -> list[doc]."""
    backend = os.getenv("EMBED_BACKEND", "tfidf")
    if backend == "sentence-transformers":
        try:
            return _DenseIndex()
        except Exception:
            pass  # fall back to lexical
    if INDEX_PATH.exists():
        return TfidfIndex.load()
    from rag.schema_docs import all_docs

    return TfidfIndex.build(all_docs())


class _DenseIndex:
    def __init__(self):
        from sentence_transformers import SentenceTransformer
        from rag.schema_docs import all_docs

        self.model = SentenceTransformer(os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2"))
        self.docs = all_docs()
        self.emb = self.model.encode([d["text"] for d in self.docs], normalize_embeddings=True)

    def search(self, query: str, k: int = 6) -> list[dict]:
        q = self.model.encode([query], normalize_embeddings=True)[0]
        scores = self.emb @ q
        order = scores.argsort()[::-1][:k]
        return [self.docs[i] for i in order]
