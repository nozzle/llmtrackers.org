import { ghFetch } from "./fetch.js";

export interface GitHubFileContent {
  content: string; // base64 encoded
  sha: string;
}

/**
 * Get a file's content and SHA from a repo.
 */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GitHubFileContent | null> {
  const url = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
  if (ref) url.searchParams.set("ref", ref);

  const res = await ghFetch(url.toString(), {
    headers: { Authorization: `token ${token}` },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`getFileContent failed: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<GitHubFileContent>;
}

/**
 * Get the SHA of the default branch HEAD.
 */
export async function getDefaultBranchSha(
  token: string,
  owner: string,
  repo: string,
): Promise<{ branch: string; sha: string }> {
  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) throw new Error(`getRepo failed: ${res.status}`);

  const data = (await res.json()) as { default_branch: string };
  const branch = data.default_branch;

  const refRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    { headers: { Authorization: `token ${token}` } },
  );
  if (!refRes.ok) throw new Error(`getRef failed: ${refRes.status}`);

  const refData = (await refRes.json()) as { object: { sha: string } };
  return { branch, sha: refData.object.sha };
}

/**
 * Create a new branch from a given SHA.
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  branchName: string,
  fromSha: string,
): Promise<void> {
  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: fromSha,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    // 422 = branch already exists, that's ok
    if (res.status !== 422) {
      throw new Error(`createBranch failed: ${res.status} ${body}`);
    }
  }
}

/**
 * Create or update a file on a branch.
 */
export async function upsertFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  existingSha?: string,
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: btoa(content),
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const res = await ghFetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { Authorization: `token ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`upsertFile failed: ${res.status} ${await res.text()}`);
  }
}
