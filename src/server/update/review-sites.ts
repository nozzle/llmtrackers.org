import {
  REVIEW_SITE_LABELS,
  REVIEW_SITE_PLATFORMS,
  ReviewSiteDataSchema,
  type ReviewSiteBucket,
  type ReviewSiteData,
  type ReviewSitePlatform,
  type ReviewSiteSnippet,
  type ReviewSites,
} from "@llm-tracker/shared";
import { extractPageContent } from "../browser/extract-page";
import type { AppEnv } from "../types";

export interface ReviewSiteFieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface ReviewSiteDiff {
  platform: ReviewSitePlatform;
  changes: ReviewSiteFieldChange[];
}

export interface ReviewSiteCollectionWarning {
  platform: ReviewSitePlatform;
  url: string;
  message: string;
}

export interface ReviewSiteCollectionResult {
  collected: Partial<ReviewSites>;
  warnings: ReviewSiteCollectionWarning[];
}

type Parser = (url: string, html: string) => ReviewSiteData | null;

const PARSERS: Record<ReviewSitePlatform, Parser> = {
  g2: parseGenericReviewSite,
  trustpilot: parseTrustpilotReviewSite,
  trustradius: parseTrustRadiusReviewSite,
  capterra: parseGenericReviewSite,
};

export async function collectReviewSites(
  reviewSites: ReviewSites,
  env?: AppEnv,
): Promise<ReviewSiteCollectionResult> {
  const collected: Partial<ReviewSites> = {};
  const warnings: ReviewSiteCollectionWarning[] = [];

  for (const platform of REVIEW_SITE_PLATFORMS) {
    const site = reviewSites[platform];
    if (!site?.url) continue;

    const extracted = await extractPageContent(site.url, env);
    if (!extracted?.html) continue;

    if (extracted.challengeDetected) {
      warnings.push({
        platform,
        url: site.url,
        message: "challenge page detected",
      });
    }

    const parsed = PARSERS[platform](site.url, extracted.html);
    if (!parsed) continue;

    const result = ReviewSiteDataSchema.safeParse(parsed);
    if (result.success) {
      collected[platform] = result.data;
    }
  }

  return { collected, warnings };
}

export function parseTrustpilotReviewSite(url: string, html: string): ReviewSiteData | null {
  const aggregate = extractAggregateFromJsonLd(html);
  if (!aggregate) return null;

  const reviewCount = aggregate.reviewCount;
  const reviews = extractTrustpilotReviewsFromJsonLd(html).slice(0, 3);
  const ratingDistribution =
    reviewCount != null ? extractTrustpilotDistribution(html, reviewCount) : [];

  return compactReviewSiteData({
    url,
    score: aggregate.score,
    maxScore: aggregate.maxScore,
    reviewCount,
    ratingDistribution,
    reviews,
  });
}

export function parseTrustRadiusReviewSite(url: string, html: string): ReviewSiteData | null {
  const aggregate = extractAggregateFromJsonLd(html);
  const nextData = extractNextData(html);
  const pageProps = asRecord(asRecord(asRecord(nextData).props).pageProps);
  const product = asRecord(pageProps.product);
  const productCounts = asRecord(product.counts);
  const productRating = asRecord(product.rating);

  const reviewCount = toNumber(productCounts.publishedReviews) ?? toNumber(aggregate?.reviewCount);

  const score = toNumber(productRating.trScore) ?? toNumber(aggregate?.score);

  const maxScore = toNumber(aggregate?.maxScore) ?? 10;

  const ratingDistribution = extractTrustRadiusDistribution(pageProps);
  const reviews = extractTrustRadiusReviews(url, pageProps).slice(0, 3);
  const distributionCount = ratingDistribution.reduce((sum, bucket) => sum + bucket.count, 0);
  const normalizedReviewCount = reviewCount ?? (distributionCount > 0 ? distributionCount : null);
  const normalizedScore = normalizedReviewCount && normalizedReviewCount > 0 ? score : null;

  if (
    normalizedScore == null &&
    normalizedReviewCount == null &&
    ratingDistribution.length === 0 &&
    reviews.length === 0
  ) {
    return null;
  }

  return compactReviewSiteData({
    url,
    score: normalizedScore,
    maxScore,
    reviewCount: normalizedReviewCount,
    ratingDistribution,
    reviews,
  });
}

