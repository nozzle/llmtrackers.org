import type {
  Company,
  Plan,
  PublishedReview,
  LlmModelKey,
  ReviewSitePlatform,
} from "@llm-tracker/shared";

// ---------------------------------------------------------------------------
// Layout keys & labels
// ---------------------------------------------------------------------------

export const COMPANY_LAYOUT_KEYS = [
  "standard",
  "two-column",
  "compact",
  "tabbed",
  "sidebar",
] as const;

export type CompanyLayoutKey = (typeof COMPANY_LAYOUT_KEYS)[number];

export const COMPANY_LAYOUT_LABELS: Record<CompanyLayoutKey, string> = {
  standard: "Standard",
  "two-column": "Two-Column",
  compact: "Compact",
  tabbed: "Tabbed",
  sidebar: "Sidebar Nav",
};

// ---------------------------------------------------------------------------
// Shared props that every layout component receives
// ---------------------------------------------------------------------------

export interface CompanyDesignProps {
  company: Company;
  relatedReviews: PublishedReview[];
  onEditPlan: (plan: Plan) => void;
  onEditCompany: () => void;
  onAddPlan: () => void;
  onOpenMedia: (overlay: { type: "screenshot" | "video"; index: number }) => void;
}

// ---------------------------------------------------------------------------
// Constants re-exported for convenience in layouts
// ---------------------------------------------------------------------------

export const LLM_KEYS: LlmModelKey[] = [
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "llama",
  "grok",
  "aiOverviews",
  "aiMode",
];

export function formatBucketLabel(platform: ReviewSitePlatform, label: string): string {
  if (platform === "trustradius") return `${label}/5`;
  return label;
}
