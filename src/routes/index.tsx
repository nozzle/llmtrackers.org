import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getAllCompanies, getAllPlansWithCompany } from "~/data";
import { EditPlanModal } from "~/components/edit-plan-modal";
import { AddCompanyModal } from "~/components/add-company-modal";
import type { LlmModelKey, PlanWithCompany, ReviewSitePlatform } from "@llm-tracker/shared";
import { z } from "zod";

import {
  type DesignKey,
  type ColumnId,
  type FilterState,
  DESIGN_KEYS,
  DESIGN_LABELS,
  ALL_COLUMN_IDS,
} from "~/components/designs/design-props";
import { TableDesign } from "~/components/designs/table-design";
import { CardGridDesign } from "~/components/designs/card-grid";
import { TerminalDesign } from "~/components/designs/terminal";
import { NeonCyberpunkDesign } from "~/components/designs/neon-cyberpunk";
import { BrutalistDesign } from "~/components/designs/brutalist";
import { BentoGridDesign } from "~/components/designs/bento-grid";
import { SpreadsheetDesign } from "~/components/designs/spreadsheet";
import { NewspaperDesign } from "~/components/designs/newspaper";
import { BlueprintDesign } from "~/components/designs/blueprint";
import { TimelineDesign } from "~/components/designs/timeline";
import { DashboardDesign } from "~/components/designs/dashboard";
import { RetroOsDesign } from "~/components/designs/retro-os";
import { MinimalDesign } from "~/components/designs/minimal";
import { ScientificDesign } from "~/components/designs/scientific";
import { DarkDesign } from "~/components/designs/dark";
import { RankedDesign } from "~/components/designs/ranked";

// ---------------------------------------------------------------------------
// Search schema — URL is the source of truth for filters, sort, columns
// ---------------------------------------------------------------------------

const optionalNumber = z.coerce.number().optional().catch(undefined);

const homeSearchSchema = z.object({
  // design variant
  design: z
    .enum([
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
    ])
    .optional()
    .catch(undefined),

  // text search
  q: z.string().optional().catch(undefined),

  // sort
  sort: z
    .enum([
      "name",
      "g2",
      "trustpilot",
      "trustradius",
      "capterra",
      "price",
      "costEfficiency",
      "responses",
    ])
    .optional()
    .catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),

  // column filters
  schedule: z.string().optional().catch(undefined),
  llms: z.string().optional().catch(undefined),
  priceMin: optionalNumber,
  priceMax: optionalNumber,
  costMin: optionalNumber,
  costMax: optionalNumber,
  responsesMin: optionalNumber,
  responsesMax: optionalNumber,
  g2Min: optionalNumber,
  g2Max: optionalNumber,
  trustpilotMin: optionalNumber,
  trustpilotMax: optionalNumber,
  trustradiusMin: optionalNumber,
  trustradiusMax: optionalNumber,
  capterraMin: optionalNumber,
  capterraMax: optionalNumber,
  locationType: z.enum(["all", "global", "regional"]).optional().catch(undefined),

  // column visibility — comma-separated list of column ids to show.
  // When absent, all columns are shown.
  cols: z.string().optional().catch(undefined),
});

type HomeSearch = z.infer<typeof homeSearchSchema>;

