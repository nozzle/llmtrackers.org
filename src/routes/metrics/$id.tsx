import { createFileRoute, Link } from "@tanstack/react-router";
import { getMetricById, getCompanyBySlug } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import type { MetricSupport } from "@llm-tracker/shared";

function formatMetricName(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface CompanyGroup {
  companySlug: string;
  companyName: string;
  plans: MetricSupport[];
}

function groupByCompany(supportedBy: MetricSupport[]): CompanyGroup[] {
  const map = new Map<string, MetricSupport[]>();
  for (const entry of supportedBy) {
    const existing = map.get(entry.companySlug);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(entry.companySlug, [entry]);
    }
  }

  return [...map.entries()]
    .map(([companySlug, plans]) => ({
      companySlug,
      companyName: getCompanyBySlug(companySlug)?.name ?? companySlug,
      plans,
    }))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export const Route = createFileRoute("/metrics/$id")({
  component: MetricPage,
  head: ({ params }) => {
    const metric = getMetricById(params.id);
    const title = metric ? `${formatMetricName(metric.id)} - LLM Trackers` : "Metric Not Found";
    const description = metric ? metric.description : "";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
});

function MetricPage() {
  const { id } = Route.useParams();
  const metric = getMetricById(id);

  if (!metric) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Metric Not Found</h1>
        <p className="mt-2 text-gray-600">No metric found with id &quot;{id}&quot;.</p>
        <Link to="/metrics" className="mt-4 inline-block text-blue-600 hover:underline">
          Back to metrics
        </Link>
      </div>
    );
  }

  const companyGroups = groupByCompany(metric.supportedBy);
  const uniqueCompanyCount = companyGroups.length;
  const totalPlanCount = metric.supportedBy.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link to="/metrics" className="text-sm text-blue-600 hover:underline">
          &larr; All metrics
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-gray-900">{formatMetricName(metric.id)}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span>
            {uniqueCompanyCount} {uniqueCompanyCount === 1 ? "company" : "companies"}
          </span>
          <span>
            {totalPlanCount} {totalPlanCount === 1 ? "plan" : "plans"}
          </span>
        </div>

        <div className="mt-5 max-w-3xl rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Description
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-700">{metric.description}</p>
        </div>
      </div>

      {/* Supported by */}
      <section>
        <h2 className="mb-1 text-xl font-semibold text-gray-900">Supported By</h2>
        <p className="mb-6 text-sm text-gray-600">Companies and plans that track this metric.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companyGroups.map((group) => {
            const company = getCompanyBySlug(group.companySlug);

            return (
              <article
                key={group.companySlug}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                {/* Company header */}
                <div className="flex items-center gap-3">
                  {company && <CompanyMark slug={company.slug} name={company.name} size="sm" />}
                  <Link
                    to="/companies/$slug"
                    params={{ slug: group.companySlug }}
                    className="font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {group.companyName}
                  </Link>
                </div>

                {/* Plans */}
                <div className="mt-4 space-y-3">
                  {group.plans.map((plan) => (
                    <div
                      key={`${plan.companySlug}/${plan.planSlug}`}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          {plan.planSlug
                            .split("-")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")}
                        </span>
                        {plan.vendorName && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {plan.vendorName}
                          </span>
                        )}
                      </div>
                      {plan.caveats && (
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{plan.caveats}</p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
