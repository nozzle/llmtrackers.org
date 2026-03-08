import { Document, parseDocument } from "yaml";
import { CompanySchema, PublishedReviewSchema } from "./schema.js";
import type {
  Company,
  CompanyYamlValue,
  LlmModelKey,
  Plan,
  PublishedReview,
  ReviewSiteData,
  ReviewSitePlatform,
  ReviewSites,
} from "./types.js";

export interface ExtractedPlanLike {
  name: string;
  price: {
    amount: number | null;
    currency: string;
    period: "monthly" | "yearly" | "one-time";
    note: string | null;
  };
  aiResponsesMonthly: number | null;
  includedLlmModels: number | null;
  schedule: "daily" | "weekly" | "monthly" | null;
  locationSupport: "global" | number | null;
  personaSupport: "unlimited" | number | null;
  contentGeneration: string | false | null;
  contentOptimization: string | false | null;
  integrations: string[];
  llmSupport: Record<LlmModelKey, boolean>;
}

export interface PreparedCompanyYaml {
  company: CompanyYamlValue;
  document: Document.Parsed;
  yamlText: string;
}

const LLM_KEYS: LlmModelKey[] = [
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "llama",
  "grok",
  "aiOverviews",
  "aiMode",
];

const REVIEW_SITE_PLATFORMS: ReviewSitePlatform[] = ["g2", "trustpilot", "trustradius", "capterra"];

export function parseCompanyYaml(yamlText: string): {
  company: CompanyYamlValue;
  document: Document.Parsed;
} {
  const document = parseDocument(yamlText);
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("; "));
  }

  const parsed = document.toJS({ maxAliasCount: -1 }) as unknown;
  const company = CompanySchema.parse(parsed) as CompanyYamlValue;
  return { company, document };
}

export function stringifyCompanyYaml(company: CompanyYamlValue): string {
  const validated = CompanySchema.parse(company);
  const document = new Document(sortCompanyKeys(validated));
  return document.toString({ indent: 2, lineWidth: 0 });
}

export function mergeCompanyWithExtractedPlans(
  company: Company,
  extractedPlans: ExtractedPlanLike[],
  checkedAt: string,
): CompanyYamlValue {
  const planByName = new Map(company.plans.map((plan) => [normalize(plan.name), plan]));
  const extractedByName = new Map(extractedPlans.map((plan) => [normalize(plan.name), plan]));

  const mergedPlans: Plan[] = [];

  for (const existingPlan of company.plans) {
    const extractedPlan = extractedByName.get(normalize(existingPlan.name));
    if (!extractedPlan) {
      mergedPlans.push(existingPlan);
      continue;
    }
    mergedPlans.push(mergePlan(existingPlan, extractedPlan));
  }

  for (const extractedPlan of extractedPlans) {
    const existingPlan = planByName.get(normalize(extractedPlan.name));
    if (!existingPlan) {
      mergedPlans.push(createPlanFromExtraction(extractedPlan));
    }
  }

  return {
    ...company,
    plans: mergedPlans,
    lastChecked: checkedAt,
  };
}

export function prepareUpdatedCompanyYaml(
  yamlText: string,
  extractedPlans: ExtractedPlanLike[],
  checkedAt: string,
): PreparedCompanyYaml {
  const { company } = parseCompanyYaml(yamlText);
  const updatedCompany = mergeCompanyWithExtractedPlans(company, extractedPlans, checkedAt);
  const nextYaml = stringifyCompanyYaml(updatedCompany);
  const reparsed = parseCompanyYaml(nextYaml);

  return {
    company: reparsed.company,
    document: reparsed.document,
    yamlText: nextYaml,
  };
}

export function mergeCompanyWithReviewSites(
  company: Company,
  extractedReviewSites: Partial<ReviewSites>,
): CompanyYamlValue {
  let mergedReviewSites: ReviewSites = {
    ...company.reviewSites,
  };

  for (const platform of REVIEW_SITE_PLATFORMS) {
    const nextSite = extractedReviewSites[platform];
    if (!nextSite) continue;

    const mergedSite = mergeReviewSiteData(company.reviewSites[platform], nextSite);

    if (mergedSite) {
      mergedReviewSites[platform] = mergedSite;
    } else {
      const { [platform]: _removed, ...remainingSites } = mergedReviewSites;
      mergedReviewSites = remainingSites as ReviewSites;
    }
  }

  return {
    ...company,
    reviewSites: mergedReviewSites,
  };
}

