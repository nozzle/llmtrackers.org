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
// Retro OS Design
// Windows 95 / Classic Mac OS aesthetic: system bitmap fonts, sunken 3D
// borders, beveled header buttons, grey background, title bar with close
// button, status bar.  Fully sortable table with clickable column headers.
// ---------------------------------------------------------------------------

/** 3-D beveled border style for the Win95 look */
const BEVEL_OUT = "border-t-[#fff] border-l-[#fff] border-b-[#808080] border-r-[#808080]";
const BEVEL_IN = "border-t-[#808080] border-l-[#808080] border-b-[#fff] border-r-[#fff]";

const SORTABLE_COLS: readonly { id: string; label: string; align: string; sortable?: boolean }[] = [
  { id: "name", label: "Company", align: "text-left" },
  { id: "plan", label: "Plan", align: "text-left", sortable: false },
  { id: "price", label: "Price/mo", align: "text-right" },
  { id: "costEfficiency", label: "$/1K", align: "text-right" },
  { id: "responses", label: "Resp/mo", align: "text-right" },
  { id: "g2", label: "G2", align: "text-center" },
  { id: "trustpilot", label: "TP", align: "text-center" },
  { id: "trustradius", label: "TR", align: "text-center" },
  { id: "capterra", label: "Cap", align: "text-center" },
  { id: "schedule", label: "Sched", align: "text-center", sortable: false },
  { id: "llms", label: "LLMs", align: "text-left", sortable: false },
  { id: "location", label: "Loc", align: "text-center", sortable: false },
];

function sortArrow(sortBy: string, sortDir: string, col: string): string {
  if (sortBy !== col) return "";
  return sortDir === "asc" ? " \u25B2" : " \u25BC"; // ▲ ▼
}

