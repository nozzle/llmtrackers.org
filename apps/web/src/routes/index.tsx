import { useState, useMemo, useRef, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getAllCompanies, getAllPlansWithCompany } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import { LlmIcon } from "~/components/llm-icon";
import { ReviewSiteMiniList, ReviewSiteScoreBadge } from "~/components/review-site-badge";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import type { LlmModelKey, PlanWithCompany, ReviewSitePlatform } from "@llm-tracker/shared";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Search schema — URL is the source of truth for filters, sort, columns
// ---------------------------------------------------------------------------

const optionalNumber = z.coerce.number().optional().catch(undefined);

const homeSearchSchema = z.object({
  // text search
  q: z.string().optional().catch(undefined),

  // sort
  sort: z
    .enum([
      "name",
      "score",
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
  scoreMin: optionalNumber,
  scoreMax: optionalNumber,
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
  locationType: z
    .enum(["all", "global", "regional"])
    .optional()
    .catch(undefined),

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

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: homeSearchSchema,
  head: () => ({
    meta: [
      {
        title:
          "LLM Tracker Comparison - Compare AI Search Visibility Tools",
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
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(plan: PlanWithCompany): string {
  if (plan.price.amount === null) return "Custom";
  const formatted = `$${plan.price.amount.toLocaleString()}`;
  return plan.price.note ? `${formatted}*` : formatted;
}

function formatLocation(loc: string | number): string {
  if (loc === "global") return "Global";
  return `${loc} regions`;
}

function getReviewSiteScore(
  plan: PlanWithCompany & {
    companyReviewSites?: Partial<Record<ReviewSitePlatform, { score?: number | null }>>;
  },
  platform: ReviewSitePlatform
): number | null {
  return plan.companyReviewSites?.[platform]?.score ?? null;
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

// All data column ids (checkbox is not a data column)
const ALL_COLUMN_IDS = [
  "name",
  "score",
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

type ColumnId = (typeof ALL_COLUMN_IDS)[number];

const COLUMN_LABELS: Record<ColumnId, string> = {
  name: "Company / Plan",
  score: "Score",
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

// ---------------------------------------------------------------------------
// Reusable small components
// ---------------------------------------------------------------------------

function NumberRangeFilter({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  placeholderMin = "Min",
  placeholderMax = "Max",
}: {
  minValue: number | undefined;
  maxValue: number | undefined;
  onMinChange: (v: number | undefined) => void;
  onMaxChange: (v: number | undefined) => void;
  placeholderMin?: string;
  placeholderMax?: string;
}) {
  return (
    <div className="flex gap-1">
      <input
        type="number"
        placeholder={placeholderMin}
        value={minValue ?? ""}
        onChange={(e) =>
          onMinChange(e.target.value ? Number(e.target.value) : undefined)
        }
        className="w-18 rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
      <input
        type="number"
        placeholder={placeholderMax}
        value={maxValue ?? ""}
        onChange={(e) =>
          onMaxChange(e.target.value ? Number(e.target.value) : undefined)
        }
        className="w-18 rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function LlmMultiSelect({
  selected,
  onChange,
}: {
  selected: LlmModelKey[];
  onChange: (v: LlmModelKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(key: LlmModelKey) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded border border-gray-300 px-1.5 py-1 text-left text-xs focus:border-blue-500 focus:outline-none"
      >
        {selected.length === 0
          ? "All"
          : `${selected.length} selected`}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-48 w-40 overflow-auto rounded border border-gray-200 bg-white shadow-lg">
          {LLM_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={() => toggle(key)}
                className="h-3 w-3 rounded border-gray-300 text-blue-600"
              />
              <LlmIcon model={key} size={14} />
              {LLM_MODEL_LABELS[key]}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full border-t border-gray-100 px-2 py-1 text-left text-xs text-gray-500 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ColumnVisibilityPicker({
  visibleColumns,
  onChange,
}: {
  visibleColumns: ColumnId[];
  onChange: (v: ColumnId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allVisible = visibleColumns.length === ALL_COLUMN_IDS.length;

  function toggleColumn(id: ColumnId) {
    if (visibleColumns.includes(id)) {
      // Don't allow hiding all columns — keep at least "name"
      const next = visibleColumns.filter((c) => c !== id);
      if (next.length === 0) return;
      onChange(next);
    } else {
      // Insert in canonical order
      const next = ALL_COLUMN_IDS.filter(
        (c) => visibleColumns.includes(c) || c === id
      ) as unknown as ColumnId[];
      onChange(next);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
      >
        <svg
          className="h-4 w-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        Columns
        {!allVisible && (
          <span className="rounded-full bg-blue-100 px-1.5 text-xs text-blue-700">
            {visibleColumns.length}/{ALL_COLUMN_IDS.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-3 py-2">
            <button
              type="button"
              onClick={() =>
                onChange(allVisible ? ["name"] : [...ALL_COLUMN_IDS])
              }
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {allVisible ? "Hide all" : "Show all"}
            </button>
          </div>
          {ALL_COLUMN_IDS.map((id) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(id)}
                onChange={() => toggleColumn(id)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
              />
              {COLUMN_LABELS[id]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function HomePage() {
  const allPlans = getAllPlansWithCompany();
  const companies = getAllCompanies();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());

  // ---- Derived search state with defaults ----

  const q = search.q ?? "";
  const sortBy = search.sort ?? "score";
  const sortDir = search.dir ?? (sortBy === "name" ? "asc" : "desc");
  const scheduleFilter = search.schedule ?? "all";
  const llmFilter: LlmModelKey[] =
    (parseCommaSeparated(search.llms) as LlmModelKey[] | undefined) ?? [];
  const scoreMin = search.scoreMin;
  const scoreMax = search.scoreMax;
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
  const visibleColumns: ColumnId[] =
    (parseCommaSeparated(search.cols) as ColumnId[] | undefined) ?? [
      ...ALL_COLUMN_IDS,
    ];

  // ---- Navigate helper — omits defaults to keep URLs clean ----

  // Internal patch type that accepts arrays for llms/cols convenience
  type SearchPatch = Omit<Partial<HomeSearch>, "llms" | "cols"> & {
    llms?: LlmModelKey[] | undefined;
    cols?: ColumnId[] | undefined;
  };

  function updateSearch(patch: SearchPatch) {
    navigate({
      to: "/",
      search: (prev: HomeSearch) => {
        // Merge, converting array fields to comma strings
        const next: HomeSearch = { ...prev };
        for (const [k, v] of Object.entries(patch)) {
          (next as Record<string, unknown>)[k] = v;
        }

        // Clean up defaults so they don't appear in the URL
        const cleaned: Record<string, unknown> = {};

        if (next.q) cleaned.q = next.q;
        if (next.sort && next.sort !== "score") cleaned.sort = next.sort;
        if (next.dir) {
          const naturalDir =
            (next.sort ?? "score") === "name" ? "asc" : "desc";
          if (next.dir !== naturalDir) cleaned.dir = next.dir;
        }
        if (next.schedule && next.schedule !== "all")
          cleaned.schedule = next.schedule;

        // llms — could be string (from prev) or array (from patch)
        const llmsVal = next.llms;
        const llmsStr = Array.isArray(llmsVal)
          ? llmsVal.join(",")
          : llmsVal;
        if (llmsStr) cleaned.llms = llmsStr;

        if (next.scoreMin != null) cleaned.scoreMin = next.scoreMin;
        if (next.scoreMax != null) cleaned.scoreMax = next.scoreMax;
        if (next.priceMin != null) cleaned.priceMin = next.priceMin;
        if (next.priceMax != null) cleaned.priceMax = next.priceMax;
        if (next.costMin != null) cleaned.costMin = next.costMin;
        if (next.costMax != null) cleaned.costMax = next.costMax;
        if (next.responsesMin != null)
          cleaned.responsesMin = next.responsesMin;
        if (next.responsesMax != null)
          cleaned.responsesMax = next.responsesMax;
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
        const colsArr = Array.isArray(colsVal)
          ? colsVal
          : parseCommaSeparated(colsVal as string | undefined);
        if (colsArr && colsArr.length !== ALL_COLUMN_IDS.length) {
          cleaned.cols = colsArr.join(",");
        }

        return cleaned as HomeSearch;
      },
      replace: true,
    });
  }

  // ---- Company score map ----

  const companyScores = useMemo(() => {
    const map = new Map<string, { total: number; maxTotal: number }>();
    for (const c of companies) {
      if (c.score) map.set(c.slug, c.score);
    }
    return map;
  }, [companies]);

  // ---- Filter & sort ----

  const filteredPlans = useMemo(() => {
    let result = allPlans;

    // Text search
    if (q) {
      const lower = q.toLowerCase();
      result = result.filter(
        (p) =>
          p.companyName.toLowerCase().includes(lower) ||
          p.name.toLowerCase().includes(lower)
      );
    }

    // Schedule
    if (scheduleFilter !== "all") {
      result = result.filter((p) => p.schedule === scheduleFilter);
    }

    // LLM multi-select (match ANY)
    if (llmFilter.length > 0) {
      result = result.filter((p) =>
        llmFilter.some((k) => p.llmSupport[k])
      );
    }

    // Score
    if (scoreMin != null || scoreMax != null) {
      result = result.filter((p) => {
        const s = companyScores.get(p.companySlug);
        if (!s) return false;
        if (scoreMin != null && s.total < scoreMin) return false;
        if (scoreMax != null && s.total > scoreMax) return false;
        return true;
      });
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

    const reviewSiteRanges: Array<{
      platform: ReviewSitePlatform;
      min: number | undefined;
      max: number | undefined;
    }> = [
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
          cmp =
            (a.aiResponsesMonthly ?? 0) - (b.aiResponsesMonthly ?? 0);
          break;
        case "score":
          cmp =
            (companyScores.get(a.companySlug)?.total ?? 0) -
            (companyScores.get(b.companySlug)?.total ?? 0);
          break;
        case "g2":
        case "trustpilot":
        case "trustradius":
        case "capterra":
          cmp =
            (getReviewSiteScore(a, sortBy) ?? -1) -
            (getReviewSiteScore(b, sortBy) ?? -1);
          break;
        case "name":
          cmp = a.companyName.localeCompare(b.companyName);
          break;
        case "costEfficiency":
          cmp =
            (a.pricePer1000Responses ?? 999) -
            (b.pricePer1000Responses ?? 999);
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
    companyScores,
    scoreMin,
    scoreMax,
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
    navigate({ to: "/compare", search: { plans } });
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      const newDir = sortDir === "asc" ? "desc" : "asc";
      updateSearch({ dir: newDir });
    } else {
      updateSearch({
        sort: column as HomeSearch["sort"],
        dir: undefined, // let the natural default kick in
      });
    }
  }

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  };

  const isColumnVisible = (id: ColumnId) => visibleColumns.includes(id);

  // Count active filters for the "clear filters" hint
  const activeFilterCount = [
    q,
    scheduleFilter !== "all" ? scheduleFilter : undefined,
    llmFilter.length > 0 ? "llm" : undefined,
    scoreMin,
    scoreMax,
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          AI Search Visibility Tool Comparison
        </h1>
        <p className="mt-2 text-gray-600">
          Compare {companies.length} LLM tracking tools across{" "}
          {allPlans.length} plans. Select plans to compare side-by-side.
        </p>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {selectedPlans.size >= 2 && (
          <button
            onClick={handleCompare}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Compare {selectedPlans.size} Plans
          </button>
        )}

        {selectedPlans.size > 0 && (
          <button
            onClick={() => setSelectedPlans(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              onClick={() =>
                updateSearch({
                  q: undefined,
                  schedule: undefined,
                  llms: undefined,
                  scoreMin: undefined,
                  scoreMax: undefined,
                  priceMin: undefined,
                  priceMax: undefined,
                  costMin: undefined,
                  costMax: undefined,
                  responsesMin: undefined,
                  responsesMax: undefined,
                  g2Min: undefined,
                  g2Max: undefined,
                  trustpilotMin: undefined,
                  trustpilotMax: undefined,
                  trustradiusMin: undefined,
                  trustradiusMax: undefined,
                  capterraMin: undefined,
                  capterraMax: undefined,
                  locationType: undefined,
                })
              }
              className="text-sm text-red-500 hover:text-red-700"
            >
              Clear {activeFilterCount} filter
              {activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
          <ColumnVisibilityPicker
            visibleColumns={visibleColumns}
            onChange={(cols) => updateSearch({ cols })}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {/* Header labels row */}
            <tr>
              <th className="sticky left-0 z-10 w-10 bg-gray-50 px-3 py-3">
                <span className="sr-only">Select</span>
              </th>
              {isColumnVisible("name") && (
                <th
                  className="sticky left-10 z-10 cursor-pointer bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("name")}
                >
                  Company / Plan{sortIndicator("name")}
                </th>
              )}
              {isColumnVisible("score") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("score")}
                >
                  Score{sortIndicator("score")}
                </th>
              )}
              {isColumnVisible("g2") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("g2")}
                >
                  G2{sortIndicator("g2")}
                </th>
              )}
              {isColumnVisible("trustpilot") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("trustpilot")}
                >
                  Trustpilot{sortIndicator("trustpilot")}
                </th>
              )}
              {isColumnVisible("trustradius") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("trustradius")}
                >
                  TrustRadius{sortIndicator("trustradius")}
                </th>
              )}
              {isColumnVisible("capterra") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("capterra")}
                >
                  Capterra{sortIndicator("capterra")}
                </th>
              )}
              {isColumnVisible("price") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("price")}
                >
                  Price/mo{sortIndicator("price")}
                </th>
              )}
              {isColumnVisible("costEfficiency") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("costEfficiency")}
                >
                  $/1K Resp.{sortIndicator("costEfficiency")}
                </th>
              )}
              {isColumnVisible("responses") && (
                <th
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                  onClick={() => toggleSort("responses")}
                >
                  AI Resp./mo{sortIndicator("responses")}
                </th>
              )}
              {isColumnVisible("schedule") && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Schedule
                </th>
              )}
              {isColumnVisible("llmSupport") && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  LLM Support
                </th>
              )}
              {isColumnVisible("locations") && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Locations
                </th>
              )}
            </tr>

            {/* Filter row */}
            <tr className="bg-gray-50">
              {/* Checkbox col — no filter */}
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2" />

              {/* Company / Plan — text search */}
              {isColumnVisible("name") && (
                <th className="sticky left-10 z-10 bg-gray-50 px-4 py-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={q}
                    onChange={(e) =>
                      updateSearch({ q: e.target.value || undefined })
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  />
                </th>
              )}

              {/* Score — min/max */}
              {isColumnVisible("score") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={scoreMin}
                    maxValue={scoreMax}
                    onMinChange={(v) => updateSearch({ scoreMin: v })}
                    onMaxChange={(v) => updateSearch({ scoreMax: v })}
                  />
                </th>
              )}
              {isColumnVisible("g2") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={g2Min}
                    maxValue={g2Max}
                    onMinChange={(v) => updateSearch({ g2Min: v })}
                    onMaxChange={(v) => updateSearch({ g2Max: v })}
                  />
                </th>
              )}
              {isColumnVisible("trustpilot") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={trustpilotMin}
                    maxValue={trustpilotMax}
                    onMinChange={(v) => updateSearch({ trustpilotMin: v })}
                    onMaxChange={(v) => updateSearch({ trustpilotMax: v })}
                  />
                </th>
              )}
              {isColumnVisible("trustradius") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={trustradiusMin}
                    maxValue={trustradiusMax}
                    onMinChange={(v) => updateSearch({ trustradiusMin: v })}
                    onMaxChange={(v) => updateSearch({ trustradiusMax: v })}
                  />
                </th>
              )}
              {isColumnVisible("capterra") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={capterraMin}
                    maxValue={capterraMax}
                    onMinChange={(v) => updateSearch({ capterraMin: v })}
                    onMaxChange={(v) => updateSearch({ capterraMax: v })}
                  />
                </th>
              )}

              {/* Price — min/max */}
              {isColumnVisible("price") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={priceMin}
                    maxValue={priceMax}
                    onMinChange={(v) => updateSearch({ priceMin: v })}
                    onMaxChange={(v) => updateSearch({ priceMax: v })}
                  />
                </th>
              )}

              {/* Cost efficiency — min/max */}
              {isColumnVisible("costEfficiency") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={costMin}
                    maxValue={costMax}
                    onMinChange={(v) => updateSearch({ costMin: v })}
                    onMaxChange={(v) => updateSearch({ costMax: v })}
                  />
                </th>
              )}

              {/* AI Responses — min/max */}
              {isColumnVisible("responses") && (
                <th className="px-4 py-2">
                  <NumberRangeFilter
                    minValue={responsesMin}
                    maxValue={responsesMax}
                    onMinChange={(v) => updateSearch({ responsesMin: v })}
                    onMaxChange={(v) => updateSearch({ responsesMax: v })}
                  />
                </th>
              )}

              {/* Schedule — select */}
              {isColumnVisible("schedule") && (
                <th className="px-4 py-2">
                  <select
                    value={scheduleFilter}
                    onChange={(e) =>
                      updateSearch({
                        schedule:
                          e.target.value === "all"
                            ? undefined
                            : e.target.value,
                      })
                    }
                    className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </th>
              )}

              {/* LLM Support — multi-select */}
              {isColumnVisible("llmSupport") && (
                <th className="px-4 py-2">
                  <LlmMultiSelect
                    selected={llmFilter}
                    onChange={(v) =>
                      updateSearch({
                        llms: v.length > 0 ? v : undefined,
                      })
                    }
                  />
                </th>
              )}

              {/* Locations — select */}
              {isColumnVisible("locations") && (
                <th className="px-4 py-2">
                  <select
                    value={locationType}
                    onChange={(e) =>
                      updateSearch({
                        locationType:
                          e.target.value === "all"
                            ? undefined
                            : (e.target.value as "global" | "regional"),
                      })
                    }
                    className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All</option>
                    <option value="global">Global</option>
                    <option value="regional">Regional</option>
                  </select>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPlans.map((plan) => {
              const key = `${plan.companySlug}/${plan.slug}`;
              const isSelected = selectedPlans.has(key);
              const company = companies.find(
                (c) => c.slug === plan.companySlug
              );
              return (
                <tr
                  key={key}
                  className={`${isSelected ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors`}
                >
                  <td
                    className={`sticky left-0 z-10 px-3 py-3 ${isSelected ? "bg-blue-50" : "bg-white"}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlan(key)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  {isColumnVisible("name") && (
                    <td
                      className={`sticky left-10 z-10 px-4 py-3 ${isSelected ? "bg-blue-50" : "bg-white"}`}
                    >
                      <div className="flex items-center gap-3">
                        <CompanyMark
                          slug={plan.companySlug}
                          name={plan.companyName}
                          size="sm"
                        />
                        <div>
                          <Link
                            to="/companies/$slug"
                            params={{ slug: plan.companySlug }}
                            className="font-medium text-blue-600 hover:text-blue-800"
                          >
                            {plan.companyName}
                          </Link>
                          <span className="ml-2 text-sm text-gray-500">
                            {plan.name}
                          </span>
                        </div>
                      </div>
                    </td>
                  )}
                  {isColumnVisible("score") && (
                    <td className="px-4 py-3">
                      {company?.score ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          {company.score.total}/{company.score.maxTotal}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                        )}
                    </td>
                  )}
                  {isColumnVisible("g2") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="g2"
                        score={getReviewSiteScore(plan, "g2")}
                        maxScore={plan.companyReviewSites?.g2?.maxScore ?? 5}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("trustpilot") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="trustpilot"
                        score={getReviewSiteScore(plan, "trustpilot")}
                        maxScore={plan.companyReviewSites?.trustpilot?.maxScore ?? 5}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("trustradius") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="trustradius"
                        score={getReviewSiteScore(plan, "trustradius")}
                        maxScore={plan.companyReviewSites?.trustradius?.maxScore ?? 10}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("capterra") && (
                    <td className="px-4 py-3">
                      <ReviewSiteScoreBadge
                        platform="capterra"
                        score={getReviewSiteScore(plan, "capterra")}
                        maxScore={plan.companyReviewSites?.capterra?.maxScore ?? 5}
                        compact
                      />
                    </td>
                  )}
                  {isColumnVisible("price") && (
                    <td className="px-4 py-3 text-sm font-medium">
                      {formatPrice(plan)}
                      {plan.price.note && (
                        <div className="text-xs text-gray-400">
                          {plan.price.note}
                        </div>
                      )}
                    </td>
                  )}
                  {isColumnVisible("costEfficiency") && (
                    <td className="px-4 py-3 text-sm">
                      {plan.pricePer1000Responses != null
                        ? `$${plan.pricePer1000Responses.toFixed(2)}`
                        : "-"}
                    </td>
                  )}
                  {isColumnVisible("responses") && (
                    <td className="px-4 py-3 text-sm">
                      {plan.aiResponsesMonthly != null
                        ? plan.aiResponsesMonthly.toLocaleString()
                        : "-"}
                    </td>
                  )}
                  {isColumnVisible("schedule") && (
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          plan.schedule === "daily"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {plan.schedule}
                      </span>
                    </td>
                  )}
                  {isColumnVisible("llmSupport") && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map(
                          (k) => (
                            <LlmIcon key={k} model={k} size={18} />
                          )
                        )}
                      </div>
                      <div className="mt-2">
                        <ReviewSiteMiniList reviewSites={plan.companyReviewSites ?? {}} />
                      </div>
                    </td>
                  )}
                  {isColumnVisible("locations") && (
                    <td className="px-4 py-3 text-sm">
                      {formatLocation(plan.locationSupport)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredPlans.length === 0 && (
        <div className="mt-8 text-center text-gray-500">
          No plans match your filters. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
}
