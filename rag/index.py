"""Build and persist the RAG index over schema docs.

Usage: python -m rag.index
"""
from rag.retriever import TfidfIndex, INDEX_PATH
from rag.schema_docs import all_docs


def main() -> None:
    docs = all_docs()
    idx = TfidfIndex.build(docs)
    idx.save()
    print(f"indexed {len(docs)} docs -> {INDEX_PATH}")


if __name__ == "__main__":
    main()
