import { Link } from "@tanstack/react-router";
import { CompanyMark } from "~/components/company-mark";
import { LlmIcon } from "~/components/llm-icon";
import { ReviewSiteScoreBadge } from "~/components/review-site-badge";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import {
  type DesignProps,
  LLM_KEYS,
  formatPrice,
  formatLocation,
  getReviewSiteScore,
  getReviewSiteMaxScore,
  planKey,
} from "./design-props";

// ---------------------------------------------------------------------------
// Card Grid Design
// Modern floating cards in a responsive grid. Each plan is a mini-dashboard
// with company logo, score bars, price badge, LLM icons, and hover lift.
// ---------------------------------------------------------------------------

export function CardGridDesign(props: DesignProps) {
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
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">AI Search Visibility Tools</h1>
          <button
            type="button"
            onClick={onAddCompany}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-md hover:shadow-lg transition-all"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add
          </button>
        </div>
        <p className="mt-2 text-gray-500">
          {companies.length} tools, {allPlans.length} plans. Click cards to select, then compare.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search tools..."
            value={filters.q}
            onChange={(e) => {
              updateSearch({ q: e.target.value || undefined });
            }}
            className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Quick LLM filter pills */}
        <div className="flex flex-wrap gap-1.5">
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
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? "bg-blue-100 text-blue-800 ring-1 ring-blue-300"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <LlmIcon model={key} size={14} />
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

        {selectedPlans.size >= 2 && (
          <button
            onClick={onCompare}
            className="ml-auto cursor-pointer rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all"
          >
            Compare {selectedPlans.size} Plans
          </button>
        )}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan) => {
          const key = planKey(plan);
          const isSelected = selectedPlans.has(key);
          const _g2 = getReviewSiteScore(plan, "g2");
          const _tp = getReviewSiteScore(plan, "trustpilot");
          const _llmCount = LLM_KEYS.filter((k) => plan.llmSupport[k]).length;

          return (
            <div
              key={key}
              onClick={() => {
                onTogglePlan(key);
              }}
              className={`group relative cursor-pointer rounded-2xl border-2 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-200 shadow-blue-100"
                  : "border-transparent hover:border-gray-200"
              }`}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              {/* Company header */}
              <div className="mb-4 flex items-start gap-3">
                <CompanyMark slug={plan.companySlug} name={plan.companyName} size="md" />
                <div className="flex-1 min-w-0">
                  <Link
                    to="/companies/$slug"
                    params={{ slug: plan.companySlug }}
                    className="block truncate font-semibold text-gray-900 hover:text-blue-600"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    {plan.companyName}
                  </Link>
                  <div className="text-xs text-gray-500">{plan.name}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPlan(plan);
                  }}
                  className="cursor-pointer rounded-lg p-1 text-gray-300 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-500 group-hover:opacity-100"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                    />
                  </svg>
                </button>
              </div>

              {/* Price + Schedule row */}
              <div className="mb-4 flex items-center justify-between">
                <div className="text-2xl font-bold text-gray-900">
                  {formatPrice(plan)}
                  <span className="text-xs font-normal text-gray-400">/mo</span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    plan.schedule === "daily"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {plan.schedule}
                </span>
              </div>

              {/* Review scores mini-bar */}
              <div className="mb-4 grid grid-cols-4 gap-2">
                {(["g2", "trustpilot", "trustradius", "capterra"] as const).map((platform) => {
                  const score = getReviewSiteScore(plan, platform);
                  return (
                    <div key={platform} className="text-center">
                      <ReviewSiteScoreBadge
                        platform={platform}
                        score={score}
                        maxScore={getReviewSiteMaxScore(
                          plan,
                          platform,
                          platform === "trustradius" ? 10 : 5,
                        )}
                        compact
                      />
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    Responses
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    {plan.aiResponsesMonthly != null
                      ? plan.aiResponsesMonthly >= 1000000
                        ? `${(plan.aiResponsesMonthly / 1000000).toFixed(1)}M`
                        : plan.aiResponsesMonthly >= 1000
                          ? `${(plan.aiResponsesMonthly / 1000).toFixed(0)}K`
                          : plan.aiResponsesMonthly.toLocaleString()
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                    $/1K Resp.
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    {plan.pricePer1000Responses != null
                      ? `$${plan.pricePer1000Responses.toFixed(2)}`
                      : "-"}
                  </div>
                </div>
              </div>

              {/* LLM Support */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                    <LlmIcon key={k} model={k} size={16} />
                  ))}
                </div>
                <span className="text-xs text-gray-400">
                  {formatLocation(plan.locationSupport)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="mt-16 text-center text-gray-400">
          <div className="text-5xl mb-3">:(</div>
          No plans match your filters.
        </div>
      )}
    </div>
  );
}
