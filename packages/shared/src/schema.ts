import { z } from "zod";

// --- Price ---
export const PriceSchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().default("USD"),
  period: z.enum(["monthly", "yearly", "one-time"]).default("monthly"),
  note: z.string().nullable().optional(),
});

// --- LLM Support ---
export const LlmSupportSchema = z.object({
  aiMode: z.boolean().default(false),
  aiOverviews: z.boolean().default(false),
  chatgpt: z.boolean().default(false),
  gemini: z.boolean().default(false),
  perplexity: z.boolean().default(false),
  grok: z.boolean().default(false),
  llama: z.boolean().default(false),
  claude: z.boolean().default(false),
});

// --- Plan ---
export const PlanSchema = z.object({
  name: z.string(),
  slug: z.string(),
  price: PriceSchema,
  pricePer1000Responses: z.number().nullable().optional(),
  aiResponsesMonthly: z.number().nullable().optional(),
  includedLlmModels: z.number().nullable().optional(),
  schedule: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  locationSupport: z.union([z.literal("global"), z.number()]).default(5),
  personaSupport: z.union([z.literal("unlimited"), z.number()]).default(1),
  contentGeneration: z.union([z.string(), z.literal(false)]).default(false),
  contentOptimization: z.union([z.string(), z.literal(false)]).default(false),
  integrations: z.array(z.string()).default([]),
  llmSupport: LlmSupportSchema,
});

// --- Review ---
export const ReviewSchema = z.object({
  platform: z.string(),
  url: z.string().url().nullable().optional(),
  score: z.number().nullable().optional(),
  maxScore: z.number().default(5),
});

export const ReviewSitePlatformSchema = z.enum([
  "g2",
  "trustpilot",
  "trustradius",
  "capterra",
]);

export const ReviewSiteBucketSchema = z.object({
  label: z.string(),
  value: z.number(),
  count: z.number().int().nonnegative(),
});

export const ReviewSiteSnippetSchema = z.object({
  author: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  date: z.string().nullable().optional(),
  excerpt: z.string(),
  url: z.string().url().nullable().optional(),
});

export const ReviewSiteDataSchema = z.object({
  url: z.string().url(),
  score: z.number().nullable().optional(),
  maxScore: z.number().positive().default(5),
  reviewCount: z.number().int().nonnegative().nullable().optional(),
  ratingDistribution: z.array(ReviewSiteBucketSchema).default([]),
  reviews: z.array(ReviewSiteSnippetSchema).default([]),
});

export const ReviewSitesSchema = z.object({
  g2: ReviewSiteDataSchema.optional(),
  trustpilot: ReviewSiteDataSchema.optional(),
  trustradius: ReviewSiteDataSchema.optional(),
  capterra: ReviewSiteDataSchema.optional(),
});

// --- Tweet ---
export const TweetSchema = z.object({
  author: z.string(),
  authorName: z.string(),
  date: z.string(),
  text: z.string(),
  url: z.string().url(),
});

// --- Score ---
export const ScoreSchema = z.object({
  total: z.number(),
  maxTotal: z.number().default(48),
  summary: z.string(),
});

// --- Company ---
export const CompanySchema = z.object({
  slug: z.string(),
  name: z.string(),
  group: z.string().optional(),
  website: z.string().url(),
  description: z.string(),
  plans: z.array(PlanSchema).min(1),
  score: ScoreSchema.optional(),
  reviewSites: ReviewSitesSchema.default({}),
  reviews: z.array(ReviewSchema).default([]),
  tweets: z.array(TweetSchema).default([]),
  pricingUrl: z.string().url().nullable().optional(),
  featuresUrl: z.string().url().nullable().optional(),
  lastChecked: z.string().nullable().optional(),
});

// --- Compiled Data ---
export const CompiledDataSchema = z.object({
  companies: z.array(CompanySchema),
  generatedAt: z.string(),
});

// --- Extraction ---
export const ExtractedPlanSchema = z.object({
  name: z.string().min(1),
  price: z.object({
    amount: z.number().nullable(),
    currency: z.string().default("USD"),
    period: z.enum(["monthly", "yearly", "one-time"]),
    note: z.string().nullable(),
  }),
  aiResponsesMonthly: z.number().nullable(),
  includedLlmModels: z.number().nullable(),
  schedule: z.enum(["daily", "weekly", "monthly"]).nullable(),
  locationSupport: z.union([z.literal("global"), z.number()]).nullable(),
  personaSupport: z.union([z.literal("unlimited"), z.number()]).nullable(),
  contentGeneration: z.union([z.string(), z.literal(false)]).nullable(),
  contentOptimization: z.union([z.string(), z.literal(false)]).nullable(),
  integrations: z.array(z.string()).default([]),
  llmSupport: LlmSupportSchema,
});

export const ExtractionResultSchema = z.object({
  companyName: z.string().min(1).default("Unknown Company"),
  plans: z.array(ExtractedPlanSchema).default([]),
});
