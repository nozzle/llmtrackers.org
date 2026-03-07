/**
 * GitHub App authentication for Cloudflare Workers.
 *
 * Flow:
 * 1. Create a JWT signed with the App's private key
 * 2. Exchange the JWT for an installation access token
 * 3. Use the installation token to call the GitHub API
 *
 * The private key must be in PKCS#8 PEM format. If you have a PKCS#1 key
 * (starts with "BEGIN RSA PRIVATE KEY"), convert it:
 *   openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem -out key-pkcs8.pem
 */

import { ghFetch } from "./fetch.js";

/**
 * Create a JWT for GitHub App authentication.
 * Valid for 10 minutes (GitHub's maximum).
 */
export async function createAppJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60, // 60 seconds in the past to allow for clock drift
    exp: now + 600, // 10 minutes
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await signData(key, signingInput);

  return `${signingInput}.${signature}`;
}

/**
 * Get an installation access token for the GitHub App.
 */
export async function getInstallationToken(jwt: string, installationId: string): Promise<string> {
  const res = await ghFetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    { method: "POST", headers: { Authorization: `Bearer ${jwt}` } },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get installation token: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

// ---- Crypto helpers (Web Crypto API, compatible with CF Workers) ----

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return arrayBufferToBase64Url(bytes.buffer);
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
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
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function signData(key: CryptoKey, data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoded);
  return arrayBufferToBase64Url(signature);
}
