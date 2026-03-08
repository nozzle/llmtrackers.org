import { getAllCompanies } from "~/data";
import { jsonResponse } from "./http";
import { extractReviewPrefillWithLlm } from "./review-prefill";
import { extractPageContent } from "../browser/extract-page";
import type { AppEnv } from "../types";

export interface PrefillReviewPayload {
  url: string;
  pastedText?: string;
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
  if (raw.pastedText !== undefined && typeof raw.pastedText !== "string") {
    return { ok: false, error: "pastedText must be a string" };
  }

  try {
    const parsed = new URL(raw.url.trim());
    if (!parsed.protocol.startsWith("http")) {
      return { ok: false, error: "url must be an http(s) URL" };
    }
  } catch {
    return { ok: false, error: "url must be a valid URL" };
  }

  return {
    ok: true,
    value: {
      url: raw.url.trim(),
      pastedText: typeof raw.pastedText === "string" ? raw.pastedText.trim() : undefined,
    },
  };
}

export async function handlePrefillReview(
  payload: PrefillReviewPayload,
  env: AppEnv,
): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return jsonResponse({ error: "Review import is not configured" }, 503);
  }

  const extracted = payload.pastedText
    ? {
        finalUrl: payload.url,
        title: "",
        byline: null,
        publishedDate: null,
        text: payload.pastedText,
        html: "",
        warnings: ["Used pasted article text instead of browser extraction."],
        challengeDetected: false,
      }
    : await extractPageContent(payload.url, env);

  const pageText = extracted?.text ?? null;
  if (!pageText) {
    return jsonResponse(
      {
        error:
          "We couldn't extract that article automatically. You can paste the article text or continue manually.",
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

  if (extracted?.warnings.length) {
    draft.warnings = [...extracted.warnings, ...draft.warnings];
  }

  if (!draft.review.date && extracted?.publishedDate) {
    draft.review.date = extracted.publishedDate;
  }

  if (!draft.review.name && extracted?.title) {
    draft.review.name = extracted.title;
  }

  if (!draft.review.author.name && extracted?.byline) {
    draft.review.author.name = extracted.byline;
  }

  return jsonResponse({ success: true, draft }, 200);
}
