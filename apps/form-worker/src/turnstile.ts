interface TurnstileVerificationResponse {
  success: boolean;
  "error-codes"?: string[];
}

export function turnstileEnabled(
  siteKey: string | undefined,
  secretKey: string | undefined
): boolean {
  return Boolean(siteKey && secretKey);
}

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!token) {
    return { ok: false, error: "Missing Turnstile token" };
  }

  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    return {
      ok: false,
      error: `Turnstile verification failed: ${response.status}`,
    };
  }

  const result = (await response.json()) as TurnstileVerificationResponse;
  if (!result.success) {
    return {
      ok: false,
      error: `Turnstile verification failed${result["error-codes"]?.length ? ` (${result["error-codes"].join(", ")})` : ""}`,
    };
  }

  return { ok: true };
}
