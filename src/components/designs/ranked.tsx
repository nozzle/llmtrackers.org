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
// Ranked Design
// Sports leaderboard / esports ranking aesthetic: bold rank numbers, medal
// badges for top 3, progress bars for review scores, condensed rows with
// strong visual hierarchy. Fully sortable with active column highlight.
// ---------------------------------------------------------------------------

const SORTABLE_COLS: readonly { id: string; label: string; align: string; sortable?: boolean }[] = [
  { id: "name", label: "Team", align: "text-left" },
  { id: "plan", label: "Tier", align: "text-left", sortable: false },
  { id: "price", label: "Price", align: "text-right" },
  { id: "costEfficiency", label: "Efficiency", align: "text-right" },
  { id: "responses", label: "Volume", align: "text-right" },
  { id: "g2", label: "G2", align: "text-center" },
  { id: "trustpilot", label: "TP", align: "text-center" },
  { id: "trustradius", label: "TR", align: "text-center" },
  { id: "capterra", label: "CAP", align: "text-center" },
  { id: "schedule", label: "Freq", align: "text-center", sortable: false },
  { id: "llms", label: "Models", align: "text-left", sortable: false },
  { id: "location", label: "Region", align: "text-center", sortable: false },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 text-sm font-black text-white shadow-lg shadow-amber-500/30">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-300 to-gray-500 text-sm font-black text-white shadow-lg shadow-gray-400/30">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-sm font-black text-white shadow-lg shadow-amber-700/30">
        3
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-400">
      {rank}
    </div>
  );
}

function ScoreBar({ value, max, color }: { value: number | null; max: number; color: string }) {
  if (value == null) return <span className="text-xs text-neutral-600">—</span>;
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-neutral-300">{value.toFixed(1)}</span>
    </div>
  );
}

