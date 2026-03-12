import compiledData from "../packages/shared/compiled-data.json";
import type {
  Company,
  CompiledData,
  CompanyScreenshot,
  Metric,
  MetricSupport,
  PlanWithCompany,
  PublishedReview,
} from "@llm-tracker/shared";

const data = compiledData as unknown as CompiledData;

type PlanWithCompanyMeta = PlanWithCompany & {
  companyReviewSites: Company["reviewSites"];
};

export type CompanyMetric = Metric & {
  supportedBy: MetricSupport[];
};

export type ComparisonPlan = PlanWithCompanyMeta;

export function getAllCompanies(): Company[] {
  return data.companies;
}

export function getCompanyBySlug(slug: string): Company | undefined {
  return data.companies.find((c) => c.slug === slug);
}

export function getAllReviews(): PublishedReview[] {
  return data.reviews;
}

export function getAllMetrics(): Metric[] {
  return data.metrics;
}

export function getMetricById(id: string): Metric | undefined {
  return data.metrics.find((metric) => metric.id === id);
}

export function getMetricsForCompanySlug(companySlug: string): CompanyMetric[] {
  return data.metrics
    .map((metric) => ({
      ...metric,
      supportedBy: metric.supportedBy.filter((support) => support.companySlug === companySlug),
    }))
    .filter((metric) => metric.supportedBy.length > 0);
}

export function getMetricsForPlan(companySlug: string, planSlug: string): Metric[] {
  return data.metrics.filter((metric) =>
    metric.supportedBy.some(
      (support) => support.companySlug === companySlug && support.planSlug === planSlug,
    ),
  );
}

export function getReviewBySlug(slug: string): PublishedReview | undefined {
  return data.reviews.find((review) => review.slug === slug);
}

export function getReviewsForCompanySlug(companySlug: string): PublishedReview[] {
  return data.reviews.filter((review) =>
    review.companyRatings.some((rating) => rating.companySlug === companySlug),
  );
}

export function getAllPlansWithCompany(): PlanWithCompanyMeta[] {
  return data.companies.flatMap((company) =>
    company.plans.map((plan) => ({
      ...plan,
      companySlug: company.slug,
      companyName: company.name,
      companyWebsite: company.website,
      companyReviewSites: company.reviewSites,
    })),
  );
}

export function getPlanByKey(key: string): PlanWithCompanyMeta | undefined {
  // key format: "company-slug/plan-slug"
  const [companySlug, planSlug] = key.split("/");
  const company = getCompanyBySlug(companySlug);
  if (!company) return undefined;
  const plan = company.plans.find((p) => p.slug === planSlug);
  if (!plan) return undefined;
  return {
    ...plan,
    companySlug: company.slug,
    companyName: company.name,
    companyWebsite: company.website,
    companyReviewSites: company.reviewSites,
  };
}

export function getGeneratedAt(): string {
  return data.generatedAt;
}

// ---------------------------------------------------------------------------
// Screenshots (cross-company)
// ---------------------------------------------------------------------------

export type ScreenshotWithCompany = CompanyScreenshot & {
  companySlug: string;
  companyName: string;
};

export function getAllScreenshotsWithCompany(): ScreenshotWithCompany[] {
  return data.companies.flatMap((company) =>
    company.screenshots.map((screenshot) => ({
      ...screenshot,
      companySlug: company.slug,
      companyName: company.name,
    })),
  );
}

/**
 * Fuzzy-match a screenshot to metrics supported by its company.
 *
 * Matching heuristic (any hit counts):
 *  1. A screenshot tag exactly equals a word in a metric ID (split on `-`).
 *  2. The screenshot `kind` exactly equals a word in a metric ID.
 *  3. A metric-ID word (length > 3) appears in the screenshot caption,
 *     contextHeading, or alt text.
 */
export function getMatchedMetricsForScreenshot(
  screenshot: CompanyScreenshot,
  companySlug: string,
): CompanyMetric[] {
  const companyMetrics = getMetricsForCompanySlug(companySlug);
  if (companyMetrics.length === 0) return [];

  // Collect lowercase search terms from the screenshot
  const tagSet = new Set(screenshot.tags.map((t) => t.toLowerCase()));
  const kindTerm = screenshot.kind?.toLowerCase() ?? "";

  // Build a combined lowercase text blob for caption / heading / alt
  const textBlob = [screenshot.caption, screenshot.contextHeading, screenshot.alt]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return companyMetrics.filter((metric) => {
    const idWords = metric.id.toLowerCase().split("-");

    // 1. Tag matches a metric-ID word
    for (const word of idWords) {
      if (tagSet.has(word)) return true;
    }

    // 2. Kind matches a metric-ID word
    if (kindTerm.length > 0 && idWords.includes(kindTerm)) return true;

    // 3. Metric-ID word (> 3 chars) found in text blob
    for (const word of idWords) {
      if (word.length > 3 && textBlob.includes(word)) return true;
    }

    return false;
  });
}
