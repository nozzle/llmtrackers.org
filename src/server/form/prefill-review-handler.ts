import { getAllCompanies } from "~/data";
import { jsonResponse } from "./http";
import { fetchPageText } from "../update/scraper";
import { extractReviewPrefillWithLlm } from "./review-prefill";
import type { AppEnv } from "../types";

export interface PrefillReviewPayload {
  url: string;
}

export function validatePrefillReviewPayload(
  payload: unknown,
): { ok: true; value: PrefillReviewPayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Request body must be an object" };
  }

  const raw = payload as Record<string, unknown>;
  if (typeof raw.url !== "string" || raw.url.trim().length === 0) {
    return { ok: false, error: "url is required" };
  }

  try {
    const parsed = new URL(raw.url.trim());
    if (!parsed.protocol.startsWith("http")) {
      return { ok: false, error: "url must be an http(s) URL" };
    }
  } catch {
    return { ok: false, error: "url must be a valid URL" };
  }

  return { ok: true, value: { url: raw.url.trim() } };
}

export async function handlePrefillReview(
  payload: PrefillReviewPayload,
  env: AppEnv,
): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: "Review import is not configured" }, 503);
  }

  const pageText = await fetchPageText(payload.url);
  if (!pageText) {
    return jsonResponse(
      {
        error:
          "We couldn't fetch or read that article automatically. You can continue manually or try another URL.",
      },
      422,
    );
  }

  const companies = getAllCompanies();
  const draft = await extractReviewPrefillWithLlm(
    env.OPENAI_API_KEY,
    payload.url,
    pageText,
    companies,
  );

  return jsonResponse({ success: true, draft }, 200);
}