export function RankedDesign(props: DesignProps) {
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
      className="-mx-4 -my-8 min-h-screen bg-[#0a0a0f] px-4 py-8 text-white sm:-mx-6 lg:-mx-8"
      style={{ fontFamily: "'Inter', 'Barlow', -apple-system, sans-serif" }}
    >
      <div className="mx-auto max-w-[1500px]">
        {/* Header — leaderboard style */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-2xl shadow-lg shadow-amber-500/20">
              🏆
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">
                Leaderboard
              </h1>
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Season 2025 &middot; {plans.length} contenders &middot; {companies.length} orgs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onAddCompany}
              className="cursor-pointer rounded-lg border border-neutral-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-colors hover:border-amber-500 hover:text-amber-400"
            >
              + Register
            </button>
            {selectedPlans.size >= 2 && (
              <button
                type="button"
                onClick={onCompare}
                className="cursor-pointer rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-amber-500/20 transition-transform hover:scale-105"
              >
                Head-to-Head ({selectedPlans.size})
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800/50 bg-[#111118] p-3">
          {/* Search */}
          <input
            type="text"
            value={filters.q}
            onChange={(e) => {
              updateSearch({ q: e.target.value || undefined });
            }}
            placeholder="Search teams…"
            className="rounded-lg border border-neutral-800 bg-[#0a0a0f] px-3 py-1.5 text-sm text-white outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-500/50"
            style={{ width: 180 }}
          />

          <div className="h-5 w-px bg-neutral-800" />

          {/* LLM filters */}
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
                className={`cursor-pointer rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  active
                    ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                    : "text-neutral-600 hover:text-neutral-400"
                }`}
              >
                {LLM_MODEL_LABELS[key]}
              </button>
            );
          })}

          {activeFilterCount > 0 && (
            <>
              <div className="h-5 w-px bg-neutral-800" />
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
                className="cursor-pointer text-[11px] font-bold uppercase text-red-400 hover:text-red-300"
              >
                Reset
              </button>
            </>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-neutral-800/50 bg-[#111118]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="w-10 py-3 pl-4 text-left text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                  Rk
                </th>
                <th className="w-10 py-3" />
                {SORTABLE_COLS.map((col) => {
                  const canSort = col.sortable !== false;
                  const isActive = sortBy === col.id;
                  return (
                    <th
                      key={col.id}
                      onClick={canSort ? () => { onToggleSort(col.id); } : undefined}
                      className={`py-3 px-3 text-[10px] font-bold uppercase tracking-widest ${col.align} ${
                        isActive ? "text-amber-400" : "text-neutral-600"
                      } ${canSort ? "cursor-pointer select-none transition-colors hover:text-neutral-300" : ""}`}
                    >
                      {col.label}
                      {canSort && isActive && (
                        <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan, idx) => {
                const key = planKey(plan);
                const isSelected = selectedPlans.has(key);
                const rank = idx + 1;
                const g2 = getReviewSiteScore(plan, "g2");
                const tp = getReviewSiteScore(plan, "trustpilot");
                const tr = getReviewSiteScore(plan, "trustradius");
                const cap = getReviewSiteScore(plan, "capterra");

                return (
                  <tr
                    key={key}
                    onClick={() => { onTogglePlan(key); }}
                    className={`cursor-pointer border-b border-neutral-800/30 transition-colors ${
                      isSelected
                        ? "bg-amber-500/10"
                        : rank <= 3
                          ? "bg-[#13131a] hover:bg-[#1a1a24]"
                          : "hover:bg-[#16161e]"
                    }`}
                  >
                    {/* Rank */}
                    <td className="py-2.5 pl-4">
                      <RankBadge rank={rank} />
                    </td>
                    {/* Checkbox */}
                    <td className="py-2.5">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? "border-amber-500 bg-amber-500 text-white"
                            : "border-neutral-700"
                        }`}
                      >
                        {isSelected && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </td>
                    {/* Team name */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                        <Link
                          to="/companies/$slug"
                          params={{ slug: plan.companySlug }}
                          className={`text-sm font-semibold ${
                            rank <= 3 ? "text-white" : "text-neutral-200"
                          } hover:text-amber-400`}
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          {plan.companyName}
                        </Link>
                      </div>
                    </td>
                    {/* Tier */}
                    <td className="px-3 py-2.5 text-xs text-neutral-500">{plan.name}</td>
                    {/* Price */}
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-white">
                      {formatPrice(plan)}
                    </td>
                    {/* Cost Efficiency */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-neutral-400">
                      {plan.pricePer1000Responses != null ? `$${plan.pricePer1000Responses.toFixed(2)}` : "—"}
                    </td>
                    {/* Responses */}
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-neutral-400">
                      {plan.aiResponsesMonthly != null ? plan.aiResponsesMonthly.toLocaleString() : "—"}
                    </td>
                    {/* Review scores with progress bars */}
                    <td className="px-3 py-2.5">
                      <ScoreBar value={g2} max={5} color="bg-emerald-500" />
                    </td>
                    <td className="px-3 py-2.5">
                      <ScoreBar value={tp} max={5} color="bg-blue-500" />
                    </td>
                    <td className="px-3 py-2.5">
                      <ScoreBar value={tr} max={10} color="bg-purple-500" />
                    </td>
                    <td className="px-3 py-2.5">
                      <ScoreBar value={cap} max={5} color="bg-orange-500" />
                    </td>
                    {/* Schedule */}
                    <td className="px-3 py-2.5 text-center text-xs text-neutral-500">{plan.schedule}</td>
                    {/* LLMs */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-0.5">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                          <LlmIcon key={k} model={k} size={13} />
                        ))}
                      </div>
                    </td>
                    {/* Location */}
                    <td className="px-3 py-2.5 text-center text-xs text-neutral-500">
                      {formatLocation(plan.locationSupport)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {plans.length === 0 && (
            <div className="py-16 text-center text-sm text-neutral-600">
              No contenders match the current filters.
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="mt-6 flex items-center justify-between text-xs text-neutral-600">
          <span>
            {plans.length} of {allPlans.length} ranked
          </span>
          <span>
            {selectedPlans.size > 0 ? `${selectedPlans.size} selected for comparison` : "Click rows to select for head-to-head"}
          </span>
        </div>
      </div>
    </div>
  );
}
