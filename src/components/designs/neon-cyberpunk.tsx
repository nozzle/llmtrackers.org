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
// Neon Cyberpunk Design
// Deep dark background, neon cyan/magenta/purple glow borders, gradient text,
// pulsing glow on hover, translucent frosted-glass panels, HUD grid lines.
// ---------------------------------------------------------------------------

function NeonBadge({
  children,
  color = "cyan",
}: {
  children: React.ReactNode;
  color?: "cyan" | "magenta" | "purple" | "yellow";
}) {
  const colors = {
    cyan: "border-cyan-500/50 text-cyan-400 shadow-cyan-500/20",
    magenta: "border-pink-500/50 text-pink-400 shadow-pink-500/20",
    purple: "border-purple-500/50 text-purple-400 shadow-purple-500/20",
    yellow: "border-yellow-500/50 text-yellow-400 shadow-yellow-500/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono shadow-sm ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function ScoreBar({ score, max, label }: { score: number | null; max: number; label: string }) {
  if (score == null) return <div className="text-xs text-gray-700 font-mono">{label}: --</div>;
  const pct = (score / max) * 100;
  const hue = pct > 70 ? "cyan" : pct > 50 ? "yellow" : "pink";
  return (
    <div className="group/bar">
      <div className="mb-0.5 flex justify-between text-[10px] font-mono">
        <span className="text-gray-500">{label}</span>
        <span className={`text-${hue}-400`}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-gray-800">
        <div
          className={`h-1 rounded-full bg-${hue}-500 neon-glow-${hue} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function NeonCyberpunkDesign(props: DesignProps) {
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
    <div className="cyberpunk-design -mx-4 -my-8 min-h-screen bg-[#0a0a1a] px-4 py-6 sm:-mx-6 lg:-mx-8">
      {/* Grid overlay */}
      <div className="cyberpunk-grid pointer-events-none fixed inset-0 z-0" />

      <div className="relative z-10 mx-auto max-w-[1600px]">
        {/* HUD Header */}
        <div className="mb-8 border-b border-cyan-900/30 pb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <h1 className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-4xl font-black tracking-tight text-transparent">
                LLM TRACKERS
              </h1>
              <div className="absolute -bottom-1 left-0 h-[2px] w-full bg-gradient-to-r from-cyan-500 via-transparent to-purple-500" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={onAddCompany}
                className="cyberpunk-btn cursor-pointer rounded border border-cyan-500/50 bg-cyan-950/50 px-4 py-2 text-sm font-mono font-bold text-cyan-400 shadow-lg shadow-cyan-500/10 transition-all hover:bg-cyan-900/50 hover:shadow-cyan-500/30"
              >
                + ADD UNIT
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-6 font-mono text-xs">
            <span className="text-cyan-700">
              [UNITS: <span className="text-cyan-400">{companies.length}</span>]
            </span>
            <span className="text-purple-700">
              [CONFIGS: <span className="text-purple-400">{allPlans.length}</span>]
            </span>
            <span className="text-pink-700">
              [ACTIVE: <span className="text-pink-400">{plans.length}</span>]
            </span>
          </div>
        </div>

        {/* Search + Filters HUD Panel */}
        <div className="mb-6 rounded-lg border border-cyan-900/30 bg-[#0d0d1f]/80 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cyan-700">
                &gt;_
              </span>
              <input
                type="text"
                placeholder="QUERY..."
                value={filters.q}
                onChange={(e) => {
                  updateSearch({ q: e.target.value || undefined });
                }}
                className="w-full rounded border border-cyan-900/50 bg-[#0a0a1a] py-2 pl-9 pr-3 font-mono text-sm text-cyan-400 placeholder-cyan-900 outline-none focus:border-cyan-500/50 focus:shadow-lg focus:shadow-cyan-500/10"
              />
            </div>

            {/* LLM toggles */}
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
                    className={`cursor-pointer rounded border px-2 py-1 font-mono text-[10px] font-bold tracking-wider transition-all ${
                      active
                        ? "border-cyan-500/60 bg-cyan-950/60 text-cyan-300 shadow-md shadow-cyan-500/20"
                        : "border-gray-800 text-gray-600 hover:border-cyan-800 hover:text-cyan-600"
                    }`}
                  >
                    {LLM_MODEL_LABELS[key].toUpperCase()}
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
                className="cursor-pointer font-mono text-xs text-red-500 hover:text-red-400"
              >
                [PURGE FILTERS]
              </button>
            )}

            {selectedPlans.size >= 2 && (
              <button
                onClick={onCompare}
                className="ml-auto cursor-pointer rounded border border-purple-500/50 bg-purple-950/50 px-4 py-2 font-mono text-sm font-bold text-purple-400 shadow-lg shadow-purple-500/10 transition-all hover:bg-purple-900/40 hover:shadow-purple-500/30"
              >
                COMPARE [{selectedPlans.size}]
              </button>
            )}
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan) => {
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
                className={`cyberpunk-card group relative cursor-pointer rounded-lg border bg-[#0d0d1f]/60 p-4 backdrop-blur-sm transition-all duration-300 hover:shadow-2xl ${
                  isSelected
                    ? "border-cyan-500/60 shadow-lg shadow-cyan-500/20"
                    : "border-gray-800/50 hover:border-cyan-800/50 hover:shadow-cyan-500/10"
                }`}
              >
                {/* Corner decorations */}
                <div className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-cyan-500/40" />
                <div className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-cyan-500/40" />
                <div className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-cyan-500/40" />
                <div className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-cyan-500/40" />

                {isSelected && (
                  <div className="absolute -right-1 -top-1 rounded-bl rounded-tr bg-cyan-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-black">
                    SEL
                  </div>
                )}

                {/* Company */}
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-lg border border-cyan-900/30 p-1">
                    <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/companies/$slug"
                      params={{ slug: plan.companySlug }}
                      className="block truncate font-mono text-sm font-bold text-cyan-400 hover:text-cyan-300"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      {plan.companyName}
                    </Link>
                    <div className="font-mono text-[10px] text-gray-600">{plan.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditPlan(plan);
                    }}
                    className="cursor-pointer font-mono text-[10px] text-gray-700 opacity-0 transition-opacity hover:text-cyan-500 group-hover:opacity-100"
                  >
                    [MOD]
                  </button>
                </div>

                {/* Price */}
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text font-mono text-2xl font-black text-transparent">
                    {formatPrice(plan)}
                  </div>
                  <NeonBadge color={plan.schedule === "daily" ? "cyan" : "purple"}>
                    {plan.schedule === "daily" ? "DAILY" : "WEEKLY"}
                  </NeonBadge>
                </div>

                {/* Score bars */}
                <div className="mb-3 grid gap-1.5">
                  <ScoreBar score={g2} max={5} label="G2" />
                  <ScoreBar score={tp} max={5} label="TP" />
                  <ScoreBar score={tr} max={10} label="TR" />
                  <ScoreBar score={cap} max={5} label="CP" />
                </div>

                {/* Stats */}
                <div className="mb-3 grid grid-cols-2 gap-2 rounded border border-gray-800/50 bg-[#0a0a18] p-2 font-mono text-xs">
                  <div>
                    <div className="text-[9px] text-gray-600">RESPONSES</div>
                    <div className="text-cyan-400">
                      {plan.aiResponsesMonthly != null
                        ? plan.aiResponsesMonthly >= 1000000
                          ? `${(plan.aiResponsesMonthly / 1000000).toFixed(1)}M`
                          : plan.aiResponsesMonthly >= 1000
                            ? `${(plan.aiResponsesMonthly / 1000).toFixed(0)}K`
                            : String(plan.aiResponsesMonthly)
                        : "--"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-600">EFFICIENCY</div>
                    <div className="text-purple-400">
                      {plan.pricePer1000Responses != null
                        ? `$${plan.pricePer1000Responses.toFixed(2)}`
                        : "--"}
                    </div>
                  </div>
                </div>

                {/* LLMs */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {LLM_KEYS.filter((k) => plan.llmSupport[k]).map((k) => (
                      <div key={k} className="rounded border border-gray-800/50 p-0.5">
                        <LlmIcon model={k} size={14} />
                      </div>
                    ))}
                  </div>
                  <span className="font-mono text-[10px] text-gray-600">
                    {formatLocation(plan.locationSupport)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {plans.length === 0 && (
          <div className="mt-16 text-center font-mono text-cyan-800">
            <div className="text-2xl">NO SIGNAL</div>
            <div className="mt-2 text-sm text-gray-700">
              Adjust query parameters to acquire targets.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
