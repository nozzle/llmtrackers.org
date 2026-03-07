/**
 * Lightweight fetch wrapper for GitHub API calls.
 * Sets standard headers (Accept, User-Agent, API version, Content-Type).
 */

export interface GhFetchOptions extends RequestInit {
  userAgent?: string;
}

export async function ghFetch(url: string, init: GhFetchOptions = {}): Promise<Response> {
  const { userAgent = "llm-tracker", ...fetchInit } = init;
  const headers = new Headers(fetchInit.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/vnd.github+json");
  }
  headers.set("User-Agent", userAgent);
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (fetchInit.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...fetchInit, headers });
}
