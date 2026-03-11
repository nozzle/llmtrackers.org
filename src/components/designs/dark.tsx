import { Link } from "@tanstack/react-router";
import { CompanyMark } from "~/components/company-mark";
import { LlmIcon } from "~/components/llm-icon";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import {
  type DesignProps,
  LLM_KEYS,
  formatPrice,
  formatLocation,
  getReviewSiteScore,
  planKey,
} from "./design-props";

// ---------------------------------------------------------------------------
// Dark Design
// Sleek dark-mode SaaS table: deep charcoal background, subtle gradients,
// high-contrast text, modern rounded containers, purple/blue accent colour.
// Fully sortable with animated sort indicators.
// ---------------------------------------------------------------------------

const SORTABLE_COLS: readonly { id: string; label: string; align: string; sortable?: boolean }[] = [
  { id: "name", label: "Company", align: "text-left" },
  { id: "plan", label: "Plan", align: "text-left", sortable: false },
  { id: "price", label: "Price/mo", align: "text-right" },
  { id: "costEfficiency", label: "$/1K Resp.", align: "text-right" },
  { id: "responses", label: "AI Resp./mo", align: "text-right" },
  { id: "g2", label: "G2", align: "text-center" },
  { id: "trustpilot", label: "Trustpilot", align: "text-center" },
  { id: "trustradius", label: "TrustRadius", align: "text-center" },
  { id: "capterra", label: "Capterra", align: "text-center" },
  { id: "schedule", label: "Schedule", align: "text-center", sortable: false },
  { id: "llms", label: "LLMs", align: "text-left", sortable: false },
  { id: "location", label: "Locations", align: "text-center", sortable: false },
];

function SortIcon({ active, dir }: { active: boolean; dir: string }) {
  if (!active) {
    return (
      <svg className="ml-1 inline h-3 w-3 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
      </svg>
    );
  }
  return (
    <svg className="ml-1 inline h-3 w-3 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      {dir === "asc" ? <path d="M8 15l4-4 4 4" /> : <path d="M8 9l4 4 4-4" />}
    </svg>
  );
}

function ScorePill({ value, max }: { value: number | null; max: number }) {
  if (value == null) return <span className="text-neutral-600">—</span>;
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 80 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400";
  return <span className={`tabular-nums ${color}`}>{value.toFixed(1)}</span>;
}

