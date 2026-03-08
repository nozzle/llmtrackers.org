import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CompanyMark } from "~/components/company-mark";
import { LlmIcon } from "~/components/llm-icon";
import { ReviewSiteScoreBadge } from "~/components/review-site-badge";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import type { Company, PlanWithCompany } from "@llm-tracker/shared";
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
// Bento Grid Design
// Asymmetric tile layout inspired by Japanese bento boxes / Apple keynote
// grids. Companies are primary, each in a differently-sized cell. Larger
// tiles for higher-rated companies. Rounded corners, subtle pastel
// backgrounds, elegant whitespace.
// ---------------------------------------------------------------------------

// Soft pastel palette for tiles
const PASTELS = [
  "bg-blue-50/80",
  "bg-violet-50/80",
  "bg-amber-50/80",
  "bg-emerald-50/80",
  "bg-rose-50/80",
  "bg-sky-50/80",
  "bg-fuchsia-50/80",
  "bg-lime-50/80",
  "bg-orange-50/80",
  "bg-teal-50/80",
  "bg-indigo-50/80",
  "bg-cyan-50/80",
];

const PASTEL_BORDERS = [
  "border-blue-200/60",
  "border-violet-200/60",
  "border-amber-200/60",
  "border-emerald-200/60",
  "border-rose-200/60",
  "border-sky-200/60",
  "border-fuchsia-200/60",
  "border-lime-200/60",
  "border-orange-200/60",
  "border-teal-200/60",
  "border-indigo-200/60",
  "border-cyan-200/60",
];

/** Group plans by company and compute a "score" for sizing */
function groupByCompany(plans: PlanWithCompany[], _companies: Company[]) {
  const companyMap = new Map<
    string,
    {
      slug: string;
      name: string;
      plans: PlanWithCompany[];
      avgScore: number;
      bestPrice: number | null;
    }
  >();

  for (const plan of plans) {
    let entry = companyMap.get(plan.companySlug);
    if (!entry) {
      entry = {
        slug: plan.companySlug,
        name: plan.companyName,
        plans: [],
        avgScore: 0,
        bestPrice: null,
      };
      companyMap.set(plan.companySlug, entry);
    }
    entry.plans.push(plan);
  }

  // Compute average review score across platforms for sizing
  for (const entry of companyMap.values()) {
    const plan = entry.plans[0];
    const scores = [
      getReviewSiteScore(plan, "g2"),
      getReviewSiteScore(plan, "trustpilot"),
      getReviewSiteScore(plan, "trustradius"),
      getReviewSiteScore(plan, "capterra"),
    ].filter((s): s is number => s != null);
    entry.avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const prices = entry.plans.map((p) => p.price.amount).filter((a): a is number => a != null);
    entry.bestPrice = prices.length > 0 ? Math.min(...prices) : null;
  }

  return Array.from(companyMap.values()).sort((a, b) => b.avgScore - a.avgScore);
}

/** Assign bento sizes: top companies get large, middle get medium, rest get small */
function assignSize(index: number, total: number): "large" | "medium" | "small" {
  if (total <= 3) return "large";
  if (index < 2) return "large";
  if (index < 6) return "medium";
  return "small";
}