export function prepareUpdatedCompanyReviewSitesYaml(
  yamlText: string,
  extractedReviewSites: Partial<ReviewSites>,
): PreparedCompanyYaml {
  const { company } = parseCompanyYaml(yamlText);
  const updatedCompany = mergeCompanyWithReviewSites(company, extractedReviewSites);
  const nextYaml = stringifyCompanyYaml(updatedCompany);
  const reparsed = parseCompanyYaml(nextYaml);

  return {
    company: reparsed.company,
    document: reparsed.document,
    yamlText: nextYaml,
  };
}

function mergePlan(existingPlan: Plan, extractedPlan: ExtractedPlanLike): Plan {
  const nextPriceAmount = chooseNullable(extractedPlan.price.amount, existingPlan.price.amount);
  const nextAiResponses = chooseNullable(
    extractedPlan.aiResponsesMonthly,
    existingPlan.aiResponsesMonthly ?? null,
  );
  const nextPricePer1000Responses =
    nextPriceAmount !== null && nextAiResponses !== null && nextAiResponses > 0
      ? Number(((nextPriceAmount / nextAiResponses) * 1000).toFixed(2))
      : (existingPlan.pricePer1000Responses ?? null);

  return {
    ...existingPlan,
    price: {
      amount: nextPriceAmount,
      currency: extractedPlan.price.currency,
      period: extractedPlan.price.period,
      note: chooseNullable(extractedPlan.price.note, existingPlan.price.note ?? null),
    },
    pricePer1000Responses: nextPricePer1000Responses,
    aiResponsesMonthly: nextAiResponses,
    includedLlmModels: chooseNullable(
      extractedPlan.includedLlmModels,
      existingPlan.includedLlmModels ?? null,
    ),
    schedule: extractedPlan.schedule ?? existingPlan.schedule,
    locationSupport: extractedPlan.locationSupport ?? existingPlan.locationSupport,
    personaSupport: extractedPlan.personaSupport ?? existingPlan.personaSupport,
    contentGeneration: extractedPlan.contentGeneration ?? existingPlan.contentGeneration,
    contentOptimization: extractedPlan.contentOptimization ?? existingPlan.contentOptimization,
    integrations:
      extractedPlan.integrations.length > 0
        ? extractedPlan.integrations
        : existingPlan.integrations,
    llmSupport: {
      ...existingPlan.llmSupport,
      ...extractedPlan.llmSupport,
    },
  };
}

function createPlanFromExtraction(extractedPlan: ExtractedPlanLike): Plan {
  return {
    name: extractedPlan.name,
    slug: slugify(extractedPlan.name),
    price: {
      amount: extractedPlan.price.amount,
      currency: extractedPlan.price.currency,
      period: extractedPlan.price.period,
      note: extractedPlan.price.note,
    },
    pricePer1000Responses:
      extractedPlan.price.amount !== null &&
      extractedPlan.aiResponsesMonthly !== null &&
      extractedPlan.aiResponsesMonthly > 0
        ? Number(
            ((extractedPlan.price.amount / extractedPlan.aiResponsesMonthly) * 1000).toFixed(2),
          )
        : null,
    aiResponsesMonthly: extractedPlan.aiResponsesMonthly,
    includedLlmModels: extractedPlan.includedLlmModels,
    schedule: extractedPlan.schedule ?? "daily",
    locationSupport: extractedPlan.locationSupport ?? 5,
    personaSupport: extractedPlan.personaSupport ?? 1,
    contentGeneration: extractedPlan.contentGeneration ?? false,
    contentOptimization: extractedPlan.contentOptimization ?? false,
    integrations: extractedPlan.integrations,
    llmSupport: normalizeLlmSupport(extractedPlan.llmSupport),
  };
}

function normalizeLlmSupport(
  llmSupport: Partial<Record<LlmModelKey, boolean>>,
): Record<LlmModelKey, boolean> {
  return Object.fromEntries(LLM_KEYS.map((key) => [key, llmSupport[key] ?? false])) as Record<
    LlmModelKey,
    boolean
  >;
}

