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
// Timeline Design
// A vertical timeline with a central spine line. Each plan is a milestone
// node, alternating left/right. Milestone dots on the spine, connector lines,
// price "badges" inline, and a sense of progression from top (best/cheapest)
// to bottom.  Soft gradient background, modern sans-serif.
// ---------------------------------------------------------------------------

export function TimelineDesign(props: DesignProps) {
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
    <div className="-mx-4 -my-8 min-h-screen bg-gradient-to-b from-[#f8f9fc] to-[#eef1f8] px-4 py-8 sm:-mx-6 lg:-mx-8">
      <div className="mx-auto max-w-[900px]">
        {/* ---- Header ---- */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
            LLM Tracker Timeline
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {companies.length} companies · {allPlans.length} plans · Sorted by current view
          </p>
        </div>

        {/* ---- Filter bar ---- */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
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
                    className={`cursor-pointer rounded-full border px-2 py-1 text-[10px] font-medium transition-colors ${
                      active
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
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
                className="cursor-pointer text-xs text-red-500 hover:text-red-700"
              >
                Clear filters
              </button>
            )}

            <button
              type="button"
              onClick={onAddCompany}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              + Add
            </button>

            {selectedPlans.size >= 2 && (
              <button
                type="button"
                onClick={onCompare}
                className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                Compare {selectedPlans.size}
              </button>
            )}
          </div>
        </div>

        {/* ---- Timeline ---- */}
        <div className="relative">
          {/* Central spine */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-gradient-to-b from-indigo-300 via-indigo-200 to-gray-200" />

          {plans.map((plan, i) => {
            const key = planKey(plan);
            const isSelected = selectedPlans.has(key);
            const isLeft = i % 2 === 0;
            const g2 = getReviewSiteScore(plan, "g2");
            const tp = getReviewSiteScore(plan, "trustpilot");
            const tr = getReviewSiteScore(plan, "trustradius");
            const cap = getReviewSiteScore(plan, "capterra");

            return (
              <div key={key} className="relative mb-6">
                {/* Milestone dot on spine */}
                <div className="absolute left-1/2 top-6 z-10 -translate-x-1/2">
                  <div
                    className={`h-4 w-4 rounded-full border-2 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500 shadow-md shadow-indigo-200"
                        : "border-indigo-300 bg-white"
                    }`}
                  />
                </div>

                {/* Content — alternating left/right */}
                <div
                  className={`flex ${isLeft ? "justify-start pr-[calc(50%+2rem)]" : "justify-end pl-[calc(50%+2rem)]"}`}
                >
                  <div
                    onClick={() => {
                      onTogglePlan(key);
                    }}
                    className={`group w-full cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
                      isSelected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2">
                      <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <Link
                          to="/companies/$slug"
                          params={{ slug: plan.companySlug }}
                          className="text-sm font-bold text-gray-900 hover:text-indigo-600"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {plan.companyName}
                        </Link>
                        <div className="text-[11px] text-gray-400">{plan.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-indigo-600">
                          {formatPrice(plan)}
                        </div>
                        <div className="text-[10px] text-gray-400">/mo</div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                      {plan.pricePer1000Responses != null && (
                        <div className="rounded bg-gray-50 px-2 py-0.5">
                          <span className="text-gray-400">$/1K:</span>{" "}
                          <span className="font-semibold text-gray-700">
                            ${plan.pricePer1000Responses.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {plan.aiResponsesMonthly != null && (
                        <div className="rounded bg-gray-50 px-2 py-0.5">
                          <span className="text-gray-400">Resp:</span>{" "}
                          <span className="font-semibold text-gray-700">
                            {plan.aiResponsesMonthly.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="rounded bg-gray-50 px-2 py-0.5">
                        <span className="text-gray-400">Schedule:</span>{" "}
                        <span
                          className={`font-semibold ${plan.schedule === "daily" ? "text-green-600" : "text-gray-700"}`}
                        >
                          {plan.schedule}
                        </span>
                      </div>
                      <div className="rounded bg-gray-50 px-2 py-0.5">
                        <span className="text-gray-400">Loc:</span>{" "}
                        <span className="font-semibold text-gray-700">
                          {formatLocation(plan.locationSupport)}
                        </span>
                      </div>
                    </div>

                    {/* Scores + LLMs */}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-2 text-[10px]">
                        {[
                          { label: "G2", val: g2 },
                          { label: "TP", val: tp },
                          { label: "TR", val: tr },
                          { label: "Cap", val: cap },
                        ].map(({ label, val }) =>
                          val != null ? (
                            <span
                              key={label}
                              className="rounded-full bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-600"
                            >
                              {label} {val.toFixed(1)}
                            </span>
                          ) : null,
                        )}
                      </div>
                      <div className="flex gap-0.5">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                          <LlmIcon key={k} model={k} size={14} />
                        ))}
                      </div>
                    </div>

                    {/* Edit (hidden until hover) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPlan(plan);
                      }}
                      className="mt-2 cursor-pointer text-[10px] text-gray-300 opacity-0 transition-opacity hover:text-indigo-500 group-hover:opacity-100"
                    >
                      Edit plan →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="py-20 text-center">
            <div className="text-lg font-medium text-gray-300">No plans match your filters</div>
          </div>
        )}

        {/* End cap */}
        {plans.length > 0 && (
          <div className="relative mt-2 flex justify-center">
            <div className="absolute left-1/2 top-0 h-6 w-0.5 -translate-x-1/2 bg-gray-200" />
            <div className="relative z-10 mt-6 rounded-full bg-gray-200 px-4 py-1 text-[10px] font-medium text-gray-500">
              {plans.length} plans shown
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
