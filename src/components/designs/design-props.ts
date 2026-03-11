import type {
  Company,
  LlmModelKey,
  PlanWithCompany,
  ReviewSitePlatform,
} from "@llm-tracker/shared";

// ---------------------------------------------------------------------------
// Column definitions (shared across designs)
// ---------------------------------------------------------------------------

export const ALL_COLUMN_IDS = [
  "name",
  "plan",
  "g2",
  "trustpilot",
  "trustradius",
  "capterra",
  "price",
  "costEfficiency",
  "responses",
  "schedule",
  "llmSupport",
  "locations",
] as const;

export type ColumnId = (typeof ALL_COLUMN_IDS)[number];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  name: "Company",
  plan: "Plan",
  g2: "G2",
  trustpilot: "Trustpilot",
  trustradius: "TrustRadius",
  capterra: "Capterra",
  price: "Price/mo",
  costEfficiency: "$/1K Resp.",
  responses: "AI Resp./mo",
  schedule: "Schedule",
  llmSupport: "LLM Support",
  locations: "Locations",
};

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

// ---------------------------------------------------------------------------
// Design variant keys
// ---------------------------------------------------------------------------

export const DESIGN_KEYS = [
  "table",
  "cards",
  "terminal",
  "cyberpunk",
  "brutalist",
  "bento",
  "spreadsheet",
  "newspaper",
  "blueprint",
  "timeline",
  "dashboard",
  "retroOs",
  "minimal",
  "scientific",
  "dark",
  "ranked",
] as const;

export type DesignKey = (typeof DESIGN_KEYS)[number];

export const DESIGN_LABELS: Record<DesignKey, string> = {
  table: "Table",
  cards: "Cards",
  terminal: "Terminal",
  cyberpunk: "Cyberpunk",
  brutalist: "Brutalist",
  bento: "Bento",
  spreadsheet: "Spreadsheet",
  newspaper: "Newspaper",
  blueprint: "Blueprint",
  timeline: "Timeline",
  dashboard: "Dashboard",
  retroOs: "Retro OS",
  minimal: "Minimal",
  scientific: "Scientific",
  dark: "Dark",
  ranked: "Ranked",
};

// ---------------------------------------------------------------------------
// Filters state
// ---------------------------------------------------------------------------

export interface FilterState {
  q: string;
  scheduleFilter: string;
  llmFilter: LlmModelKey[];
  priceMin: number | undefined;
  priceMax: number | undefined;
  costMin: number | undefined;
  costMax: number | undefined;
  responsesMin: number | undefined;
  responsesMax: number | undefined;
  g2Min: number | undefined;
  g2Max: number | undefined;
  trustpilotMin: number | undefined;
  trustpilotMax: number | undefined;
  trustradiusMin: number | undefined;
  trustradiusMax: number | undefined;
  capterraMin: number | undefined;
  capterraMax: number | undefined;
  locationType: string;
}

// ---------------------------------------------------------------------------
// Props shared by all design components
// ---------------------------------------------------------------------------

export interface DesignProps {
  // Data
  plans: PlanWithCompany[];
  allPlans: PlanWithCompany[];
  companies: Company[];

  // Selection
  selectedPlans: Set<string>;
  onTogglePlan: (key: string) => void;
  onCompare: () => void;

  // Editing
  onEditPlan: (plan: PlanWithCompany) => void;
  onAddCompany: () => void;

  // Sort
  sortBy: string;
  sortDir: string;
  onToggleSort: (col: string) => void;

  // Column visibility
  visibleColumns: ColumnId[];
  onColumnsChange: (cols: ColumnId[]) => void;

  // Filters
  filters: FilterState;
  updateSearch: (patch: Record<string, unknown>) => void;

  // Active filter count (for "clear all" display)
  activeFilterCount: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function formatPrice(plan: PlanWithCompany): string {
  if (plan.price.amount === null) return "Custom";
  const formatted = `$${plan.price.amount.toLocaleString()}`;
  return plan.price.note ? `${formatted}*` : formatted;
}

export function formatLocation(loc: string | number): string {
  if (loc === "global") return "Global";
  return `${loc} regions`;
}

export function getReviewSiteScore(
  plan: PlanWithCompany & {
    companyReviewSites?: Partial<Record<ReviewSitePlatform, { score?: number | null }>>;
  },
  platform: ReviewSitePlatform,
): number | null {
  return plan.companyReviewSites?.[platform]?.score ?? null;
}

export function getReviewSiteMaxScore(
  plan: PlanWithCompany & {
    companyReviewSites?: Partial<Record<ReviewSitePlatform, { maxScore?: number | null }>>;
  },
  platform: ReviewSitePlatform,
  fallback: number,
): number {
  return plan.companyReviewSites?.[platform]?.maxScore ?? fallback;
}

export function planKey(plan: PlanWithCompany): string {
  return `${plan.companySlug}/${plan.slug}`;
}
