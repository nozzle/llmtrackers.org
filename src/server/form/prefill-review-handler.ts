import { getAllCompanies } from "~/data";
import { jsonResponse } from "./http";
import { extractReviewPrefillWithLlm } from "./review-prefill";
import { extractPageContent } from "../browser/extract-page";
import type { AppEnv } from "../types";

interface YouTubeImportSource {
  pageText: string;
  title: string;
  authorName: string;
  authorUrl?: string;
  publishedDate: string | null;
  warnings: string[];
  primaryCompanySlug?: string;
  media: {
    provider: "youtube";
    videoId: string;
    watchUrl: string;
    thumbnailUrl: string;
    title: string;
    creator: string;
    creatorUrl?: string;
    durationSeconds?: number;
  };
}

function getYouTubeVideoId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.split("/").find(Boolean) ?? null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex(
        (part) => part === "embed" || part === "shorts" || part === "live",
      );
      if (embedIndex >= 0) return parts[embedIndex + 1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

function isYouTubeUrl(rawUrl: string): boolean {
  return getYouTubeVideoId(rawUrl) !== null;
}

function decodeJsonString(value: string): string {
  return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`) as string;
}

function extractJsonStringField(html: string, key: string): string | null {
  const match = new RegExp(`"${key}":"((?:\\\\.|[^"\\])*)"`).exec(html);
  if (!match?.[1]) return null;
  try {
    return decodeJsonString(match[1]);
  } catch {
    return null;
  }
}

function extractUploadDate(html: string): string | null {
  const directMatch = /"uploadDate":"(\d{4}-\d{2}-\d{2})"/.exec(html);
  if (directMatch?.[1]) return directMatch[1];
  return null;
}

function extractDurationSeconds(html: string): number | undefined {
  const match = /"lengthSeconds":"(\d+)"/.exec(html);
  if (!match?.[1]) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function extractCaptionBaseUrl(html: string): string | null {
  const captionSection = /"captionTracks":\[(.*?)\]/s.exec(html)?.[1];
  if (!captionSection) return null;
  const baseUrlMatch = /"baseUrl":"((?:\\.|[^"\\])*)"/.exec(captionSection);
  if (!baseUrlMatch?.[1]) return null;
  try {
    return decodeJsonString(baseUrlMatch[1]);
  } catch {
    return null;
  }
}

function transcriptFromJson3(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const events = Array.isArray((data as { events?: unknown }).events)
    ? ((data as { events?: { segs?: { utf8?: string }[] }[] }).events ?? [])
    : [];

  const lines = events
    .map((event) =>
      Array.isArray(event.segs)
        ? event.segs
            .map((segment) => (typeof segment.utf8 === "string" ? segment.utf8 : ""))
            .join("")
        : "",
    )
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0 && line !== "[Music]");

  return lines.join("\n");
}

async function fetchYouTubeImportSource(url: string): Promise<YouTubeImportSource> {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

  const [oembedResponse, watchResponse] = await Promise.all([
    fetch(oembedUrl),
    fetch(watchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    }),
  ]);

  if (!oembedResponse.ok) {
    throw new Error(`Failed to fetch YouTube metadata (${oembedResponse.status})`);
  }
  if (!watchResponse.ok) {
    throw new Error(`Failed to fetch YouTube watch page (${watchResponse.status})`);
  }

  const oembed: {
    title?: string;
    author_name?: string;
    author_url?: string;
    thumbnail_url?: string;
  } = await oembedResponse.json();
  const html = await watchResponse.text();

  const description = extractJsonStringField(html, "shortDescription") ?? "";
  const publishedDate = extractUploadDate(html);
  const creatorUrl = extractJsonStringField(html, "ownerProfileUrl") ?? oembed.author_url;
  const durationSeconds = extractDurationSeconds(html);
  const warnings: string[] = [];

  let transcript = "";
  const captionBaseUrl = extractCaptionBaseUrl(html);
  if (captionBaseUrl) {
    try {
      const separator = captionBaseUrl.includes("?") ? "&" : "?";
      const transcriptResponse = await fetch(`${captionBaseUrl}${separator}fmt=json3`);
      if (transcriptResponse.ok) {
        transcript = transcriptFromJson3(await transcriptResponse.json());
      }
    } catch {
      warnings.push("YouTube transcript fetch failed; used the video description instead.");
    }
  }

  if (!transcript) {
    warnings.push("No YouTube transcript was available; used the video description instead.");
  }

  const companyList = getAllCompanies();
  const primaryCompanySlug =
    companyList.find((company) => {
      const name = company.name.toLowerCase();
      const title = (oembed.title ?? "").toLowerCase();
      return title.includes(name) || title.includes(company.slug.replace(/-/g, " "));
    })?.slug ?? undefined;

  const pageText = [
    `Video title: ${oembed.title ?? ""}`,
    `Creator: ${oembed.author_name ?? ""}`,
    publishedDate ? `Published date: ${publishedDate}` : "",
    description ? `Description:\n${description}` : "",
    transcript ? `Transcript:\n${transcript.slice(0, 50000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    pageText,
    title: oembed.title ?? "",
    authorName: oembed.author_name ?? "",
    authorUrl: creatorUrl,
    publishedDate,
    warnings,
    primaryCompanySlug,
    media: {
      provider: "youtube",
      videoId,
      watchUrl,
      thumbnailUrl: oembed.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      title: oembed.title ?? "",
      creator: oembed.author_name ?? "",
      ...(creatorUrl ? { creatorUrl } : {}),
      ...(durationSeconds ? { durationSeconds } : {}),
    },
  };
}

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

  const isYouTube = isYouTubeUrl(payload.url);

  if (isYouTube) {
    try {
      const companies = getAllCompanies();
      const extracted = await fetchYouTubeImportSource(payload.url);
      const sourceText = payload.pastedText
        ? `${extracted.pageText}\n\nPasted transcript or notes:\n${payload.pastedText}`
        : extracted.pageText;
      const draft = await extractReviewPrefillWithLlm(
        env.OPENAI_API_KEY,
        payload.url,
        sourceText,
        companies,
        {
          reviewType: "video",
          media: extracted.media,
          suggestedDate: extracted.publishedDate,
          suggestedTitle: extracted.title,
          suggestedAuthorName: extracted.authorName,
          suggestedAuthorProfiles: extracted.authorUrl
            ? [{ label: "YouTube", url: extracted.authorUrl }]
            : [],
          suggestedPrimaryCompanySlug: extracted.primaryCompanySlug,
        },
      );

      draft.warnings = [
        ...extracted.warnings,
        ...(payload.pastedText ? ["Merged pasted transcript or notes with YouTube metadata."] : []),
        ...draft.warnings,
      ];

      return jsonResponse({ success: true, draft }, 200);
    } catch (error) {
      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "We couldn't extract that YouTube video automatically.",
        },
        422,
      );
    }
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
