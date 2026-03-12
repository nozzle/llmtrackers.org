import compiledData from "../packages/shared/compiled-data.json";
import type {
  Company,
  CompiledData,
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
