import { type z } from "zod";
import {
  type CompanySchema,
  type CompiledDataSchema,
  type PlanSchema,
  type PriceSchema,
  type LlmSupportSchema,
  type ReviewSitesSchema,
  type ReviewSiteDataSchema,
  type ReviewSiteBucketSchema,
  type ReviewSiteSnippetSchema,
  type ReviewSitePlatformSchema,
  type ScreenshotSourceTypeSchema,
  type CompanyScreenshotSourceSchema,
  type CompanyScreenshotSchema,
  type CompanyVideoProviderSchema,
  type CompanyVideoSourceTypeSchema,
  type CompanyVideoSchema,
  type TweetSchema,
  type ReviewAuthorSocialProfileSchema,
  type ReviewAuthorSchema,
  type ReviewCompanyRatingSchema,
  type PublishedReviewSchema,
} from "./schema.js";

export type Company = z.infer<typeof CompanySchema>;
export type CompiledData = z.infer<typeof CompiledDataSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type LlmSupport = z.infer<typeof LlmSupportSchema>;
export type ReviewSites = z.infer<typeof ReviewSitesSchema>;
export type ReviewSiteData = z.infer<typeof ReviewSiteDataSchema>;
export type ReviewSiteBucket = z.infer<typeof ReviewSiteBucketSchema>;
export type ReviewSiteSnippet = z.infer<typeof ReviewSiteSnippetSchema>;
export type ReviewSitePlatform = z.infer<typeof ReviewSitePlatformSchema>;
export type ScreenshotSourceType = z.infer<typeof ScreenshotSourceTypeSchema>;
export type CompanyScreenshotSource = z.infer<typeof CompanyScreenshotSourceSchema>;
export type CompanyScreenshot = z.infer<typeof CompanyScreenshotSchema>;
export type CompanyVideoProvider = z.infer<typeof CompanyVideoProviderSchema>;
export type CompanyVideoSourceType = z.infer<typeof CompanyVideoSourceTypeSchema>;
export type CompanyVideo = z.infer<typeof CompanyVideoSchema>;
export type Tweet = z.infer<typeof TweetSchema>;
export type ReviewAuthorSocialProfile = z.infer<typeof ReviewAuthorSocialProfileSchema>;
export type ReviewAuthor = z.infer<typeof ReviewAuthorSchema>;
export type ReviewCompanyRating = z.infer<typeof ReviewCompanyRatingSchema>;
export type PublishedReview = z.infer<typeof PublishedReviewSchema>;

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

export type CompanyYamlValue = Company & Record<string, unknown>;

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
