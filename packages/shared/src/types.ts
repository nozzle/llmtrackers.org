import { z } from "zod";
import {
  CompanySchema,
  CompiledDataSchema,
  PlanSchema,
  PriceSchema,
  LlmSupportSchema,
  ReviewSchema,
  ReviewSitesSchema,
  ReviewSiteDataSchema,
  ReviewSiteBucketSchema,
  ReviewSiteSnippetSchema,
  ReviewSitePlatformSchema,
  TweetSchema,
  ScoreSchema,
} from "./schema.js";

export type Company = z.infer<typeof CompanySchema>;
export type CompiledData = z.infer<typeof CompiledDataSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type LlmSupport = z.infer<typeof LlmSupportSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type ReviewSites = z.infer<typeof ReviewSitesSchema>;
export type ReviewSiteData = z.infer<typeof ReviewSiteDataSchema>;
export type ReviewSiteBucket = z.infer<typeof ReviewSiteBucketSchema>;
export type ReviewSiteSnippet = z.infer<typeof ReviewSiteSnippetSchema>;
export type ReviewSitePlatform = z.infer<typeof ReviewSitePlatformSchema>;
export type Tweet = z.infer<typeof TweetSchema>;
export type Score = z.infer<typeof ScoreSchema>;

export const REVIEW_SITE_PLATFORMS: ReviewSitePlatform[] = [
  "g2",
  "trustpilot",
  "trustradius",
  "capterra",
];

export const REVIEW_SITE_LABELS: Record<ReviewSitePlatform, string> = {
  g2: "G2",
  trustpilot: "Trustpilot",
  trustradius: "TrustRadius",
  capterra: "Capterra",
};

/** A plan with its parent company info attached, useful for comparison views */
export type PlanWithCompany = Plan & {
  companySlug: string;
  companyName: string;
  companyWebsite: string;
};

export type CompanyYamlValue = Company & {
  [key: string]: unknown;
};

/** All LLM model keys */
export type LlmModelKey = keyof LlmSupport;

export const LLM_MODEL_LABELS: Record<LlmModelKey, string> = {
  aiMode: "AI Mode",
  aiOverviews: "AI Overviews",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  grok: "Grok",
  llama: "Llama",
  claude: "Claude",
};
