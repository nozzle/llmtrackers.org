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
// Minimal Design
// Ultra-clean Swiss/Scandinavian aesthetic: Helvetica-style type, hairline
// borders, generous whitespace, restrained colour palette (black, white,
// one accent). Fully sortable table with subtle hover states.
// ---------------------------------------------------------------------------

const SORTABLE_COLS: readonly { id: string; label: string; align: string; sortable?: boolean }[] = [
  { id: "name", label: "Company", align: "text-left" },
  { id: "plan", label: "Plan", align: "text-left", sortable: false },
  { id: "price", label: "Price", align: "text-right" },
  { id: "costEfficiency", label: "Cost/1K", align: "text-right" },
  { id: "responses", label: "Responses", align: "text-right" },
  { id: "g2", label: "G2", align: "text-center" },
  { id: "trustpilot", label: "Trustpilot", align: "text-center" },
  { id: "trustradius", label: "TrustRadius", align: "text-center" },
  { id: "capterra", label: "Capterra", align: "text-center" },
  { id: "schedule", label: "Schedule", align: "text-center", sortable: false },
  { id: "llms", label: "LLM Support", align: "text-left", sortable: false },
  { id: "location", label: "Locations", align: "text-center", sortable: false },
];

function sortIndicator(sortBy: string, sortDir: string, col: string): React.ReactNode {
  if (sortBy !== col) return null;
  return <span className="ml-1 text-black">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

export function MinimalDesign(props: DesignProps) {
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
      className="-mx-4 -my-8 min-h-screen bg-white px-6 py-10 sm:-mx-6 lg:-mx-8"
      style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <div className="mx-auto max-w-[1440px]">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-light tracking-tight text-black">LLM Trackers</h1>
          <p className="mt-2 text-sm font-light text-neutral-400">
            {allPlans.length} plans across {companies.length} companies
          </p>
        </header>

        {/* Filter bar */}
        <div className="mb-8 flex flex-wrap items-center gap-6 border-b border-neutral-100 pb-6">
          {/* Search */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              placeholder="Search…"
              className="border-b border-neutral-200 bg-transparent px-0 py-1 text-sm text-black outline-none transition-colors placeholder:text-neutral-300 focus:border-black"
              style={{ width: 200 }}
            />
          </div>

          {/* LLM filters */}
          <div className="flex items-center gap-2">
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
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-all ${
                    active
                      ? "border-black bg-black text-white"
                      : "border-neutral-200 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600"
                  }`}
                >
                  {LLM_MODEL_LABELS[key]}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-4">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  updateSearch({
                    q: undefined,
                    schedule: undefined,
                    llms: undefined,
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
                  });
                }}
                className="cursor-pointer text-xs text-neutral-400 underline underline-offset-2 transition-colors hover:text-black"
              >
                Clear filters
              </button>
            )}
            <button
              type="button"
              onClick={onAddCompany}
              className="cursor-pointer text-xs text-neutral-400 transition-colors hover:text-black"
            >
              + Add company
            </button>
            {selectedPlans.size >= 2 && (
              <button
                type="button"
                onClick={onCompare}
                className="cursor-pointer border border-black bg-black px-4 py-1.5 text-xs text-white transition-colors hover:bg-white hover:text-black"
              >
                Compare ({selectedPlans.size})
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="w-8 py-3 text-left" />
                {SORTABLE_COLS.map((col) => {
                  const canSort = col.sortable !== false;
                  return (
                    <th
                      key={col.id}
                      onClick={
                        canSort
                          ? () => {
                              onToggleSort(col.id);
                            }
                          : undefined
                      }
                      className={`py-3 px-3 text-[11px] font-normal uppercase tracking-widest text-neutral-400 ${col.align} ${
                        canSort
                          ? "cursor-pointer select-none transition-colors hover:text-black"
                          : ""
                      }`}
                    >
                      {col.label}
                      {canSort ? sortIndicator(sortBy, sortDir, col.id) : null}
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
                    onClick={() => {
                      onTogglePlan(key);
                    }}
                    className={`cursor-pointer border-b border-neutral-50 transition-colors ${
                      isSelected ? "bg-neutral-50" : "hover:bg-neutral-50/50"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 pl-1">
                      <div
                        className={`flex h-4 w-4 items-center justify-center border transition-colors ${
                          isSelected ? "border-black bg-black text-white" : "border-neutral-200"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
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
                          className="text-sm text-black underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {plan.companyName}
                        </Link>
                      </div>
                    </td>
                    {/* Plan */}
                    <td className="px-3 py-3 text-sm text-neutral-500">{plan.name}</td>
                    {/* Price */}
                    <td className="px-3 py-3 text-right text-sm tabular-nums">
                      {formatPrice(plan)}
                    </td>
                    {/* Cost */}
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-neutral-500">
                      {plan.pricePer1000Responses != null
                        ? `$${plan.pricePer1000Responses.toFixed(2)}`
                        : "—"}
                    </td>
                    {/* Responses */}
                    <td className="px-3 py-3 text-right text-sm tabular-nums text-neutral-500">
                      {plan.aiResponsesMonthly != null
                        ? plan.aiResponsesMonthly.toLocaleString()
                        : "—"}
                    </td>
                    {/* Review scores */}
                    <td className="px-3 py-3 text-center text-sm tabular-nums text-neutral-500">
                      {g2 != null ? g2.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-sm tabular-nums text-neutral-500">
                      {tp != null ? tp.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-sm tabular-nums text-neutral-500">
                      {tr != null ? tr.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-3 text-center text-sm tabular-nums text-neutral-500">
                      {cap != null ? cap.toFixed(1) : "—"}
                    </td>
                    {/* Schedule */}
                    <td className="px-3 py-3 text-center text-sm text-neutral-500">
                      {plan.schedule}
                    </td>
                    {/* LLMs */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                          <LlmIcon key={k} model={k} size={14} />
                        ))}
                      </div>
                    </td>
                    {/* Location */}
                    <td className="px-3 py-3 text-center text-xs text-neutral-400">
                      {formatLocation(plan.locationSupport)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {plans.length === 0 && (
          <div className="py-20 text-center text-sm text-neutral-300">No results found.</div>
        )}

        {/* Footer */}
        <footer className="mt-12 border-t border-neutral-100 pt-4 text-xs text-neutral-300">
          {plans.length} of {allPlans.length} plans shown
        </footer>
      </div>
    </div>
  );
}
