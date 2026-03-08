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
// Brutalist Design
// Stark black & white with bold red accents. Oversized monospace headings,
// raw exposed borders (no border-radius), asymmetric layout, "anti-design"
// aesthetic with visible grid lines and uppercase labels.
// ---------------------------------------------------------------------------

export function BrutalistDesign(props: DesignProps) {
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
    <div className="-mx-4 -my-8 min-h-screen bg-white px-0 py-0 sm:-mx-6 lg:-mx-8">
      {/* Massive header */}
      <div className="border-b-4 border-black bg-black px-6 py-10 lg:px-10">
        <h1 className="font-mono text-5xl font-black uppercase tracking-tighter text-white sm:text-7xl lg:text-8xl">
          LLM
          <br />
          <span className="text-red-500">TRACKERS</span>
        </h1>
        <div className="mt-4 flex items-end justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-gray-500">
            {companies.length} TOOLS / {allPlans.length} PLANS / COMPARISON ENGINE
          </p>
          <button
            type="button"
            onClick={onAddCompany}
            className="cursor-pointer border-2 border-white bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black"
          >
            + ADD
          </button>
        </div>
      </div>

      {/* Search strip */}
      <div className="border-b-4 border-black bg-white px-6 py-4 lg:px-10">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="text"
            placeholder="SEARCH..."
            value={filters.q}
            onChange={(e) => {
              updateSearch({ q: e.target.value || undefined });
            }}
            className="flex-1 border-b-2 border-black bg-transparent py-2 font-mono text-lg font-bold uppercase tracking-wider text-black placeholder-gray-300 outline-none"
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
                  className={`cursor-pointer border-2 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    active
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-black text-black hover:bg-black hover:text-white"
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
              className="cursor-pointer font-mono text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-700"
            >
              [CLEAR]
            </button>
          )}

          {selectedPlans.size >= 2 && (
            <button
              onClick={onCompare}
              className="cursor-pointer border-2 border-red-500 bg-red-500 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-red-600"
            >
              COMPARE {selectedPlans.size}
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-2 lg:px-10">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-gray-400">
          SHOWING {plans.length} OF {allPlans.length} RESULTS
        </span>
      </div>

      {/* Plan rows - each is a bold block */}
      <div>
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
              className={`group cursor-pointer border-b-2 transition-colors ${
                isSelected ? "border-red-500 bg-red-50" : "border-black hover:bg-gray-50"
              }`}
            >
              <div className="flex">
                {/* Left: number + selection */}
                <div
                  className={`flex w-16 flex-shrink-0 items-center justify-center border-r-2 font-mono text-2xl font-black ${
                    isSelected
                      ? "border-red-500 bg-red-500 text-white"
                      : "border-black bg-black text-white"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>

                {/* Main content */}
                <div className="flex-1 px-6 py-5 lg:px-10">
                  <div className="flex flex-wrap items-start gap-6">
                    {/* Company + plan */}
                    <div className="min-w-[200px] flex-1">
                      <div className="flex items-center gap-3">
                        <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                        <div>
                          <Link
                            to="/companies/$slug"
                            params={{ slug: plan.companySlug }}
                            className="font-mono text-xl font-black uppercase tracking-tight text-black hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            {plan.companyName}
                          </Link>
                          <div className="font-mono text-xs uppercase tracking-wider text-gray-400">
                            {plan.name}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Price block */}
                    <div className="text-right">
                      <div className="font-mono text-3xl font-black tracking-tighter text-black">
                        {formatPrice(plan)}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-gray-400">
                        PER MONTH
                      </div>
                    </div>

                    {/* Review scores */}
                    <div className="flex gap-3">
                      {[
                        { label: "G2", score: g2, max: 5 },
                        { label: "TP", score: tp, max: 5 },
                        { label: "TR", score: tr, max: 10 },
                        { label: "CP", score: cap, max: 5 },
                      ].map(({ label, score, max: _max }) => (
                        <div key={label} className="text-center">
                          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-gray-400">
                            {label}
                          </div>
                          <div
                            className={`font-mono text-lg font-black ${score != null ? "text-black" : "text-gray-200"}`}
                          >
                            {score != null ? score.toFixed(1) : "--"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-400">
                        RESP/MO
                      </div>
                      <div className="font-mono text-xs font-bold text-black text-right">
                        {plan.aiResponsesMonthly != null
                          ? plan.aiResponsesMonthly.toLocaleString()
                          : "--"}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-gray-400">
                        $/1K
                      </div>
                      <div className="font-mono text-xs font-bold text-black text-right">
                        {plan.pricePer1000Responses != null
                          ? `$${plan.pricePer1000Responses.toFixed(2)}`
                          : "--"}
                      </div>
                    </div>

                    {/* LLMs + metadata */}
                    <div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                          <LlmIcon key={k} model={k} size={16} />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                            plan.schedule === "daily" ? "text-red-500" : "text-gray-400"
                          }`}
                        >
                          {plan.schedule}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
                          {formatLocation(plan.locationSupport)}
                        </span>
                      </div>
                    </div>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPlan(plan);
                      }}
                      className="cursor-pointer self-center font-mono text-[10px] font-bold uppercase tracking-wider text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    >
                      [EDIT]
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="py-20 text-center">
          <div className="font-mono text-6xl font-black text-gray-100">NULL</div>
          <div className="mt-2 font-mono text-xs uppercase tracking-[0.3em] text-gray-400">
            NO RESULTS MATCH YOUR QUERY
          </div>
        </div>
      )}
    </div>
  );
}
