import { ghFetch } from "./fetch.js";

/**
 * Create a pull request.
 */
export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<{ html_url: string; number: number }> {
  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({ title, body, head, base }),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`createPR failed: ${res.status} ${errorBody}`);
  }
  return res.json() as Promise<{ html_url: string; number: number }>;
}

/**
 * Find an open pull request by head branch name.
 */
export async function findOpenPullRequestByHead(
  token: string,
  owner: string,
  repo: string,
  head: string,
): Promise<{ html_url: string; number: number } | null> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
  url.searchParams.set("state", "open");
  url.searchParams.set("head", `${owner}:${head}`);

  const res = await ghFetch(url.toString(), {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) {
    throw new Error(`findOpenPullRequestByHead failed: ${res.status} ${await res.text()}`);
  }

  const pulls = (await res.json()) as {
    html_url: string;
    number: number;
  }[];
  return pulls[0] ?? null;
}
