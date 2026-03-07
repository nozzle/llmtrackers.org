import { createFileRoute, Link } from "@tanstack/react-router";
import { getPlanByKey, getAllCompanies } from "~/data";
import type { ComparisonPlan } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import { LLM_MODEL_LABELS } from "@llm-tracker/shared";
import type { LlmModelKey } from "@llm-tracker/shared";
import { z } from "zod";

const compareSearchSchema = z.object({
  plans: z.string().optional(),
});

export const Route = createFileRoute("/compare")({
  component: ComparePage,
  validateSearch: compareSearchSchema,
  head: () => ({
    meta: [
      { title: "Compare Plans - LLM Trackers" },
      {
        name: "description",
        content:
          "Compare AI search visibility tool plans side-by-side. See pricing, LLM support, features, and integrations at a glance.",
      },
      { property: "og:title", content: "Compare Plans - LLM Trackers" },
      {
        property: "og:description",
        content:
          "Side-by-side plan comparison for AI search visibility tools.",
      },
    ],
  }),
});

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

interface ComparisonRow {
  label: string;
  values: (plan: ComparisonPlan) => string | boolean;
  type?: "boolean" | "text";
}

const ROWS: ComparisonRow[] = [
  {
    label: "Price / month",
    values: (p) =>
      p.price.amount !== null
        ? `$${p.price.amount.toLocaleString()}`
        : "Custom",
  },
  {
    label: "Price note",
    values: (p) => p.price.note ?? "-",
  },
  {
    label: "Cost per 1K responses",
    values: (p) =>
      p.pricePer1000Responses != null
        ? `$${p.pricePer1000Responses.toFixed(2)}`
        : "-",
  },
  {
    label: "AI Responses / month",
    values: (p) => p.aiResponsesMonthly?.toLocaleString() ?? "-",
  },
  {
    label: "Included LLM Models",
    values: (p) => String(p.includedLlmModels ?? "-"),
  },
  {
    label: "Schedule",
    values: (p) => p.schedule,
  },
  {
    label: "Location Support",
    values: (p) =>
      p.locationSupport === "global"
        ? "Global"
        : `${p.locationSupport} regions`,
  },
  {
    label: "Persona Support",
    values: (p) =>
      p.personaSupport === "unlimited"
        ? "Unlimited"
        : String(p.personaSupport),
  },
  {
    label: "Content Generation",
    values: (p) =>
      p.contentGeneration === false ? false : p.contentGeneration,
    type: "boolean",
  },
  {
    label: "Content Optimization",
    values: (p) =>
      p.contentOptimization === false ? false : p.contentOptimization,
    type: "boolean",
  },
  ...LLM_KEYS.map(
    (key): ComparisonRow => ({
      label: LLM_MODEL_LABELS[key],
      values: (p) => p.llmSupport[key],
      type: "boolean",
    })
  ),
];

function ComparePage() {
  const { plans: plansParam } = Route.useSearch();
  const companies = getAllCompanies();

  const planKeys = plansParam ? plansParam.split(",") : [];
  const plans = planKeys
    .map((k) => getPlanByKey(k))
    .filter((p): p is ComparisonPlan => p !== undefined);

  if (plans.length < 2) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Compare Plans</h1>
        <p className="mt-2 text-gray-600">
          Select at least 2 plans from the{" "}
          <Link to="/" className="text-blue-600 hover:underline">
            comparison table
          </Link>{" "}
          to compare them side-by-side.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Plan Comparison
        </h1>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Feature
              </th>
              {plans.map((plan) => {
                const company = companies.find(
                  (c) => c.slug === plan.companySlug
                );
                return (
                  <th
                    key={`${plan.companySlug}/${plan.slug}`}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    <div className="flex items-center gap-3">
                      <CompanyMark slug={plan.companySlug} name={plan.companyName} size="sm" />
                      <div>
                        <Link
                          to="/companies/$slug"
                          params={{ slug: plan.companySlug }}
                          className="text-blue-600 hover:underline"
                        >
                          {plan.companyName}
                        </Link>
                        <div className="font-normal normal-case text-gray-400">
                          {plan.name}
                        </div>
                      </div>
                    </div>
                    {company?.score && (
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        {company.score.total}/{company.score.maxTotal}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ROWS.map((row) => (
              <tr key={row.label} className="group hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm font-medium text-gray-900 group-hover:bg-gray-50">
                  {row.label}
                </td>
                {plans.map((plan) => {
                  const val = row.values(plan);
                  return (
                    <td
                      key={`${plan.companySlug}/${plan.slug}`}
                      className="px-4 py-3 text-sm"
                    >
                      {row.type === "boolean" ? (
                        typeof val === "boolean" ? (
                          val ? (
                            <span className="text-green-600">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )
                        ) : (
                          <span className="text-green-600">{String(val)}</span>
                        )
                      ) : (
                        <span>{String(val)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Integrations row */}
            <tr className="group hover:bg-gray-50">
              <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm font-medium text-gray-900 group-hover:bg-gray-50">
                Integrations
              </td>
              {plans.map((plan) => (
                <td
                  key={`${plan.companySlug}/${plan.slug}`}
                  className="px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap gap-1">
                    {plan.integrations.map((int) => (
                      <span
                        key={int}
                        className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
                      >
                        {int}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
