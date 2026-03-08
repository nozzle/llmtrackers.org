import { useMemo } from "react";
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
// Dashboard Design
// Data-visualization / analytics dashboard aesthetic.  KPI stat boxes at
// top, horizontal bar chart rankings, metric-heavy layout with data density.
// Dark sidebar-style nav, clean white panels, accent colours for metrics.
// ---------------------------------------------------------------------------

/** Bar that fills proportionally */
function MetricBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-right text-[10px] text-gray-400">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-[10px] font-semibold text-gray-600">{value.toFixed(1)}</span>
    </div>
  );
}

export function DashboardDesign(props: DesignProps) {
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

  // Compute summary KPIs
  const kpis = useMemo(() => {
    const prices = plans.map((p) => p.price.amount).filter((a): a is number => a != null);
    const avgPrice = prices.length > 0 ? prices.reduce((s, v) => s + v, 0) / prices.length : 0;
    const dailyCount = plans.filter((p) => p.schedule === "daily").length;
    const avgLlm =
      plans.length > 0
        ? plans.reduce((s, p) => s + LLM_KEYS.filter((k) => p.llmSupport[k]).length, 0) /
          plans.length
        : 0;
    const globalCount = plans.filter((p) => p.locationSupport === "global").length;
    return { avgPrice, dailyCount, avgLlm, globalCount };
  }, [plans]);

  return (
    <div className="-mx-4 -my-8 min-h-screen bg-[#f0f2f5] sm:-mx-6 lg:-mx-8">
      {/* ---- Top nav bar ---- */}
      <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-indigo-600 text-center text-xs font-bold leading-6 text-white">
            L
          </div>
          <span className="text-sm font-bold text-gray-900">LLM Tracker Dashboard</span>
        </div>
        <span className="text-xs text-gray-400">
          {companies.length} companies · {allPlans.length} plans
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onAddCompany}
            className="cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
          >
            + Add
          </button>
          {selectedPlans.size >= 2 && (
            <button
              type="button"
              onClick={onCompare}
              className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Compare ({selectedPlans.size})
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-6">
        {/* ---- KPI row ---- */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            {
              label: "Avg Price/mo",
              value: `$${Math.round(kpis.avgPrice).toLocaleString()}`,
              sub: `${plans.length} plans`,
              accent: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              label: "Daily Tracking",
              value: `${kpis.dailyCount}`,
              sub: `of ${plans.length} plans`,
              accent: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Avg LLM Support",
              value: kpis.avgLlm.toFixed(1),
              sub: `of ${LLM_KEYS.length} models`,
              accent: "text-violet-600",
              bg: "bg-violet-50",
            },
            {
              label: "Global Coverage",
              value: `${kpis.globalCount}`,
              sub: `of ${plans.length} plans`,
              accent: "text-amber-600",
              bg: "bg-amber-50",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                {kpi.label}
              </div>
              <div className={`mt-1 text-2xl font-extrabold ${kpi.accent}`}>{kpi.value}</div>
              <div className="text-[11px] text-gray-400">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ---- Filter bar ---- */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Filters
            </span>
            <input
              type="text"
              placeholder="Search plans..."
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-400"
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
                    className={`cursor-pointer rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                      active
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
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
                className="cursor-pointer text-[11px] text-red-500 hover:text-red-700"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ---- Plan rows with inline bar charts ---- */}
        <div className="space-y-3">
          {plans.map((plan, i) => {
            const key = planKey(plan);
            const isSelected = selectedPlans.has(key);
            const g2 = getReviewSiteScore(plan, "g2");
            const tp = getReviewSiteScore(plan, "trustpilot");
            const tr = getReviewSiteScore(plan, "trustradius");
            const cap = getReviewSiteScore(plan, "capterra");
            const llmCount = LLM_KEYS.filter((k) => plan.llmSupport[k]).length;

            return (
              <div
                key={key}
                onClick={() => {
                  onTogglePlan(key);
                }}
                className={`group cursor-pointer rounded-xl border bg-white shadow-sm transition-all hover:shadow-md ${
                  isSelected ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"
                }`}
              >
                <div className="flex items-stretch">
                  {/* Rank indicator */}
                  <div
                    className={`flex w-12 flex-shrink-0 items-center justify-center rounded-l-xl text-sm font-bold ${
                      isSelected ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    #{i + 1}
                  </div>

                  <div className="flex-1 p-4">
                    <div className="flex flex-wrap items-start gap-6">
                      {/* Company info */}
                      <div className="min-w-[180px] flex-1">
                        <div className="flex items-center gap-2">
                          <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                          <div>
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
                        </div>
                      </div>

                      {/* Pricing block */}
                      <div className="w-28 text-right">
                        <div className="text-xl font-extrabold text-gray-900">
                          {formatPrice(plan)}
                        </div>
                        <div className="text-[10px] text-gray-400">/month</div>
                        {plan.pricePer1000Responses != null && (
                          <div className="mt-0.5 text-[10px] text-gray-500">
                            ${plan.pricePer1000Responses.toFixed(2)}/1K
                          </div>
                        )}
                      </div>

                      {/* Bar chart scores */}
                      <div className="w-48 space-y-1">
                        {g2 != null && (
                          <MetricBar value={g2} max={5} color="bg-emerald-500" label="G2" />
                        )}
                        {tp != null && (
                          <MetricBar value={tp} max={5} color="bg-blue-500" label="TP" />
                        )}
                        {tr != null && (
                          <MetricBar value={tr} max={10} color="bg-violet-500" label="TR" />
                        )}
                        {cap != null && (
                          <MetricBar value={cap} max={5} color="bg-amber-500" label="Cap" />
                        )}
                        {g2 == null && tp == null && tr == null && cap == null && (
                          <div className="text-[10px] italic text-gray-300">No ratings</div>
                        )}
                      </div>

                      {/* Stats column */}
                      <div className="w-32 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">Responses</span>
                          <span className="font-semibold text-gray-700">
                            {plan.aiResponsesMonthly != null
                              ? plan.aiResponsesMonthly.toLocaleString()
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">Schedule</span>
                          <span
                            className={`font-semibold ${plan.schedule === "daily" ? "text-green-600" : "text-gray-700"}`}
                          >
                            {plan.schedule}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">Location</span>
                          <span className="font-semibold text-gray-700">
                            {formatLocation(plan.locationSupport)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">LLMs</span>
                          <span className="font-semibold text-gray-700">
                            {llmCount}/{LLM_KEYS.length}
                          </span>
                        </div>
                      </div>

                      {/* LLM icons */}
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex flex-wrap gap-0.5">
                          {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                            <LlmIcon key={k} model={k} size={16} />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPlan(plan);
                          }}
                          className="mt-1 cursor-pointer text-[10px] text-gray-300 opacity-0 transition-opacity hover:text-indigo-500 group-hover:opacity-100"
                        >
                          Edit →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white py-20 text-center shadow-sm">
            <div className="text-lg font-medium text-gray-300">No data matches your filters</div>
            <div className="mt-1 text-sm text-gray-400">Try broadening your search criteria</div>
          </div>
        )}

        {/* Footer stats */}
        <div className="mt-6 text-center text-[11px] text-gray-400">
          Showing {plans.length} of {allPlans.length} plans · {selectedPlans.size} selected
        </div>
      </div>
    </div>
  );
}