export function DarkDesign(props: DesignProps) {
  const {
    plans,
    allPlans,
    companies,
    selectedPlans,
    onTogglePlan,
    onCompare,
    onAddCompany,
    sortBy,
    sortDir,
    onToggleSort,
    filters,
    updateSearch,
    activeFilterCount,
  } = props;

  return (
    <div
      className="-mx-4 -my-8 min-h-screen bg-[#0f0f13] px-4 py-8 text-neutral-200 sm:-mx-6 lg:-mx-8"
      style={{ fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="mx-auto max-w-[1500px]">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              LLM Trackers
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {plans.length} of {allPlans.length} plans &middot; {companies.length} companies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAddCompany}
              className="cursor-pointer rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white"
            >
              + Add Company
            </button>
            {selectedPlans.size >= 2 && (
              <button
                type="button"
                onClick={onCompare}
                className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500"
              >
                Compare {selectedPlans.size} Plans
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-[#16161d] p-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              placeholder="Search companies…"
              className="rounded-lg border border-neutral-700 bg-neutral-900 py-2 pl-9 pr-4 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-violet-500"
              style={{ width: 220 }}
            />
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-neutral-700" />

          {/* LLM toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            {LLM_KEYS.map((key) => {
              const active = filters.llmFilter.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? filters.llmFilter.filter((k) => k !== key)
                      : [...filters.llmFilter, key];
                    updateSearch({ llms: next.length > 0 ? next : undefined });
                  }}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    active
                      ? "bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/50"
                      : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                  }`}
                >
                  {LLM_MODEL_LABELS[key]}
                </button>
              );
            })}
          </div>

          {activeFilterCount > 0 && (
            <>
              <div className="h-6 w-px bg-neutral-700" />
              <button
                type="button"
                onClick={() => {
                  updateSearch({
                    q: undefined, schedule: undefined, llms: undefined,
                    priceMin: undefined, priceMax: undefined,
                    costMin: undefined, costMax: undefined,
                    responsesMin: undefined, responsesMax: undefined,
                    g2Min: undefined, g2Max: undefined,
                    trustpilotMin: undefined, trustpilotMax: undefined,
                    trustradiusMin: undefined, trustradiusMax: undefined,
                    capterraMin: undefined, capterraMax: undefined,
                    locationType: undefined,
                  });
                }}
                className="cursor-pointer rounded-md px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
              >
                Clear all ({activeFilterCount})
              </button>
            </>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-[#16161d]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="w-10 py-3 pl-4 text-left">
                  <div className="h-4 w-4 rounded border border-neutral-600" />
                </th>
                {SORTABLE_COLS.map((col) => {
                  const canSort = col.sortable !== false;
                  const isActive = sortBy === col.id;
                  return (
                    <th
                      key={col.id}
                      onClick={canSort ? () => { onToggleSort(col.id); } : undefined}
                      className={`py-3 px-3 text-xs font-medium uppercase tracking-wider ${col.align} ${
                        isActive ? "text-violet-400" : "text-neutral-500"
                      } ${canSort ? "cursor-pointer select-none transition-colors hover:text-neutral-300" : ""}`}
                    >
                      {col.label}
                      {canSort && <SortIcon active={isActive} dir={sortDir} />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const key = planKey(plan);
                const isSelected = selectedPlans.has(key);
                const g2 = getReviewSiteScore(plan, "g2");
                const tp = getReviewSiteScore(plan, "trustpilot");
                const tr = getReviewSiteScore(plan, "trustradius");
                const cap = getReviewSiteScore(plan, "capterra");

                return (
                  <tr
                    key={key}
                    onClick={() => { onTogglePlan(key); }}
                    className={`cursor-pointer border-b border-neutral-800/50 transition-colors ${
                      isSelected
                        ? "bg-violet-600/10"
                        : "hover:bg-[#1c1c26]"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 pl-4">
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? "border-violet-500 bg-violet-600"
                            : "border-neutral-600 hover:border-neutral-400"
                        }`}
                      >
                        {isSelected && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </td>
                    {/* Company */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                        <Link
                          to="/companies/$slug"
                          params={{ slug: plan.companySlug }}
                          className="text-sm font-medium text-white hover:text-violet-400"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          {plan.companyName}
                        </Link>
                      </div>
                    </td>
                    {/* Plan */}
                    <td className="px-3 py-3 text-sm text-neutral-400">{plan.name}</td>
                    {/* Price */}
                    <td className="px-3 py-3 text-right text-sm font-medium tabular-nums text-white">
                      {formatPrice(plan)}
                    </td>
                    {/* Cost Efficiency */}
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-neutral-400">
                      {plan.pricePer1000Responses != null ? `$${plan.pricePer1000Responses.toFixed(2)}` : "—"}
                    </td>
                    {/* Responses */}
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-neutral-400">
                      {plan.aiResponsesMonthly != null ? plan.aiResponsesMonthly.toLocaleString() : "—"}
                    </td>
                    {/* Review scores */}
                    <td className="px-3 py-3 text-center text-sm">
                      <ScorePill value={g2} max={5} />
                    </td>
                    <td className="px-3 py-3 text-center text-sm">
                      <ScorePill value={tp} max={5} />
                    </td>
                    <td className="px-3 py-3 text-center text-sm">
                      <ScorePill value={tr} max={10} />
                    </td>
                    <td className="px-3 py-3 text-center text-sm">
                      <ScorePill value={cap} max={5} />
                    </td>
                    {/* Schedule */}
                    <td className="px-3 py-3 text-center text-xs text-neutral-500">{plan.schedule}</td>
                    {/* LLMs */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                          <LlmIcon key={k} model={k} size={14} />
                        ))}
                      </div>
                    </td>
                    {/* Location */}
                    <td className="px-3 py-3 text-center text-xs text-neutral-500">
                      {formatLocation(plan.locationSupport)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {plans.length === 0 && (
            <div className="py-16 text-center text-sm text-neutral-600">
              No matching plans found. Adjust your filters.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 text-right text-xs text-neutral-600">
          Showing {plans.length} of {allPlans.length} plans
        </div>
      </div>
    </div>
  );
}