export function RetroOsDesign(props: DesignProps) {
  const {
    plans,
    allPlans,
    companies,
    selectedPlans,
    onTogglePlan,
    onCompare,
    onEditPlan: _onEditPlan,
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
      className="-mx-4 -my-8 min-h-screen bg-[#008080] px-4 py-6 sm:-mx-6 lg:-mx-8"
      style={{ fontFamily: "'MS Sans Serif', 'Segoe UI', Tahoma, sans-serif" }}
    >
      <div className="mx-auto max-w-[1500px]">
        {/* ---- Window chrome ---- */}
        <div className={`border-2 ${BEVEL_OUT} bg-[#c0c0c0]`}>
          {/* Title bar */}
          <div className="flex items-center bg-gradient-to-r from-[#000080] to-[#1084d0] px-2 py-1">
            <span className="text-sm font-bold text-white">📊 LLM Trackers - Comparison Tool</span>
            <div className="ml-auto flex gap-1">
              <div
                className={`border ${BEVEL_OUT} h-4 w-4 bg-[#c0c0c0] text-center text-[10px] font-bold leading-4`}
              >
                _
              </div>
              <div
                className={`border ${BEVEL_OUT} h-4 w-4 bg-[#c0c0c0] text-center text-[10px] font-bold leading-4`}
              >
                □
              </div>
              <div
                className={`border ${BEVEL_OUT} h-4 w-4 bg-[#c0c0c0] text-center text-[10px] font-bold leading-4`}
              >
                ✕
              </div>
            </div>
          </div>

          {/* Menu bar */}
          <div className="flex gap-4 border-b border-[#808080] bg-[#c0c0c0] px-2 py-1 text-xs">
            <span className="cursor-pointer underline">File</span>
            <span className="cursor-pointer underline">Edit</span>
            <span className="cursor-pointer underline">View</span>
            <span className="cursor-pointer underline">Help</span>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#808080] bg-[#c0c0c0] px-2 py-1.5">
            <button
              type="button"
              onClick={onAddCompany}
              className={`cursor-pointer border-2 ${BEVEL_OUT} bg-[#c0c0c0] px-3 py-0.5 text-xs active:border-t-[#808080] active:border-l-[#808080] active:border-b-[#fff] active:border-r-[#fff]`}
            >
              New...
            </button>
            {selectedPlans.size >= 2 && (
              <button
                type="button"
                onClick={onCompare}
                className={`cursor-pointer border-2 ${BEVEL_OUT} bg-[#c0c0c0] px-3 py-0.5 text-xs active:border-t-[#808080] active:border-l-[#808080] active:border-b-[#fff] active:border-r-[#fff]`}
              >
                Compare ({selectedPlans.size})
              </button>
            )}

            <div className="mx-1 h-5 w-px bg-[#808080]" />

            {/* Search */}
            <span className="text-xs">Find:</span>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              className={`border-2 ${BEVEL_IN} bg-white px-2 py-0.5 text-xs outline-none`}
              style={{ width: 140 }}
            />

            <div className="mx-1 h-5 w-px bg-[#808080]" />

            {/* LLM toggles */}
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
                  className={`cursor-pointer border-2 px-1.5 py-0 text-[10px] ${
                    active ? `${BEVEL_IN} bg-[#e0e0e0] font-bold` : `${BEVEL_OUT} bg-[#c0c0c0]`
                  }`}
                >
                  {LLM_MODEL_LABELS[key]}
                </button>
              );
            })}

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
                className={`cursor-pointer border-2 ${BEVEL_OUT} bg-[#c0c0c0] px-2 py-0 text-[10px] text-red-700`}
              >
                Clear
              </button>
            )}
          </div>

          {/* ---- Table area (sunken) ---- */}
          <div className={`m-2 overflow-auto border-2 ${BEVEL_IN} bg-white`}>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {/* Checkbox col */}
                  <th
                    className={`border-r border-b border-[#808080] bg-[#c0c0c0] px-1 py-1 ${BEVEL_OUT} border-2`}
                    style={{ width: 28 }}
                  >
                    ☐
                  </th>
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
                        className={`border-2 ${BEVEL_OUT} bg-[#c0c0c0] px-2 py-1 ${col.align} text-[11px] font-bold ${
                          canSort
                            ? "cursor-pointer hover:bg-[#d4d0c8] active:border-t-[#808080] active:border-l-[#808080] active:border-b-[#fff] active:border-r-[#fff]"
                            : ""
                        }`}
                      >
                        {col.label}
                        {canSort ? sortArrow(sortBy, sortDir, col.id) : ""}
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
                      className={`cursor-pointer ${isSelected ? "bg-[#000080] text-white" : "hover:bg-[#e0e0e0]"}`}
                    >
                      <td className="border-r border-b border-[#c0c0c0] px-1 py-0.5 text-center">
                        {isSelected ? "☑" : "☐"}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5">
                        <div className="flex items-center gap-1">
                          <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                          <Link
                            to="/companies/$slug"
                            params={{ slug: plan.companySlug }}
                            className={
                              isSelected ? "text-[#ffff00] underline" : "text-[#0000ff] underline"
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {plan.companyName}
                          </Link>
                        </div>
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5">
                        {plan.name}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-right">
                        {formatPrice(plan)}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-right">
                        {plan.pricePer1000Responses != null
                          ? `$${plan.pricePer1000Responses.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-right">
                        {plan.aiResponsesMonthly != null
                          ? plan.aiResponsesMonthly.toLocaleString()
                          : "—"}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-center">
                        {g2 != null ? g2.toFixed(1) : "—"}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-center">
                        {tp != null ? tp.toFixed(1) : "—"}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-center">
                        {tr != null ? tr.toFixed(1) : "—"}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-center">
                        {cap != null ? cap.toFixed(1) : "—"}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5 text-center">
                        {plan.schedule}
                      </td>
                      <td className="border-r border-b border-[#c0c0c0] px-2 py-0.5">
                        <div className="flex flex-wrap gap-0.5">
                          {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                            <LlmIcon key={k} model={k} size={12} />
                          ))}
                        </div>
                      </td>
                      <td className="border-b border-[#c0c0c0] px-2 py-0.5 text-center text-[10px]">
                        {formatLocation(plan.locationSupport)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {plans.length === 0 && (
              <div className="py-10 text-center text-sm text-[#808080]">
                No items match. Try adjusting your search criteria.
              </div>
            )}
          </div>

          {/* ---- Status bar ---- */}
          <div className="flex gap-1 px-2 py-1">
            <div className={`flex-1 border-2 ${BEVEL_IN} bg-[#c0c0c0] px-2 py-0.5 text-[10px]`}>
              {plans.length} object(s) — {selectedPlans.size} selected
            </div>
            <div className={`border-2 ${BEVEL_IN} bg-[#c0c0c0] px-2 py-0.5 text-[10px]`}>
              {companies.length} companies
            </div>
            <div className={`border-2 ${BEVEL_IN} bg-[#c0c0c0] px-2 py-0.5 text-[10px]`}>
              {allPlans.length} total plans
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
