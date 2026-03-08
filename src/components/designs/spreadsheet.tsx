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
// Spreadsheet Design
// Mimics Excel / Google Sheets: cell grid with borders, column letters (A, B,
// C…), row numbers, a formula bar at the top, sheet tabs at the bottom, and
// that unmistakable pale-blue header row.  Everything is in a system/mono
// font with tight cell padding.
// ---------------------------------------------------------------------------

const COL_HEADERS = [
  { id: "row", label: "", width: "w-12" },
  { id: "A", label: "Company", width: "min-w-[180px]" },
  { id: "B", label: "Plan", width: "min-w-[120px]" },
  { id: "C", label: "Price/mo", width: "w-24" },
  { id: "D", label: "$/1K Resp", width: "w-24" },
  { id: "E", label: "AI Resp/mo", width: "w-28" },
  { id: "F", label: "G2", width: "w-16" },
  { id: "G", label: "Trustpilot", width: "w-20" },
  { id: "H", label: "TrustRadius", width: "w-20" },
  { id: "I", label: "Capterra", width: "w-20" },
  { id: "J", label: "Schedule", width: "w-20" },
  { id: "K", label: "LLMs", width: "min-w-[160px]" },
  { id: "L", label: "Location", width: "w-20" },
];

export function SpreadsheetDesign(props: DesignProps) {
  const {
    plans,
    allPlans,
    companies,
    selectedPlans,
    onTogglePlan,
    onCompare,
    onEditPlan,
    onAddCompany,
    filters,
    updateSearch,
    activeFilterCount,
  } = props;

  // "Selected cell" formula bar text
  const selCount = selectedPlans.size;

  return (
    <div className="-mx-4 -my-8 flex min-h-screen flex-col bg-[#f0f0f0] font-['Segoe_UI',system-ui,sans-serif] text-[13px] sm:-mx-6 lg:-mx-8">
      {/* ---- Title bar ---- */}
      <div className="flex items-center gap-2 border-b border-[#c0c0c0] bg-gradient-to-b from-[#e8e8e8] to-[#d0d0d0] px-2 py-1">
        <span className="text-xs font-bold text-[#333]">📊 LLM_Trackers_Comparison.xlsx</span>
        <span className="ml-auto text-[10px] text-[#888]">
          {companies.length} companies · {allPlans.length} plans
        </span>
      </div>

      {/* ---- Toolbar ---- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[#c0c0c0] bg-[#f5f5f5] px-2 py-1">
        <button
          type="button"
          onClick={onAddCompany}
          className="cursor-pointer rounded border border-[#aaa] bg-white px-2 py-0.5 text-[11px] text-[#333] shadow-sm hover:bg-[#e0e0e0]"
        >
          + Insert Row
        </button>
        {selCount >= 2 && (
          <button
            type="button"
            onClick={onCompare}
            className="cursor-pointer rounded border border-[#4472c4] bg-[#4472c4] px-2 py-0.5 text-[11px] text-white shadow-sm hover:bg-[#3461b3]"
          >
            Compare ({selCount})
          </button>
        )}
        <div className="mx-2 h-4 w-px bg-[#c0c0c0]" />

        {/* LLM filter toggles */}
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
              className={`cursor-pointer rounded border px-1.5 py-0.5 text-[10px] ${
                active
                  ? "border-[#4472c4] bg-[#d6e4f0] font-semibold text-[#2b579a]"
                  : "border-[#ccc] bg-white text-[#666] hover:bg-[#eee]"
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
            className="cursor-pointer text-[10px] text-red-600 hover:text-red-800"
          >
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* ---- Formula bar ---- */}
      <div className="flex items-center gap-2 border-b border-[#c0c0c0] bg-white px-2 py-1">
        <div className="w-20 rounded border border-[#c0c0c0] bg-[#f5f5f5] px-2 py-0.5 text-center text-[11px] font-semibold text-[#333]">
          A1
        </div>
        <div className="text-[11px] italic text-[#888]">fx</div>
        <input
          type="text"
          placeholder="=SEARCH(plans, ...)"
          value={filters.q}
          onChange={(e) => {
            updateSearch({ q: e.target.value || undefined });
          }}
          className="flex-1 rounded border border-[#c0c0c0] bg-white px-2 py-0.5 text-[12px] text-[#333] outline-none focus:border-[#4472c4]"
        />
      </div>

      {/* ---- Spreadsheet grid ---- */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          {/* Column letter headers */}
          <thead className="sticky top-0 z-10">
            <tr>
              {COL_HEADERS.map((col) => (
                <th
                  key={col.id}
                  className={`border border-[#c0c0c0] bg-gradient-to-b from-[#e8e8e8] to-[#d8d8d8] px-1 py-1 text-center text-[11px] font-semibold text-[#555] ${col.width}`}
                >
                  {col.id === "row" ? "" : col.id}
                </th>
              ))}
            </tr>
            {/* Column name headers */}
            <tr>
              {COL_HEADERS.map((col) => (
                <th
                  key={col.id}
                  className={`border border-[#c0c0c0] bg-[#d6e4f0] px-2 py-1.5 text-left text-[11px] font-bold text-[#2b579a] ${col.width}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, i) => {
              const key = planKey(plan);
              const isSelected = selectedPlans.has(key);
              const g2 = getReviewSiteScore(plan, "g2");
              const tp = getReviewSiteScore(plan, "trustpilot");
              const tr = getReviewSiteScore(plan, "trustradius");
              const cap = getReviewSiteScore(plan, "capterra");
              const rowBg = isSelected ? "bg-[#d6e4f0]" : i % 2 === 0 ? "bg-white" : "bg-[#f8f9fa]";

              return (
                <tr
                  key={key}
                  onClick={() => {
                    onTogglePlan(key);
                  }}
                  className={`cursor-pointer ${rowBg} hover:bg-[#e2efda]`}
                >
                  {/* Row number */}
                  <td className="border border-[#c0c0c0] bg-gradient-to-b from-[#e8e8e8] to-[#d8d8d8] px-1 py-1 text-center text-[11px] font-semibold text-[#555]">
                    {i + 1}
                  </td>
                  {/* A: Company */}
                  <td className="border border-[#c0c0c0] px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                      <Link
                        to="/companies/$slug"
                        params={{ slug: plan.companySlug }}
                        className="text-[#2b579a] underline decoration-[#2b579a]/30 hover:decoration-[#2b579a]"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        {plan.companyName}
                      </Link>
                    </div>
                  </td>
                  {/* B: Plan */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-[#333]">
                    <div className="flex items-center gap-1">
                      <span>{plan.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditPlan(plan);
                        }}
                        className="cursor-pointer text-[10px] text-[#aaa] opacity-0 transition-opacity hover:text-[#4472c4] group-hover:opacity-100 [tr:hover_&]:opacity-100"
                      >
                        ✏️
                      </button>
                    </div>
                  </td>
                  {/* C: Price */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-right font-medium text-[#333]">
                    {formatPrice(plan)}
                  </td>
                  {/* D: Cost/1K */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-right text-[#333]">
                    {plan.pricePer1000Responses != null
                      ? `$${plan.pricePer1000Responses.toFixed(2)}`
                      : "—"}
                  </td>
                  {/* E: Responses */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-right text-[#333]">
                    {plan.aiResponsesMonthly != null
                      ? plan.aiResponsesMonthly.toLocaleString()
                      : "—"}
                  </td>
                  {/* F: G2 */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-center text-[#333]">
                    {g2 != null ? g2.toFixed(1) : "—"}
                  </td>
                  {/* G: Trustpilot */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-center text-[#333]">
                    {tp != null ? tp.toFixed(1) : "—"}
                  </td>
                  {/* H: TrustRadius */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-center text-[#333]">
                    {tr != null ? tr.toFixed(1) : "—"}
                  </td>
                  {/* I: Capterra */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-center text-[#333]">
                    {cap != null ? cap.toFixed(1) : "—"}
                  </td>
                  {/* J: Schedule */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-center text-[12px]">
                    <span
                      className={
                        plan.schedule === "daily" ? "font-semibold text-[#548235]" : "text-[#888]"
                      }
                    >
                      {plan.schedule}
                    </span>
                  </td>
                  {/* K: LLMs */}
                  <td className="border border-[#c0c0c0] px-2 py-1">
                    <div className="flex flex-wrap gap-0.5">
                      {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                        <LlmIcon key={k} model={k} size={14} />
                      ))}
                    </div>
                  </td>
                  {/* L: Location */}
                  <td className="border border-[#c0c0c0] px-2 py-1 text-center text-[12px] text-[#333]">
                    {formatLocation(plan.locationSupport)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {plans.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-sm text-[#888]">#N/A — No matching results</div>
          </div>
        )}
      </div>

      {/* ---- Sheet tabs (bottom) ---- */}
      <div className="flex items-center gap-0 border-t border-[#c0c0c0] bg-[#e8e8e8]">
        <div className="cursor-default border-r border-[#c0c0c0] bg-white px-4 py-1.5 text-[11px] font-semibold text-[#333]">
          All Plans
        </div>
        <div className="cursor-pointer border-r border-[#c0c0c0] px-4 py-1.5 text-[11px] text-[#888] hover:bg-[#ddd]">
          Daily Only
        </div>
        <div className="cursor-pointer border-r border-[#c0c0c0] px-4 py-1.5 text-[11px] text-[#888] hover:bg-[#ddd]">
          Weekly Only
        </div>
        <div className="ml-auto px-3 py-1.5 text-[10px] text-[#888]">
          {plans.length} of {allPlans.length} rows · {selCount} selected
        </div>
      </div>
    </div>
  );
}
