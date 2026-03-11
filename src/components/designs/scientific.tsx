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
// Scientific Design
// Academic paper / LaTeX aesthetic: Computer Modern-style serif fonts,
// numbered sections, figure-like tables with captions, footnotes, two-column
// abstract header. Sortable table styled as a publication-grade data table.
// ---------------------------------------------------------------------------

const SORTABLE_COLS: readonly { id: string; label: string; align: string; sortable?: boolean }[] = [
  { id: "name", label: "Vendor", align: "text-left" },
  { id: "plan", label: "Tier", align: "text-left", sortable: false },
  { id: "price", label: "Monthly Cost ($)", align: "text-right" },
  { id: "costEfficiency", label: "$/1K Resp.", align: "text-right" },
  { id: "responses", label: "AI Resp./mo", align: "text-right" },
  { id: "g2", label: "G2", align: "text-center" },
  { id: "trustpilot", label: "TP", align: "text-center" },
  { id: "trustradius", label: "TR", align: "text-center" },
  { id: "capterra", label: "Cap.", align: "text-center" },
  { id: "schedule", label: "Cadence", align: "text-center", sortable: false },
  { id: "llms", label: "Models", align: "text-left", sortable: false },
  { id: "location", label: "Geo.", align: "text-center", sortable: false },
];

function sortMark(sortBy: string, sortDir: string, col: string): string {
  if (sortBy !== col) return "";
  return sortDir === "asc" ? " ▲" : " ▼";
}

