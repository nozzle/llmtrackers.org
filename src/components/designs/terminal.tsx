import { Link } from "@tanstack/react-router";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import {
  type DesignProps,
  LLM_KEYS,
  formatPrice,
  getReviewSiteScore,
  planKey,
} from "./design-props";

// ---------------------------------------------------------------------------
// Terminal / Hacker Design
// Green-on-black CRT aesthetic, monospace everything, scanlines, ASCII table.
// ---------------------------------------------------------------------------

function TerminalPrompt({ children }: { children: React.ReactNode }) {
  return (
    <span>
      <span className="text-green-600">root@llmtrackers</span>
      <span className="text-gray-500">:</span>
      <span className="text-blue-400">~</span>
      <span className="text-gray-500">$ </span>
      <span className="text-green-400">{children}</span>
    </span>
  );
}

export function TerminalDesign(props: DesignProps) {
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

  const _llmCount = (plan: DesignProps["plans"][0]) =>
    LLM_KEYS.filter((k) => plan.llmSupport[k]).length;

  return (
    <div className="terminal-design -mx-4 -my-8 min-h-screen bg-[#0a0a0a] px-4 py-6 font-mono text-green-400 sm:-mx-6 lg:-mx-8">
      {/* Scanline overlay */}
      <div className="terminal-scanlines pointer-events-none fixed inset-0 z-50" />

      <div className="relative z-10 mx-auto max-w-[1600px]">
        {/* Terminal header */}
        <div className="mb-6 rounded-t-lg border border-green-900/50 bg-[#0d0d0d]">
          <div className="flex items-center gap-2 border-b border-green-900/30 px-4 py-2">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-green-700">llmtrackers -- bash -- 180x50</span>
          </div>
          <div className="p-4">
            <div className="mb-2 text-green-600">
              {"/* ============================================================ */"}
            </div>
            <div className="text-green-300">
              {"/*  LLM TRACKERS v2.0 - AI Search Visibility Tool Comparison   */"}
            </div>
            <div className="text-green-600">
              {"/*  "}
              {companies.length}
              {" companies | "}
              {allPlans.length}
              {" plans | real-time data                */"}
            </div>
            <div className="mb-2 text-green-600">
              {"/* ============================================================ */"}
            </div>
          </div>
        </div>

        {/* Command line search */}
        <div className="mb-4 rounded border border-green-900/30 bg-[#0d0d0d] p-4">
          <div className="flex items-center gap-2">
            <TerminalPrompt>grep -i "</TerminalPrompt>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => {
                updateSearch({ q: e.target.value || undefined });
              }}
              placeholder="search_pattern"
              className="flex-1 bg-transparent text-green-400 placeholder-green-800 outline-none caret-green-400"
            />
            <span className="text-green-600">" ./companies/*</span>
          </div>

          {/* LLM filter as flags */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-green-700">--llm-filter=</span>
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
                  className={`cursor-pointer rounded px-1.5 py-0.5 text-xs transition-colors ${
                    active
                      ? "bg-green-900/50 text-green-300 ring-1 ring-green-700"
                      : "text-green-800 hover:text-green-600"
                  }`}
                >
                  {LLM_MODEL_LABELS[key]}
                </button>
              );
            })}
          </div>

          {/* Status line */}
          <div className="mt-3 flex items-center gap-4 text-xs text-green-700">
            <span>
              Found: <span className="text-green-400">{plans.length}</span> results
            </span>
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
                className="cursor-pointer text-red-500 hover:text-red-400"
              >
                [reset filters]
              </button>
            )}
            {selectedPlans.size >= 2 && (
              <button
                onClick={onCompare}
                className="cursor-pointer text-yellow-500 hover:text-yellow-400"
              >
                [compare {selectedPlans.size} selected]
              </button>
            )}
            <button
              type="button"
              onClick={onAddCompany}
              className="cursor-pointer text-cyan-600 hover:text-cyan-400"
            >
              [+ add company]
            </button>
          </div>
        </div>

        {/* ASCII Table */}
        <div className="overflow-x-auto rounded border border-green-900/30 bg-[#0d0d0d] p-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-green-600">
                <th className="px-2 py-1 text-left">SEL</th>
                <th className="px-2 py-1 text-left">COMPANY</th>
                <th className="px-2 py-1 text-left">PLAN</th>
                <th className="px-2 py-1 text-right">G2</th>
                <th className="px-2 py-1 text-right">TRUST</th>
                <th className="px-2 py-1 text-right">PRICE</th>
                <th className="px-2 py-1 text-right">$/1K</th>
                <th className="px-2 py-1 text-right">RESP/MO</th>
                <th className="px-2 py-1 text-center">SCHED</th>
                <th className="px-2 py-1 text-left">LLMs</th>
                <th className="px-2 py-1 text-left">LOC</th>
                <th className="px-2 py-1 text-left">ACT</th>
              </tr>
              <tr>
                <td colSpan={12} className="text-green-900">
                  {"─".repeat(140)}
                </td>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan, _i) => {
                const key = planKey(plan);
                const isSelected = selectedPlans.has(key);
                const g2 = getReviewSiteScore(plan, "g2");
                const tp = getReviewSiteScore(plan, "trustpilot");

                return (
                  <tr
                    key={key}
                    className={`transition-colors ${
                      isSelected
                        ? "bg-green-900/20 text-green-300"
                        : "text-green-400 hover:bg-green-900/10"
                    }`}
                  >
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          onTogglePlan(key);
                        }}
                        className="cursor-pointer"
                      >
                        {isSelected ? "[x]" : "[ ]"}
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      <Link
                        to="/companies/$slug"
                        params={{ slug: plan.companySlug }}
                        className="text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        {plan.companyName}
                      </Link>
                    </td>
                    <td className="px-2 py-1 text-green-600">{plan.name}</td>
                    <td className="px-2 py-1 text-right">
                      {g2 != null ? (
                        <span
                          className={
                            g2 >= 4
                              ? "text-green-300"
                              : g2 >= 3
                                ? "text-yellow-500"
                                : "text-red-500"
                          }
                        >
                          {g2.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-green-900">---</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {tp != null ? (
                        <span
                          className={
                            tp >= 4
                              ? "text-green-300"
                              : tp >= 3
                                ? "text-yellow-500"
                                : "text-red-500"
                          }
                        >
                          {tp.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-green-900">---</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right text-yellow-400">{formatPrice(plan)}</td>
                    <td className="px-2 py-1 text-right">
                      {plan.pricePer1000Responses != null
                        ? `$${plan.pricePer1000Responses.toFixed(2)}`
                        : "---"}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {plan.aiResponsesMonthly != null
                        ? plan.aiResponsesMonthly.toLocaleString()
                        : "---"}
                    </td>
                    <td className="px-2 py-1 text-center">
                      <span
                        className={plan.schedule === "daily" ? "text-cyan-400" : "text-green-700"}
                      >
                        {plan.schedule === "daily" ? "DLY" : "WKL"}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <span className="text-green-500">
                        {LLM_KEYS.filter((k) => plan.llmSupport[k])
                          .map((k) => LLM_MODEL_LABELS[k].slice(0, 3).toUpperCase())
                          .join(" ")}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-green-600">
                      {plan.locationSupport === "global" ? "GLB" : `${plan.locationSupport}r`}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          onEditPlan(plan);
                        }}
                        className="cursor-pointer text-yellow-600 hover:text-yellow-400"
                      >
                        [edit]
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {plans.length === 0 && (
          <div className="mt-6 rounded border border-green-900/30 bg-[#0d0d0d] p-4 text-center text-green-700">
            <TerminalPrompt>echo "No results found"</TerminalPrompt>
            <div className="mt-2 text-green-600">No results found</div>
          </div>
        )}

        {/* Footer status bar */}
        <div className="mt-4 flex items-center justify-between border-t border-green-900/30 pt-3 text-xs text-green-800">
          <span>PID: 42069 | MEM: 128MB | CPU: 2.3%</span>
          <span className="terminal-blink">_</span>
        </div>
      </div>
    </div>
  );
}