export function parseGenericReviewSite(url: string, html: string): ReviewSiteData | null {
  const aggregate = extractAggregateFromJsonLd(html);
  const reviews = extractReviewsFromJsonLd(html).slice(0, 3);

  if (!aggregate && reviews.length === 0) return null;

  return compactReviewSiteData({
    url,
    score: aggregate?.score ?? null,
    maxScore: aggregate?.maxScore ?? 5,
    reviewCount: aggregate?.reviewCount ?? null,
    ratingDistribution: [],
    reviews,
  });
}

export function diffReviewSites(
  existing: ReviewSites,
  next: Partial<ReviewSites>,
): ReviewSiteDiff[] {
  const diffs: ReviewSiteDiff[] = [];

  for (const platform of REVIEW_SITE_PLATFORMS) {
    const current = existing[platform];
    const candidate = next[platform];
    if (!candidate) continue;

    if (!current) {
      diffs.push({
        platform,
        changes: [
          {
            field: "(new data)",
            oldValue: "not present",
            newValue: summarizeReviewSite(candidate),
          },
        ],
      });
      continue;
    }

    const changes: ReviewSiteFieldChange[] = [];

    if (hasMeaningfulScoreChange(current.score, candidate.score)) {
      changes.push({
        field: "score",
        oldValue: formatNullableNumber(current.score),
        newValue: formatNullableNumber(candidate.score),
      });
    }

    if (hasMeaningfulCountChange(current.reviewCount, candidate.reviewCount)) {
      changes.push({
        field: "reviewCount",
        oldValue: formatNullableInteger(current.reviewCount),
        newValue: formatNullableInteger(candidate.reviewCount),
      });
    }

    if (current.maxScore !== candidate.maxScore) {
      changes.push({
        field: "maxScore",
        oldValue: String(current.maxScore),
        newValue: String(candidate.maxScore),
      });
    }

    if (hasMeaningfulDistributionChange(current.ratingDistribution, candidate.ratingDistribution)) {
      changes.push({
        field: "ratingDistribution",
        oldValue: summarizeDistribution(current.ratingDistribution),
        newValue: summarizeDistribution(candidate.ratingDistribution),
      });
    }

    if (hasMeaningfulReviewSnippetChange(current.reviews, candidate.reviews)) {
      changes.push({
        field: "reviews",
        oldValue: summarizeReviews(current.reviews),
        newValue: summarizeReviews(candidate.reviews),
      });
    }

    if (changes.length > 0) {
      diffs.push({ platform, changes });
    }
  }

  return diffs;
}