function mergeReviewSiteData(
  existing: ReviewSiteData | undefined,
  next: ReviewSiteData,
): ReviewSiteData | undefined {
  const merged: ReviewSiteData = {
    url: next.url,
    score: next.score ?? existing?.score ?? null,
    maxScore: next.maxScore,
    reviewCount: next.reviewCount ?? existing?.reviewCount ?? null,
    ratingDistribution:
      next.ratingDistribution.length > 0
        ? next.ratingDistribution
        : (existing?.ratingDistribution ?? []),
    reviews: next.reviews.length > 0 ? next.reviews : (existing?.reviews ?? []),
  };

  const hasMeaningfulData =
    merged.score !== null ||
    merged.reviewCount !== null ||
    merged.ratingDistribution.length > 0 ||
    merged.reviews.length > 0;

  if (!hasMeaningfulData && !existing) {
    return undefined;
  }

  return merged;
}

function sortCompanyKeys(company: CompanyYamlValue): CompanyYamlValue {
  const hasReviewSites = Object.keys(company.reviewSites).length > 0;

  return {
    slug: company.slug,
    name: company.name,
    ...(company.group ? { group: company.group } : {}),
    website: company.website,
    description: company.description,
    plans: company.plans.map(sortPlanKeys),
    ...(hasReviewSites ? { reviewSites: company.reviewSites } : {}),
    tweets: company.tweets,
    ...(company.pricingUrl !== undefined ? { pricingUrl: company.pricingUrl } : {}),
    ...(company.featuresUrl !== undefined ? { featuresUrl: company.featuresUrl } : {}),
    ...(company.lastChecked !== undefined ? { lastChecked: company.lastChecked } : {}),
  } as CompanyYamlValue;
}

function sortPlanKeys(plan: Plan): Plan {
  return {
    name: plan.name,
    slug: plan.slug,
    price: {
      amount: plan.price.amount,
      currency: plan.price.currency,
      period: plan.price.period,
      note: plan.price.note ?? null,
    },
    pricePer1000Responses: plan.pricePer1000Responses ?? null,
    aiResponsesMonthly: plan.aiResponsesMonthly ?? null,
    includedLlmModels: plan.includedLlmModels ?? null,
    schedule: plan.schedule,
    locationSupport: plan.locationSupport,
    personaSupport: plan.personaSupport,
    contentGeneration: plan.contentGeneration,
    contentOptimization: plan.contentOptimization,
    integrations: plan.integrations,
    llmSupport: normalizeLlmSupport(plan.llmSupport),
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function chooseNullable<T>(nextValue: T | null, fallbackValue: T | null): T | null {
  return nextValue ?? fallbackValue;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---- Review YAML ----

export type ReviewYamlValue = PublishedReview & Record<string, unknown>;

export function parseReviewYaml(yamlText: string): {
  review: ReviewYamlValue;
  document: Document.Parsed;
} {
  const document = parseDocument(yamlText);
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("; "));
  }

  const parsed = document.toJS({ maxAliasCount: -1 }) as unknown;
  const review = PublishedReviewSchema.parse(parsed) as ReviewYamlValue;
  return { review, document };
}

export function stringifyReviewYaml(review: ReviewYamlValue): string {
  const validated = PublishedReviewSchema.parse(review);
  const document = new Document(sortReviewKeys(validated as ReviewYamlValue));
  return document.toString({ indent: 2, lineWidth: 0 });
}

function sortReviewKeys(review: ReviewYamlValue): ReviewYamlValue {
  return {
    slug: review.slug,
    name: review.name,
    url: review.url,
    date: review.date,
    author: {
      name: review.author.name,
      socialProfiles: review.author.socialProfiles.map((sp) => ({
        label: sp.label,
        url: sp.url,
      })),
    },
    companyRatings: review.companyRatings.map((cr) => ({
      companySlug: cr.companySlug,
      score: cr.score,
      maxScore: cr.maxScore,
      summary: cr.summary,
      ...(cr.directLink ? { directLink: cr.directLink } : {}),
      ...(cr.pros.length > 0 ? { pros: cr.pros } : {}),
      ...(cr.cons.length > 0 ? { cons: cr.cons } : {}),
      ...(cr.noteworthy.length > 0 ? { noteworthy: cr.noteworthy } : {}),
    })),
  } as ReviewYamlValue;
}
