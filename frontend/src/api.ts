import type { ChatResponse } from "./types";

export async function askQuestion(
  question: string,
  lang?: string
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, lang: lang || undefined }),
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((j) => j.detail)
      .catch(() => res.statusText);
    throw new Error(typeof detail === "string" ? detail : res.statusText);
  }
  return res.json();
}