/** Parse a comma-separated string into an array, or return undefined */
function parseCommaSeparated(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function isSortKey(value: string): value is NonNullable<HomeSearch["sort"]> {
  return [
    "name",
    "g2",
    "trustpilot",
    "trustradius",
    "capterra",
    "price",
    "costEfficiency",
    "responses",
  ].includes(value);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReviewSiteScore(
  plan: PlanWithCompany & {
    companyReviewSites?: Partial<Record<ReviewSitePlatform, { score?: number | null }>>;
  },
  platform: ReviewSitePlatform,
): number | null {
  return plan.companyReviewSites?.[platform]?.score ?? null;
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: homeSearchSchema,
  head: () => ({
    meta: [
      {
        title: "LLM Trackers - Compare AI Search Visibility Tools",
      },
      {
        name: "description",
        content:
          "Compare 19 AI search visibility and LLM tracking tools across 23 plans. Filter by price, LLM support, schedule, and more.",
      },
      { property: "og:title", content: "Compare AI Search Visibility Tools" },
      {
        property: "og:description",
        content:
          "Side-by-side comparison of 19 LLM tracking tools. Pricing, features, LLM support, integrations, and scores.",
      },
    ],
  }),
});

// ---------------------------------------------------------------------------
// Design Toggle Bar
// ---------------------------------------------------------------------------

function DesignToggle({
  active,
  onChange,
}: {
  active: DesignKey;
  onChange: (key: DesignKey) => void;
}) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wider text-gray-400">
        Design
      </span>
      <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
        {DESIGN_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              onChange(key);
            }}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              active === key
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {DESIGN_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Design renderer map
// ---------------------------------------------------------------------------

const DESIGN_COMPONENTS: Record<
  DesignKey,
  React.ComponentType<React.ComponentProps<typeof TableDesign>>
> = {
  table: TableDesign,
  cards: CardGridDesign,
  terminal: TerminalDesign,
  cyberpunk: NeonCyberpunkDesign,
  brutalist: BrutalistDesign,
  bento: BentoGridDesign,
  spreadsheet: SpreadsheetDesign,
  newspaper: NewspaperDesign,
  blueprint: BlueprintDesign,
  timeline: TimelineDesign,
  dashboard: DashboardDesign,
  retroOs: RetroOsDesign,
  minimal: MinimalDesign,
  scientific: ScientificDesign,
  dark: DarkDesign,
  ranked: RankedDesign,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function HomePage() {
  const allPlans = getAllPlansWithCompany();
  const companies = getAllCompanies();
  const search: HomeSearch = Route.useSearch();
  const navigate = useNavigate();

  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [editingPlan, setEditingPlan] = useState<PlanWithCompany | null>(null);
  const [addingCompany, setAddingCompany] = useState(false);

  // ---- Design variant ----
  const activeDesign: DesignKey = search.design ?? "table";

  // ---- Derived search state with defaults ----

  const q = search.q ?? "";
  const sortBy = search.sort ?? "price";
  const sortDir = search.dir ?? (sortBy === "name" ? "asc" : "desc");
  const scheduleFilter = search.schedule ?? "all";
  const llmFilter = useMemo<LlmModelKey[]>(() => {
    return (parseCommaSeparated(search.llms) as LlmModelKey[] | undefined) ?? [];
  }, [search.llms]);
  const priceMin = search.priceMin;
  const priceMax = search.priceMax;
  const costMin = search.costMin;
  const costMax = search.costMax;
  const responsesMin = search.responsesMin;
  const responsesMax = search.responsesMax;
  const g2Min = search.g2Min;
  const g2Max = search.g2Max;
  const trustpilotMin = search.trustpilotMin;
  const trustpilotMax = search.trustpilotMax;
  const trustradiusMin = search.trustradiusMin;
  const trustradiusMax = search.trustradiusMax;
  const capterraMin = search.capterraMin;
  const capterraMax = search.capterraMax;
  const locationType = search.locationType ?? "all";
  const visibleColumns: ColumnId[] = (parseCommaSeparated(search.cols) as
    | ColumnId[]
    | undefined) ?? [...ALL_COLUMN_IDS];

  // ---- Navigate helper — omits defaults to keep URLs clean ----

  // Internal patch type that accepts arrays for llms/cols convenience
  type SearchPatch = Omit<Partial<HomeSearch>, "llms" | "cols"> & {
    llms?: LlmModelKey[] | undefined;
    cols?: ColumnId[] | undefined;
  };

  function updateSearch(patch: SearchPatch | Record<string, unknown>) {
    void navigate({
      to: "/",
      search: (prev: HomeSearch) => {
        // Merge, converting array fields to comma strings
        const next: HomeSearch = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          (next as Record<string, unknown>)[k] = v;
        }

        // Clean up defaults so they don't appear in the URL
        const cleaned: Record<string, unknown> = {};

        // Design — only persist non-default
        if (next.design && next.design !== "table") cleaned.design = next.design;

        if (next.q) cleaned.q = next.q;
        if (next.sort && next.sort !== "price") cleaned.sort = next.sort;
        if (next.dir) {
          const naturalDir = (next.sort ?? "price") === "name" ? "asc" : "desc";
          if (next.dir !== naturalDir) cleaned.dir = next.dir;
        }
        if (next.schedule && next.schedule !== "all") cleaned.schedule = next.schedule;

        // llms — could be string (from prev) or array (from patch)
        const llmsVal = next.llms;
        const llmsStr = Array.isArray(llmsVal) ? llmsVal.join(",") : llmsVal;
        if (llmsStr) cleaned.llms = llmsStr;

        if (next.priceMin != null) cleaned.priceMin = next.priceMin;
        if (next.priceMax != null) cleaned.priceMax = next.priceMax;
        if (next.costMin != null) cleaned.costMin = next.costMin;
        if (next.costMax != null) cleaned.costMax = next.costMax;
        if (next.responsesMin != null) cleaned.responsesMin = next.responsesMin;
        if (next.responsesMax != null) cleaned.responsesMax = next.responsesMax;
        if (next.g2Min != null) cleaned.g2Min = next.g2Min;
        if (next.g2Max != null) cleaned.g2Max = next.g2Max;
        if (next.trustpilotMin != null) cleaned.trustpilotMin = next.trustpilotMin;
        if (next.trustpilotMax != null) cleaned.trustpilotMax = next.trustpilotMax;
        if (next.trustradiusMin != null) cleaned.trustradiusMin = next.trustradiusMin;
        if (next.trustradiusMax != null) cleaned.trustradiusMax = next.trustradiusMax;
        if (next.capterraMin != null) cleaned.capterraMin = next.capterraMin;
        if (next.capterraMax != null) cleaned.capterraMax = next.capterraMax;
        if (next.locationType && next.locationType !== "all")
          cleaned.locationType = next.locationType;

        // cols — only persist when not all columns are visible
        const colsVal = next.cols;
        const colsArr = Array.isArray(colsVal) ? colsVal : parseCommaSeparated(colsVal);
        if (colsArr && colsArr.length !== ALL_COLUMN_IDS.length) {
          cleaned.cols = colsArr.join(",");
        }

        return cleaned as HomeSearch;
      },
      replace: true,
    });
  }

  // ---- Filter & sort ----

  const filteredPlans = useMemo(() => {
    let result = allPlans;

    // Text search
    if (q) {
      const lower = q.toLowerCase();
      result = result.filter(
        (p) => p.companyName.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower),
      );
    }

    // Schedule
    if (scheduleFilter !== "all") {
      result = result.filter((p) => p.schedule === scheduleFilter);
    }

    // LLM multi-select (match ALL)
    if (llmFilter.length > 0) {
      result = result.filter((p) => llmFilter.every((k) => p.llmSupport[k]));
    }

    // Price
    if (priceMin != null || priceMax != null) {
      result = result.filter((p) => {
        const amt = p.price.amount;
        if (amt === null) return false;
        if (priceMin != null && amt < priceMin) return false;
        if (priceMax != null && amt > priceMax) return false;
        return true;
      });
    }

    // Cost efficiency
    if (costMin != null || costMax != null) {
      result = result.filter((p) => {
        const c = p.pricePer1000Responses;
        if (c == null) return false;
        if (costMin != null && c < costMin) return false;
        if (costMax != null && c > costMax) return false;
        return true;
      });
    }

    // AI Responses
    if (responsesMin != null || responsesMax != null) {
      result = result.filter((p) => {
        const r = p.aiResponsesMonthly;
        if (r == null) return false;
        if (responsesMin != null && r < responsesMin) return false;
        if (responsesMax != null && r > responsesMax) return false;
        return true;
      });
    }

    const reviewSiteRanges: {
      platform: ReviewSitePlatform;
      min: number | undefined;
      max: number | undefined;
    }[] = [
      { platform: "g2", min: g2Min, max: g2Max },
      { platform: "trustpilot", min: trustpilotMin, max: trustpilotMax },
      { platform: "trustradius", min: trustradiusMin, max: trustradiusMax },
      { platform: "capterra", min: capterraMin, max: capterraMax },
    ];

    for (const range of reviewSiteRanges) {
      if (range.min == null && range.max == null) continue;

      result = result.filter((p) => {
        const score = getReviewSiteScore(p, range.platform);
        if (score == null) return false;
        if (range.min != null && score < range.min) return false;
        if (range.max != null && score > range.max) return false;
        return true;
      });
    }

    // Locations
    if (locationType === "global") {
      result = result.filter((p) => p.locationSupport === "global");
    } else if (locationType === "regional") {
      result = result.filter((p) => typeof p.locationSupport === "number");
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "price":
          cmp = (a.price.amount ?? 99999) - (b.price.amount ?? 99999);
          break;
        case "responses":
          cmp = (a.aiResponsesMonthly ?? 0) - (b.aiResponsesMonthly ?? 0);
          break;
        case "g2":
        case "trustpilot":
        case "trustradius":
        case "capterra":
          cmp = (getReviewSiteScore(a, sortBy) ?? -1) - (getReviewSiteScore(b, sortBy) ?? -1);
          break;
        case "name":
          cmp = a.companyName.localeCompare(b.companyName);
          break;
        case "costEfficiency":
          cmp = (a.pricePer1000Responses ?? 999) - (b.pricePer1000Responses ?? 999);
          break;
        default:
          cmp = 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    allPlans,
    q,
    scheduleFilter,
    llmFilter,
    sortBy,
    sortDir,
    priceMin,
    priceMax,
    costMin,
    costMax,
    responsesMin,
    responsesMax,
    g2Min,
    g2Max,
    trustpilotMin,
    trustpilotMax,
    trustradiusMin,
    trustradiusMax,
    capterraMin,
    capterraMax,
    locationType,
  ]);

  // ---- Helpers ----

  function togglePlan(key: string) {
    setSelectedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCompare() {
    if (selectedPlans.size < 2) return;
    const plans = Array.from(selectedPlans).join(",");
    void navigate({ to: "/compare", search: { plans } });
  }

  function toggleSort(column: string) {
    if (!isSortKey(column)) return;

    if (sortBy === column) {
      const newDir = sortDir === "asc" ? "desc" : "asc";
      updateSearch({ dir: newDir });
    } else {
      updateSearch({
        sort: column,
        dir: undefined,
      });
    }
  }

  // Count active filters
  const activeFilterCount = [
    q,
    scheduleFilter !== "all" ? scheduleFilter : undefined,
    llmFilter.length > 0 ? "llm" : undefined,
    priceMin,
    priceMax,
    costMin,
    costMax,
    responsesMin,
    responsesMax,
    g2Min,
    g2Max,
    trustpilotMin,
    trustpilotMax,
    trustradiusMin,
    trustradiusMax,
    capterraMin,
    capterraMax,
    locationType !== "all" ? locationType : undefined,
  ].filter((v) => v != null && v !== "").length;

  // ---- Build filter state for design components ----

  const filterState: FilterState = {
    q,
    scheduleFilter,
    llmFilter,
    priceMin,
    priceMax,
    costMin,
    costMax,
    responsesMin,
    responsesMax,
    g2Min,
    g2Max,
    trustpilotMin,
    trustpilotMax,
    trustradiusMin,
    trustradiusMax,
    capterraMin,
    capterraMax,
    locationType,
  };

  // ---- Render ----

  const DesignComponent = DESIGN_COMPONENTS[activeDesign];

  return (
    <div>
      {/* Design Toggle */}
      <DesignToggle
        active={activeDesign}
        onChange={(key) => {
          updateSearch({ design: key === "table" ? undefined : key });
        }}
      />

      {/* Active Design */}
      <DesignComponent
        plans={filteredPlans}
        allPlans={allPlans}
        companies={companies}
        selectedPlans={selectedPlans}
        onTogglePlan={togglePlan}
        onCompare={handleCompare}
        onEditPlan={(plan) => {
          setEditingPlan(plan);
        }}
        onAddCompany={() => {
          setAddingCompany(true);
        }}
        sortBy={sortBy}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        visibleColumns={visibleColumns}
        onColumnsChange={(cols) => {
          updateSearch({ cols });
        }}
        filters={filterState}
        updateSearch={(patch) => {
          updateSearch(patch as SearchPatch);
        }}
        activeFilterCount={activeFilterCount}
      />

      {/* Modals (shared across all designs) */}
      {editingPlan && (
        <EditPlanModal
          companySlug={editingPlan.companySlug}
          companyName={editingPlan.companyName}
          planSlug={editingPlan.slug}
          planName={editingPlan.name}
          plan={editingPlan}
          onClose={() => {
            setEditingPlan(null);
          }}
        />
      )}

      {addingCompany && (
        <AddCompanyModal
          onClose={() => {
            setAddingCompany(false);
          }}
        />
      )}
    </div>
  );
}
