/**
 * GitHub App authentication and API helpers for the update checker.
 *
 * The private key must be in PKCS#8 PEM format.
 */

// ---- Auth ----

export async function createAppJwt(
  appId: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = { iat: now - 60, exp: now + 600, iss: appId };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await sign(key, signingInput);
  return `${signingInput}.${signature}`;
}

export async function getInstallationToken(
  jwt: string,
  installationId: string
): Promise<string> {
  const res = await ghFetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    { method: "POST", headers: { Authorization: `Bearer ${jwt}` } }
  );
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ---- Repository file operations ----

interface GitHubFileContent {
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
  ref?: string
): Promise<GitHubFileContent | null> {
  const url = new URL(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
  );
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
  repo: string
): Promise<{ branch: string; sha: string }> {
  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers: { Authorization: `token ${token}` } }
  );
  if (!res.ok) throw new Error(`getRepo failed: ${res.status}`);

  const data = (await res.json()) as { default_branch: string };
  const branch = data.default_branch;

  const refRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    { headers: { Authorization: `token ${token}` } }
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
  fromSha: string
): Promise<void> {
  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      headers: { Authorization: `token ${token}` },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
    }
  );
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
  existingSha?: string
): Promise<void> {
  const body: Record<string, string> = {
    message,
    content: btoa(content),
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: { Authorization: `token ${token}` },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(`upsertFile failed: ${res.status} ${await res.text()}`);
  }
}

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
  base: string
): Promise<{ html_url: string; number: number }> {
  const res = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: "POST",
      headers: { Authorization: `token ${token}` },
      body: JSON.stringify({ title, body, head, base }),
    }
  );
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`createPR failed: ${res.status} ${errorBody}`);
  }
  return res.json() as Promise<{ html_url: string; number: number }>;
}

// ---- Helpers ----

async function ghFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/vnd.github+json");
  }
  headers.set("User-Agent", "llm-tracker-update-checker");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return arrayBufferToBase64Url(bytes.buffer as ArrayBuffer);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(key: CryptoKey, data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoded);
  return arrayBufferToBase64Url(sig);
}