export function formatReviewSiteDiffMarkdown(diffs: ReviewSiteDiff[]): string {
  const lines: string[] = ["## Review Site Changes", ""];

  for (const diff of diffs) {
    lines.push(`### ${REVIEW_SITE_LABELS[diff.platform]}`);
    lines.push("");
    lines.push("| Field | Old | New |");
    lines.push("|-------|-----|-----|");
    for (const change of diff.changes) {
      lines.push(`| ${change.field} | ${change.oldValue} | ${change.newValue} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function compactReviewSiteData(data: ReviewSiteData): ReviewSiteData {
  return {
    url: data.url,
    score: data.score ?? null,
    maxScore: data.maxScore,
    reviewCount: data.reviewCount ?? null,
    ratingDistribution: data.ratingDistribution,
    reviews: data.reviews.map((review) => ({
      author: review.author ?? null,
      title: review.title ?? null,
      rating: review.rating ?? null,
      date: review.date ?? null,
      excerpt: review.excerpt.trim(),
      url: review.url ?? null,
    })),
  };
}

function summarizeReviews(reviews: ReviewSiteSnippet[]): string {
  if (reviews.length === 0) return "none";

  return reviews
    .slice(0, 3)
    .map((review) => {
      const author = review.author ?? "unknown";
      const title = review.title ?? "untitled";
      const excerpt = review.excerpt.trim().slice(0, 80);
      return `${author}: ${title} - ${excerpt}`;
    })
    .join(" | ");
}

function hasMeaningfulReviewSnippetChange(
  current: ReviewSiteSnippet[],
  candidate: ReviewSiteSnippet[],
): boolean {
  return summarizeReviews(current) !== summarizeReviews(candidate);
}

function extractTrustpilotDistribution(html: string, reviewCount: number): ReviewSiteBucket[] {
  const buckets: ReviewSiteBucket[] = [];
  const regex = /data-star-rating="(five|four|three|two|one)"[\s\S]*?style="width:([0-9.]+)%"/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const value = wordToNumber(match[1]);
    const percent = Number(match[2]);
    if (!Number.isFinite(value) || !Number.isFinite(percent)) continue;

    buckets.push({
      label: `${value}-star`,
      value,
      count: Math.round((reviewCount * percent) / 100),
    });
  }

  return buckets;
}

function extractTrustpilotReviewsFromJsonLd(html: string): ReviewSiteSnippet[] {
  return extractReviewsFromJsonLd(html).map((review) => ({
    ...review,
    url: null,
  }));
}

function extractTrustRadiusDistribution(pageProps: unknown): ReviewSiteBucket[] {
  const pagePropsRecord = asRecord(pageProps);
  const filteredReviews = asRecord(pagePropsRecord.productPageFilteredReviews);
  const searchData = asRecord(filteredReviews.searchData);
  const filters = asArray(searchData.userFilters);

  for (const filter of filters) {
    const buckets = asArray(asRecord(filter).buckets);
    const normalized = buckets
      .map((bucket) => {
        const bucketRecord = asRecord(bucket);
        const value = toNumber(bucketRecord.key);
        const count =
          toNumber(bucketRecord.filtered_count) ?? toNumber(bucketRecord.unfiltered_count);
        if (value == null || count == null) return null;
        return {
          label: `${value}`,
          value,
          count,
        } satisfies ReviewSiteBucket;
      })
      .filter((bucket): bucket is ReviewSiteBucket => bucket !== null);

    const looksLikeRatingBuckets =
      normalized.length >= 5 &&
      normalized.every((bucket) => bucket.value >= 1 && bucket.value <= 5);

    if (looksLikeRatingBuckets) {
      const total = normalized.reduce((sum, bucket) => sum + bucket.count, 0);
      if (total === 0) {
        return [];
      }
      return normalized.sort((a, b) => b.value - a.value);
    }
  }

  return [];
}

function extractTrustRadiusReviews(url: string, pageProps: unknown): ReviewSiteSnippet[] {
  const pagePropsRecord = asRecord(pageProps);
  const truncatedReviews = asRecord(pagePropsRecord.truncatedReviews);
  const hits = asArray(truncatedReviews.hits);

  const reviews: ReviewSiteSnippet[] = [];

  for (const hit of hits) {
    const record = asRecord(hit);
    const reviewer = asRecord(record.reviewer);
    const questions = asArray(record.questions);
    const excerpt = pickTrustRadiusExcerpt(questions);
    if (!excerpt) continue;

    reviews.push({
      author: asString(reviewer.fullName) ?? null,
      title: asString(record.heading) ?? null,
      rating: toNumber(record.rating) ?? null,
      date: asString(record.publishedDate) ?? asString(record.editedDate) ?? null,
      excerpt,
      url: (() => {
        const slug = asString(record.slug);
        return slug ? `${url}#${slug}` : null;
      })(),
    });
  }

  return reviews;
}

function pickTrustRadiusExcerpt(questions: unknown[]): string | null {
  for (const question of questions) {
    const record = asRecord(question);
    const responseText = asString(record.responseText);
    if (responseText) return normalizeWhitespace(responseText);

    const raw = asRecord(record.raw);
    const response = asRecord(raw.response);
    const html = asString(response.html) ?? asString(response.followupHtml);
    if (html) return normalizeWhitespace(stripHtml(html));
  }

  return null;
}

