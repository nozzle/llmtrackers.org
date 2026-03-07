import { ghFetch } from "./fetch.js";

/**
 * Create a GitHub issue using an installation token.
 */
export async function createGitHubIssue(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[],
): Promise<{ html_url: string; number: number }> {
  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to create issue: ${res.status} ${errorBody}`);
  }

  return res.json() as Promise<{ html_url: string; number: number }>;
}