export function BentoGridDesign(props: DesignProps) {
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

  const grouped = useMemo(() => groupByCompany(plans, companies), [plans, companies]);

  return (
    <div>
      {/* Elegant header */}
      <div className="mb-10">
        <h1 className="text-4xl font-light tracking-tight text-gray-800">
          AI Search Visibility
          <span className="ml-3 font-semibold text-gray-900">Tools</span>
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          {companies.length} companies, {allPlans.length} plans, curated for comparison.
        </p>
      </div>

      {/* Minimal search + filters */}
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Filter by name..."
            value={filters.q}
            onChange={(e) => {
              updateSearch({ q: e.target.value || undefined });
            }}
            className="w-full border-b border-gray-200 bg-transparent py-2 text-sm text-gray-800 placeholder-gray-300 outline-none transition-colors focus:border-gray-900"
          />
        </div>

        {/* Pill LLM filters */}
        <div className="flex flex-wrap gap-2">
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
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
            className="cursor-pointer text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {selectedPlans.size >= 2 && (
            <button
              onClick={onCompare}
              className="cursor-pointer rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Compare {selectedPlans.size}
            </button>
          )}
          <button
            type="button"
            onClick={onAddCompany}
            className="cursor-pointer rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="bento-grid grid auto-rows-[minmax(180px,auto)] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {grouped.map((company, idx) => {
          const size = assignSize(idx, grouped.length);
          const pastel = PASTELS[idx % PASTELS.length];
          const border = PASTEL_BORDERS[idx % PASTEL_BORDERS.length];
          const plan = company.plans[0]; // representative plan
          const hasSelection = company.plans.some((p) => selectedPlans.has(planKey(p)));

          // Grid span classes
          const sizeClasses =
            size === "large"
              ? "col-span-2 row-span-2"
              : size === "medium"
                ? "col-span-2 row-span-1"
                : "col-span-1 row-span-1";

          return (
            <div
              key={company.slug}
              className={`${sizeClasses} group relative overflow-hidden rounded-3xl border ${border} ${pastel} p-5 transition-all duration-300 hover:shadow-lg ${
                hasSelection ? "ring-2 ring-gray-900 ring-offset-2" : ""
              }`}
            >
              {/* Company header */}
              <div className="mb-3 flex items-start gap-3">
                <CompanyMark
                  slug={company.slug}
                  name={company.name}
                  size={size === "large" ? "lg" : "md"}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/companies/$slug"
                    params={{ slug: company.slug }}
                    className={`block truncate font-semibold text-gray-800 hover:text-gray-600 ${
                      size === "large" ? "text-xl" : "text-sm"
                    }`}
                  >
                    {company.name}
                  </Link>
                  <div className="text-xs text-gray-400">
                    {company.plans.length} plan{company.plans.length > 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Large tile: show detailed info */}
              {size === "large" && (
                <>
                  {/* Review scores */}
                  <div className="mb-4 flex gap-2">
                    {(["g2", "trustpilot", "trustradius", "capterra"] as const).map((platform) => {
                      const score = getReviewSiteScore(plan, platform);
                      return (
                        <ReviewSiteScoreBadge
                          key={platform}
                          platform={platform}
                          score={score}
                          maxScore={getReviewSiteMaxScore(
                            plan,
                            platform,
                            platform === "trustradius" ? 10 : 5,
                          )}
                          compact
                          showLogo
                        />
                      );
                    })}
                  </div>

                  {/* Plans list */}
                  <div className="mb-4 grid gap-2">
                    {company.plans.map((p) => {
                      const pKey = planKey(p);
                      const isSel = selectedPlans.has(pKey);
                      return (
                        <div
                          key={pKey}
                          onClick={() => {
                            onTogglePlan(pKey);
                          }}
                          className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 transition-all ${
                            isSel
                              ? "border-gray-900 bg-white/80 shadow-sm"
                              : "border-transparent bg-white/50 hover:bg-white/80"
                          }`}
                        >
                          <div>
                            <div className="text-sm font-medium text-gray-800">{p.name}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className={p.schedule === "daily" ? "text-blue-500" : ""}>
                                {p.schedule}
                              </span>
                              <span>{formatLocation(p.locationSupport)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">{formatPrice(p)}</div>
                            <div className="text-[10px] text-gray-400">
                              {p.aiResponsesMonthly != null
                                ? `${(p.aiResponsesMonthly / 1000).toFixed(0)}K resp/mo`
                                : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* LLM icons */}
                  <div className="flex gap-1.5">
                    {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                      <LlmIcon key={k} model={k} size={20} />
                    ))}
                  </div>
                </>
              )}

              {/* Medium tile */}
              {size === "medium" && (
                <>
                  <div className="mb-3 flex gap-2">
                    {(["g2", "trustpilot", "trustradius", "capterra"] as const).map((platform) => {
                      const score = getReviewSiteScore(plan, platform);
                      return (
                        <ReviewSiteScoreBadge
                          key={platform}
                          platform={platform}
                          score={score}
                          maxScore={getReviewSiteMaxScore(
                            plan,
                            platform,
                            platform === "trustradius" ? 10 : 5,
                          )}
                          compact
                        />
                      );
                    })}
                  </div>
                  <div className="mb-2 grid gap-1.5">
                    {company.plans.slice(0, 2).map((p) => {
                      const pKey = planKey(p);
                      const isSel = selectedPlans.has(pKey);
                      return (
                        <div
                          key={pKey}
                          onClick={() => {
                            onTogglePlan(pKey);
                          }}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all ${
                            isSel
                              ? "border-gray-900 bg-white/80"
                              : "border-transparent bg-white/40 hover:bg-white/70"
                          }`}
                        >
                          <span className="text-gray-700">{p.name}</span>
                          <span className="font-semibold text-gray-900">{formatPrice(p)}</span>
                        </div>
                      );
                    })}
                    {company.plans.length > 2 && (
                      <div className="text-xs text-gray-400 px-3">
                        +{company.plans.length - 2} more
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                      <LlmIcon key={k} model={k} size={16} />
                    ))}
                  </div>
                </>
              )}

              {/* Small tile: compact */}
              {size === "small" && (
                <>
                  {company.plans.slice(0, 1).map((p) => {
                    const pKey = planKey(p);
                    const _isSel = selectedPlans.has(pKey);
                    return (
                      <div
                        key={pKey}
                        onClick={() => {
                          onTogglePlan(pKey);
                        }}
                        className="cursor-pointer"
                      >
                        <div className="mb-1 text-lg font-bold text-gray-900">{formatPrice(p)}</div>
                        <div className="mb-2 text-[10px] text-gray-400">{p.name}</div>
                      </div>
                    );
                  })}
                  <div className="flex gap-1">
                    {LLM_KEYS.filter((k) => plan.llmSupport[k])
                      .slice(0, 4)
                      .map((k) => (
                        <LlmIcon key={k} model={k} size={14} />
                      ))}
                    {LLM_KEYS.filter((k) => plan.llmSupport[k]).length > 4 && (
                      <span className="text-[10px] text-gray-400">
                        +{LLM_KEYS.filter((k) => plan.llmSupport[k]).length - 4}
                      </span>
                    )}
                  </div>
                  {company.plans.length > 1 && (
                    <div className="mt-1 text-[10px] text-gray-400">
                      +{company.plans.length - 1} more plans
                    </div>
                  )}
                </>
              )}

              {/* Edit button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPlan(plan);
                }}
                className="absolute right-3 top-3 cursor-pointer rounded-full bg-white/60 p-1.5 text-gray-300 opacity-0 backdrop-blur-sm transition-all hover:text-gray-600 group-hover:opacity-100"
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
          );
        })}
      </div>

      {plans.length === 0 && (
        <div className="mt-20 text-center">
          <div className="text-6xl font-light text-gray-200">Empty</div>
          <div className="mt-3 text-sm text-gray-400">No tools match your current filters.</div>
        </div>
      )}
    </div>
  );
}
