import { jsonResponse, verifyTurnstileOrRespond } from "./http";
import type { AppEnv } from "../types";

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

type MutationResult =
  | { success: true; prUrl: string; prNumber: number }
  | { success: false; error: string; status: number };

interface MutationOptions<T> {
  body: unknown;
  request: Request;
  env: AppEnv;
  validate: (body: unknown) => ValidationResult<T>;
  execute: (payload: T, env: AppEnv) => Promise<MutationResult>;
  logLabel: string;
}

export async function handlePrMutation<T>({
  body,
  request,
  env,
  validate,
  execute,
  logLabel,
}: MutationOptions<T>): Promise<Response> {
  const validation = validate(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const payload = validation.value as T & { turnstileToken?: string };
  const turnstileError = await verifyTurnstileOrRespond(request, env, payload.turnstileToken);
  if (turnstileError) return turnstileError;

  try {
    const result = await execute(validation.value, env);
    if (!result.success) {
      return jsonResponse({ error: result.error }, result.status);
    }

    return jsonResponse(
      {
        success: true,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
      },
      201,
    );
  } catch (err) {
    console.error(`GitHub API error (${logLabel}):`, err);
    return jsonResponse({ error: "Failed to create GitHub PR. Please try again later." }, 502);
  }
}