export function ScientificDesign(props: DesignProps) {
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
      className="-mx-4 -my-8 min-h-screen bg-[#fffff8] px-6 py-10 text-[#1a1a1a] sm:-mx-6 lg:-mx-8"
      style={{ fontFamily: "'Computer Modern Serif', 'Latin Modern Roman', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif" }}
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Title block (like a paper title) */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold italic">
            A Comparative Analysis of LLM Search Visibility Tracking Platforms
          </h1>
          <p className="mt-2 text-sm">
            LLMTrackers.org Consortium
          </p>
          <p className="mt-1 text-xs italic text-neutral-500">
            Dataset: {allPlans.length} plans, {companies.length} vendors — Updated 2025
          </p>
        </div>

        {/* Abstract-style intro */}
        <div className="mx-auto mb-8 max-w-[700px] border-t border-b border-neutral-300 py-4">
          <p className="text-center text-xs font-bold uppercase tracking-widest">Abstract</p>
          <p className="mt-2 text-justify text-sm leading-relaxed">
            This document presents a structured comparison of AI search visibility and LLM
            tracking tools. Data is presented in tabular form below. Column headers marked
            with ▲/▼ may be clicked to re-sort. Use the query controls in §1 to constrain
            the result set.
          </p>
        </div>

        {/* §1 Query Controls */}
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-bold">
            <span className="mr-2">§1</span>Query Parameters
          </h2>
          <div className="flex flex-wrap items-center gap-4 rounded border border-neutral-200 bg-[#fafaf5] p-4">
            {/* Search */}
            <div className="flex items-center gap-2">
              <label className="text-xs italic">Keyword:</label>
              <input
                type="text"
                value={filters.q}
                onChange={(e) => {
                  updateSearch({ q: e.target.value || undefined });
                }}
                className="border border-neutral-300 bg-white px-2 py-1 text-sm outline-none focus:border-neutral-500"
                style={{ width: 160, fontFamily: "inherit" }}
              />
            </div>

            {/* LLM toggles */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs italic">Models:</span>
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
                    className={`cursor-pointer border px-2 py-0.5 text-xs transition-colors ${
                      active
                        ? "border-[#1a1a1a] bg-[#1a1a1a] text-white"
                        : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-500"
                    }`}
                    style={{ fontFamily: "inherit" }}
                  >
                    {LLM_MODEL_LABELS[key]}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="ml-auto flex items-center gap-3">
              {activeFilterCount > 0 && (
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
                  className="cursor-pointer text-xs italic text-red-700 underline"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={onAddCompany}
                className="cursor-pointer text-xs italic text-neutral-500 underline hover:text-black"
              >
                [Add Vendor]
              </button>
              {selectedPlans.size >= 2 && (
                <button
                  type="button"
                  onClick={onCompare}
                  className="cursor-pointer border border-black bg-black px-3 py-1 text-xs text-white"
                  style={{ fontFamily: "inherit" }}
                >
                  Compare ({selectedPlans.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* §2 Data Table */}
        <div className="mb-4">
          <h2 className="mb-3 text-lg font-bold">
            <span className="mr-2">§2</span>Results
          </h2>
        </div>

        {/* Table caption (above) */}
        <p className="mb-2 text-center text-xs italic text-neutral-500">
          Table 1: Comparative metrics for {plans.length} plan(s). Click column headers to sort.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {/* Double-rule top */}
            <thead>
              <tr className="border-t-2 border-b border-black">
                <th className="py-2 pr-1 text-left text-xs">#</th>
                {SORTABLE_COLS.map((col) => {
                  const canSort = col.sortable !== false;
                  return (
                    <th
                      key={col.id}
                      onClick={canSort ? () => { onToggleSort(col.id); } : undefined}
                      className={`py-2 px-2 text-xs font-bold ${col.align} ${
                        canSort ? "cursor-pointer select-none hover:bg-[#f0f0e8]" : ""
                      }`}
                    >
                      {col.label}{canSort ? sortMark(sortBy, sortDir, col.id) : ""}
                    </th>
                  );
                })}
              </tr>
              {/* Second rule */}
              <tr>
                <td colSpan={SORTABLE_COLS.length + 1} className="border-b border-black p-0" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan, idx) => {
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
                    className={`cursor-pointer border-b border-neutral-200 transition-colors ${
                      isSelected ? "bg-[#fffde0]" : "hover:bg-[#f8f8f0]"
                    }`}
                  >
                    <td className="py-1.5 pr-1 text-xs text-neutral-400">{idx + 1}</td>
                    {/* Vendor */}
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                        <Link
                          to="/companies/$slug"
                          params={{ slug: plan.companySlug }}
                          className="text-sm text-blue-800 underline"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          {plan.companyName}
                        </Link>
                        {isSelected && <span className="text-xs">✓</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-sm italic text-neutral-600">{plan.name}</td>
                    <td className="px-2 py-1.5 text-right text-sm tabular-nums">{formatPrice(plan)}</td>
                    <td className="px-2 py-1.5 text-right text-sm tabular-nums text-neutral-600">
                      {plan.pricePer1000Responses != null ? `$${plan.pricePer1000Responses.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-sm tabular-nums text-neutral-600">
                      {plan.aiResponsesMonthly != null ? plan.aiResponsesMonthly.toLocaleString() : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-center text-sm tabular-nums">{g2 != null ? g2.toFixed(1) : "—"}</td>
                    <td className="px-2 py-1.5 text-center text-sm tabular-nums">{tp != null ? tp.toFixed(1) : "—"}</td>
                    <td className="px-2 py-1.5 text-center text-sm tabular-nums">{tr != null ? tr.toFixed(1) : "—"}</td>
                    <td className="px-2 py-1.5 text-center text-sm tabular-nums">{cap != null ? cap.toFixed(1) : "—"}</td>
                    <td className="px-2 py-1.5 text-center text-xs">{plan.schedule}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                          <LlmIcon key={k} model={k} size={13} />
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs">{formatLocation(plan.locationSupport)}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Bottom double rule */}
            <tfoot>
              <tr>
                <td colSpan={SORTABLE_COLS.length + 1} className="border-t border-black p-0" />
              </tr>
              <tr>
                <td colSpan={SORTABLE_COLS.length + 1} className="border-t-2 border-black p-0" />
              </tr>
            </tfoot>
          </table>
        </div>

        {plans.length === 0 && (
          <div className="py-12 text-center text-sm italic text-neutral-400">
            No entries satisfy the given query parameters.
          </div>
        )}

        {/* Footnotes */}
        <div className="mt-6 border-t border-neutral-200 pt-4">
          <p className="text-xs text-neutral-500">
            <sup>†</sup> Prices marked with * include usage-based notes.
            Review scores sourced from respective platforms.
            n = {plans.length} (of {allPlans.length} total).
          </p>
        </div>
      </div>
    </div>
  );
}
