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
// Blueprint Design
// Technical-drawing / architectural-blueprint aesthetic.  White linework on
// a deep blue background.  Grid paper, dimension annotations, title block,
// section callouts, drawing numbers.  Monospace/narrow sans-serif throughout.
// ---------------------------------------------------------------------------

export function BlueprintDesign(props: DesignProps) {
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

  return (
    <div className="blueprint-design -mx-4 -my-8 min-h-screen bg-[#1a3a5c] px-4 py-6 font-mono text-[#c8ddf0] sm:-mx-6 lg:-mx-8">
      {/* Blueprint grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(150,200,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(150,200,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1500px]">
        {/* ---- Title block (bottom-right style, but placed at top) ---- */}
        <div className="mb-6 border border-[#4a7faa] p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.4em] text-[#6a9ec8]">
                Drawing No. LLM-COMP-001 · Rev {allPlans.length}
              </div>
              <h1 className="mt-1 text-3xl font-bold uppercase tracking-wider text-white">
                LLM Tracker Comparison
              </h1>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#6a9ec8]">
                Sheet 1 of 1 · Scale: 1:1 · {companies.length} Companies · {allPlans.length} Plans
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAddCompany}
                className="cursor-pointer border border-[#4a7faa] px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#8ac] transition-colors hover:bg-[#4a7faa]/30"
              >
                + Add Component
              </button>
              {selectedPlans.size >= 2 && (
                <button
                  type="button"
                  onClick={onCompare}
                  className="cursor-pointer border border-[#88ccff] bg-[#88ccff]/20 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#88ccff] transition-colors hover:bg-[#88ccff]/30"
                >
                  Compare ({selectedPlans.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ---- Filter strip ---- */}
        <div className="mb-4 border border-[#4a7faa] bg-[#1a3a5c]/80 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#6a9ec8]">
              FILTER SPEC:
            </span>
            <input
              type="text"
              placeholder="search query..."
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              className="flex-1 border-b border-[#4a7faa] bg-transparent px-2 py-1 text-xs text-white outline-none placeholder:text-[#4a7faa]"
            />

            <div className="flex flex-wrap gap-1">
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
                    className={`cursor-pointer border px-1.5 py-0.5 text-[10px] uppercase transition-colors ${
                      active
                        ? "border-[#88ccff] bg-[#88ccff]/20 text-[#88ccff]"
                        : "border-[#4a7faa] text-[#6a9ec8] hover:text-white"
                    }`}
                  >
                    {LLM_MODEL_LABELS[key]}
                  </button>
                );
              })}
            </div>

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
                className="cursor-pointer text-[10px] uppercase text-[#ff8888] hover:text-[#ffaaaa]"
              >
                [CLEAR]
              </button>
            )}
          </div>
        </div>

        {/* ---- Section label ---- */}
        <div className="mb-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#4a7faa]" />
          <span className="text-[10px] uppercase tracking-[0.4em] text-[#6a9ec8]">
            DETAIL — SECTION A — {plans.length} COMPONENTS
          </span>
          <div className="h-px flex-1 bg-[#4a7faa]" />
        </div>

        {/* ---- Blueprint plan rows ---- */}
        <div className="space-y-1">
          {plans.map((plan, i) => {
            const key = planKey(plan);
            const isSelected = selectedPlans.has(key);
            const g2 = getReviewSiteScore(plan, "g2");
            const tp = getReviewSiteScore(plan, "trustpilot");
            const tr = getReviewSiteScore(plan, "trustradius");
            const cap = getReviewSiteScore(plan, "capterra");

            return (
              <div
                key={key}
                onClick={() => {
                  onTogglePlan(key);
                }}
                className={`group cursor-pointer border transition-colors ${
                  isSelected
                    ? "border-[#88ccff] bg-[#88ccff]/10"
                    : "border-[#2a5a8c] hover:border-[#4a7faa] hover:bg-[#1e4570]"
                }`}
              >
                <div className="flex items-stretch">
                  {/* Drawing callout number */}
                  <div
                    className={`flex w-10 flex-shrink-0 items-center justify-center border-r text-[10px] font-bold ${
                      isSelected
                        ? "border-[#88ccff] text-[#88ccff]"
                        : "border-[#2a5a8c] text-[#4a7faa]"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5">
                    {/* Company name + plan */}
                    <div className="min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                        <Link
                          to="/companies/$slug"
                          params={{ slug: plan.companySlug }}
                          className="text-sm font-bold uppercase tracking-wide text-white hover:text-[#88ccff]"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {plan.companyName}
                        </Link>
                      </div>
                      <div className="ml-5 text-[10px] text-[#6a9ec8]">{plan.name}</div>
                    </div>

                    {/* Dimension annotations */}
                    <div className="flex gap-4 text-[11px]">
                      <div>
                        <span className="text-[9px] uppercase text-[#4a7faa]">PRICE </span>
                        <span className="text-white">{formatPrice(plan)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-[#4a7faa]">$/1K </span>
                        <span className="text-white">
                          {plan.pricePer1000Responses != null
                            ? `$${plan.pricePer1000Responses.toFixed(2)}`
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase text-[#4a7faa]">RESP/MO </span>
                        <span className="text-white">
                          {plan.aiResponsesMonthly != null
                            ? plan.aiResponsesMonthly.toLocaleString()
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Review scores — drawn like dimension callouts */}
                    <div className="flex gap-3 text-[11px]">
                      {[
                        { label: "G2", val: g2 },
                        { label: "TP", val: tp },
                        { label: "TR", val: tr },
                        { label: "CAP", val: cap },
                      ].map(({ label, val }) => (
                        <div key={label} className="text-center">
                          <div className="text-[8px] uppercase tracking-wider text-[#4a7faa]">
                            {label}
                          </div>
                          <div className={val != null ? "text-white" : "text-[#2a5a8c]"}>
                            {val != null ? val.toFixed(1) : "—"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Schedule + location */}
                    <div className="flex gap-3 text-[10px]">
                      <span
                        className={plan.schedule === "daily" ? "text-[#88ccff]" : "text-[#6a9ec8]"}
                      >
                        ◆ {plan.schedule}
                      </span>
                      <span className="text-[#6a9ec8]">
                        ◇ {formatLocation(plan.locationSupport)}
                      </span>
                    </div>

                    {/* LLMs */}
                    <div className="flex gap-0.5">
                      {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                        <LlmIcon key={k} model={k} size={14} />
                      ))}
                    </div>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPlan(plan);
                      }}
                      className="cursor-pointer text-[10px] uppercase text-[#4a7faa] opacity-0 transition-opacity hover:text-[#88ccff] group-hover:opacity-100"
                    >
                      [REVISE]
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="py-20 text-center">
            <div className="text-sm uppercase tracking-wider text-[#4a7faa]">
              NO COMPONENTS MATCH FILTER SPECIFICATION
            </div>
          </div>
        )}

        {/* ---- Footer notes ---- */}
        <div className="mt-6 border-t border-[#4a7faa] pt-2">
          <div className="flex justify-between text-[9px] uppercase tracking-[0.3em] text-[#4a7faa]">
            <span>APPROVED: LLM TRACKERS</span>
            <span>DATE: {new Date().toISOString().slice(0, 10)}</span>
            <span>DRG. LLM-COMP-001</span>
          </div>
        </div>
      </div>
    </div>
  );
}