function extractAggregateFromJsonLd(html: string): {
  score: number | null;
  maxScore: number;
  reviewCount: number | null;
} | null {
  const items = extractJsonLdItems(html);

  for (const item of items) {
    if (!item.aggregateRating || typeof item.aggregateRating !== "object") {
      continue;
    }
    const aggregate = item.aggregateRating as Record<string, unknown>;

    const score = toNumber(aggregate.ratingValue);
    const maxScore = toNumber(aggregate.bestRating) ?? 5;
    const reviewCount = toNumber(aggregate.reviewCount) ?? toNumber(aggregate.ratingCount);

    return {
      score,
      maxScore,
      reviewCount,
    };
  }

  return null;
}

function extractReviewsFromJsonLd(html: string): ReviewSiteSnippet[] {
  const items = extractJsonLdItems(html);

  const reviews: ReviewSiteSnippet[] = [];

  for (const item of items) {
    if (asString(item["@type"]) !== "Review") continue;

    const author = asRecord(item.author);
    const rating = asRecord(item.reviewRating);
    const excerpt = normalizeWhitespace(asString(item.reviewBody) ?? "");
    if (!excerpt) continue;

    reviews.push({
      author: asString(author.name) ?? null,
      title: asString(item.headline) ?? null,
      rating: toNumber(rating.ratingValue) ?? null,
      date: asString(item.datePublished) ?? null,
      excerpt,
      url: null,
    });
  }

  return reviews;
}

function extractJsonLdItems(html: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  const regex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    try {
      const parsed: unknown = JSON.parse(match[1]);
      flattenJsonLd(parsed, items);
    } catch {
      continue;
    }
  }

  return items;
}

function flattenJsonLd(value: unknown, items: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, items);
    return;
  }

  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  items.push(record);

  if (Array.isArray(record["@graph"])) {
    flattenJsonLd(record["@graph"], items);
  }
}

function extractNextData(html: string): Record<string, unknown> | null {
  const match =
    /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match) return null;

  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeReviewSite(site: ReviewSiteData): string {
  const parts = [
    site.score != null ? `${site.score}/${site.maxScore}` : null,
    site.reviewCount != null ? `${site.reviewCount} reviews` : null,
    site.ratingDistribution.length > 0 ? summarizeDistribution(site.ratingDistribution) : null,
  ].filter((part): part is string => Boolean(part));

  return parts.join(", ") || site.url;
}

function summarizeDistribution(distribution: ReviewSiteBucket[]): string {
  return distribution.map((bucket) => `${bucket.label}:${bucket.count}`).join(", ");
}

function hasMeaningfulScoreChange(
  current: number | null | undefined,
  next: number | null | undefined,
): boolean {
  if (current == null || next == null) return current !== next;
  return Math.abs(current - next) >= 0.1;
}

function hasMeaningfulCountChange(
  current: number | null | undefined,
  next: number | null | undefined,
): boolean {
  if (current == null || next == null) return current !== next;
  const threshold = Math.max(5, Math.ceil(current * 0.05));
  return Math.abs(current - next) >= threshold;
}

function hasMeaningfulDistributionChange(
  current: ReviewSiteBucket[],
  next: ReviewSiteBucket[],
): boolean {
  if (current.length === 0 || next.length === 0) {
    return current.length !== next.length;
  }

  const nextMap = new Map(next.map((bucket) => [bucket.label, bucket.count]));
  let totalDelta = 0;

  for (const bucket of current) {
    totalDelta += Math.abs(bucket.count - (nextMap.get(bucket.label) ?? 0));
  }

  for (const bucket of next) {
    if (!current.some((currentBucket) => currentBucket.label === bucket.label)) {
      totalDelta += bucket.count;
    }
  }

  return totalDelta >= 5;
}

function normalizeWhitespace(value: string): string {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function wordToNumber(value: string): number {
  switch (value) {
    case "one":
      return 1;
    case "two":
      return 2;
    case "three":
      return 3;
    case "four":
      return 4;
    case "five":
      return 5;
    default:
      return Number.NaN;
  }
}

function formatNullableNumber(value: number | null | undefined): string {
  return value == null ? "-" : value.toFixed(1);
}

function formatNullableInteger(value: number | null | undefined): string {
  return value == null ? "-" : value.toLocaleString();
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
