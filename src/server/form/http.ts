import { turnstileEnabled, verifyTurnstileToken } from "./turnstile";
import type { AppEnv } from "../types";

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const submissionLog = new Map<string, number[]>();

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

export function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("Content-Type") ?? "";
  return contentType.includes("application/json");
}

export function requestBodyTooLarge(request: Request): boolean {
  const contentLength = request.headers.get("Content-Length");
  if (!contentLength) {
    return false;
  }

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_BODY_BYTES;
}

export function getClientIdentifier(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function isRateLimited(clientId: string, now: number = Date.now()): boolean {
  const recent = (submissionLog.get(clientId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    submissionLog.set(clientId, recent);
    return true;
  }

  recent.push(now);
  submissionLog.set(clientId, recent);
  return false;
}

export async function parseJsonBody(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false, response: jsonResponse({ error: "Invalid JSON body" }, 400) };
  }
}

export async function verifyTurnstileOrRespond(
  request: Request,
  env: AppEnv,
  token?: string
): Promise<Response | null> {
  if (!turnstileEnabled(env.TURNSTILE_SITE_KEY, env.TURNSTILE_SECRET_KEY)) {
    return null;
  }

  const verification = await verifyTurnstileToken(
    token ?? "",
    env.TURNSTILE_SECRET_KEY as string,
    getClientIdentifier(request)
  );
  if (!verification.ok) {
    return jsonResponse({ error: verification.error }, 403);
  }

  return null;
}
