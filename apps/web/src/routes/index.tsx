import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { getAllCompanies, getAllPlansWithCompany } from "~/data";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import type { LlmModelKey, PlanWithCompany } from "@llm-tracker/shared";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      {
        title:
          "LLM Tracker Comparison - Compare AI Search Visibility Tools",
      },
      {
        name: "description",
        content:
          "Compare 19 AI search visibility and LLM tracking tools across 23 plans. Filter by price, LLM support, schedule, and more.",
      },
      { property: "og:title", content: "Compare AI Search Visibility Tools" },
      {
        property: "og:description",
        content:
          "Side-by-side comparison of 19 LLM tracking tools. Pricing, features, LLM support, integrations, and scores.",
      },
    ],
  }),
});

function formatPrice(plan: PlanWithCompany): string {
  if (plan.price.amount === null) return "Custom";
  const formatted = `$${plan.price.amount.toLocaleString()}`;
  return plan.price.note ? `${formatted}*` : formatted;
}

function formatLocation(loc: string | number): string {
  if (loc === "global") return "Global";
  return `${loc} regions`;
}

function formatPersonas(p: string | number): string {
  if (p === "unlimited") return "Unlimited";
  return String(p);
}

const LLM_KEYS: LlmModelKey[] = [
  "chatgpt",
  "gemini",
  "perplexity",
  "claude",
  "llama",
  "grok",
  "aiOverviews",
  "aiMode",
];

function HomePage() {
  const allPlans = getAllPlansWithCompany();
  const companies = getAllCompanies();

  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState<string>("all");
  const [llmFilter, setLlmFilter] = useState<LlmModelKey | "all">("all");
  const [sortBy, setSortBy] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const navigate = useNavigate();

  // Get company scores for sorting
  const companyScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of companies) {
      map.set(c.slug, c.score?.total ?? 0);
    }
    return map;
  }, [companies]);

  const filteredPlans = useMemo(() => {
    let result = allPlans;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.companyName.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      );
    }

    if (scheduleFilter !== "all") {
      result = result.filter((p) => p.schedule === scheduleFilter);
    }

    if (llmFilter !== "all") {
      result = result.filter((p) => p.llmSupport[llmFilter]);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "price":
          cmp = (a.price.amount ?? 99999) - (b.price.amount ?? 99999);
          break;
        case "responses":
          cmp =
            (a.aiResponsesMonthly ?? 0) - (b.aiResponsesMonthly ?? 0);
          break;
        case "score":
          cmp =
            (companyScores.get(a.companySlug) ?? 0) -
            (companyScores.get(b.companySlug) ?? 0);
          break;
        case "name":
          cmp = a.companyName.localeCompare(b.companyName);
          break;
        case "costEfficiency":
          cmp =
            (a.pricePer1000Responses ?? 999) -
            (b.pricePer1000Responses ?? 999);
          break;
        default:
          cmp = 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [allPlans, searchQuery, scheduleFilter, llmFilter, sortBy, sortDir, companyScores]);

  function togglePlan(key: string) {
    setSelectedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCompare() {
    if (selectedPlans.size < 2) return;
    const plans = Array.from(selectedPlans).join(",");
    navigate({ to: "/compare", search: { plans } });
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir(column === "name" ? "asc" : "desc");
    }
  }

  const sortIndicator = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          AI Search Visibility Tool Comparison
        </h1>
        <p className="mt-2 text-gray-600">
          Compare {companies.length} LLM tracking tools across{" "}
          {allPlans.length} plans. Select plans to compare side-by-side.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search companies or plans..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
        />

        <select
          value={scheduleFilter}
          onChange={(e) => setScheduleFilter(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto"
        >
          <option value="all">All Schedules</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>

        <select
          value={llmFilter}
          onChange={(e) => setLlmFilter(e.target.value as LlmModelKey | "all")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto"
        >
          <option value="all">All LLMs</option>
          {LLM_KEYS.map((key) => (
            <option key={key} value={key}>
              {LLM_MODEL_LABELS[key]}
            </option>
          ))}
        </select>

        {selectedPlans.size >= 2 && (
          <button
            onClick={handleCompare}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Compare {selectedPlans.size} Plans
          </button>
        )}

        {selectedPlans.size > 0 && (
          <button
            onClick={() => setSelectedPlans(new Set())}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear selection
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 w-10 bg-gray-50 px-3 py-3">
                <span className="sr-only">Select</span>
              </th>
              <th
                className="sticky left-10 z-10 cursor-pointer bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                onClick={() => toggleSort("name")}
              >
                Company / Plan{sortIndicator("name")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                onClick={() => toggleSort("score")}
              >
                Score{sortIndicator("score")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                onClick={() => toggleSort("price")}
              >
                Price/mo{sortIndicator("price")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                onClick={() => toggleSort("costEfficiency")}
              >
                $/1K Resp.{sortIndicator("costEfficiency")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                onClick={() => toggleSort("responses")}
              >
                AI Resp./mo{sortIndicator("responses")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Schedule
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                LLM Support
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Locations
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPlans.map((plan) => {
              const key = `${plan.companySlug}/${plan.slug}`;
              const isSelected = selectedPlans.has(key);
              const company = companies.find(
                (c) => c.slug === plan.companySlug
              );
              return (
                <tr
                  key={key}
                  className={`${isSelected ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors`}
                >
                  <td className={`sticky left-0 z-10 px-3 py-3 ${isSelected ? "bg-blue-50" : "bg-white"}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlan(key)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className={`sticky left-10 z-10 px-4 py-3 ${isSelected ? "bg-blue-50" : "bg-white"}`}>
                    <div>
                      <Link
                        to="/companies/$slug"
                        params={{ slug: plan.companySlug }}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {plan.companyName}
                      </Link>
                      <span className="ml-2 text-sm text-gray-500">
                        {plan.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {company?.score ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {company.score.total}/{company.score.maxTotal}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {formatPrice(plan)}
                    {plan.price.note && (
                      <div className="text-xs text-gray-400">
                        {plan.price.note}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {plan.pricePer1000Responses != null
                      ? `$${plan.pricePer1000Responses.toFixed(2)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {plan.aiResponsesMonthly != null
                      ? plan.aiResponsesMonthly.toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.schedule === "daily"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {plan.schedule}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {LLM_KEYS.filter((k) => plan.llmSupport[k]).map(
                        (k) => (
                          <span
                            key={k}
                            className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700"
                          >
                            {LLM_MODEL_LABELS[k]}
                          </span>
                        )
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatLocation(plan.locationSupport)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredPlans.length === 0 && (
        <div className="mt-8 text-center text-gray-500">
          No plans match your filters. Try adjusting your search criteria.
        </div>
      )}
    </div>
  );
}
