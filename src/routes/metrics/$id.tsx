import { createFileRoute, Link } from "@tanstack/react-router";
import { getMetricById, getCompanyBySlug } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import type { MetricSupport } from "@llm-tracker/shared";
import { formatMetricId, formatPlanSlug } from "~/metrics";

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
    const title = metric ? `${formatMetricId(metric.id)} - LLM Trackers` : "Metric Not Found";
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
  const params = Route.useParams();
  const { id } = params;
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
  const vendorLabels = Array.from(
    new Set(
      metric.supportedBy
        .map((support) => support.vendorName)
        .filter((vendorName): vendorName is string => Boolean(vendorName)),
    ),
  );
  const caveatCount = metric.supportedBy.filter((support) => Boolean(support.caveats)).length;

  return (
    <div>
      <div className="mb-8">
        <Link to="/metrics" className="text-sm text-blue-600 hover:underline">
          &larr; All metrics
        </Link>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
                {metric.id}
              </div>
              <h1 className="mt-3 text-3xl font-bold text-gray-900">{formatMetricId(metric.id)}</h1>
              <p className="mt-3 text-base leading-7 text-gray-600">{metric.description}</p>

              {vendorLabels.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {vendorLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid min-w-[260px] gap-3 sm:grid-cols-3 lg:w-[340px] lg:grid-cols-1">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Companies
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{uniqueCompanyCount}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Supported Plans
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{totalPlanCount}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Caveated Plans
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{caveatCount}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="mb-1 text-xl font-semibold text-gray-900">Supported By</h2>
            <p className="text-sm text-gray-600">
              Companies and plans that track this metric, including vendor-specific labels and
              caveats.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {companyGroups.slice(0, 6).map((group) => {
              const company = getCompanyBySlug(group.companySlug);
              return (
                <Link
                  key={group.companySlug}
                  to="/companies/$slug"
                  params={{ slug: group.companySlug }}
                  className="transition-transform hover:-translate-y-0.5"
                  title={group.companyName}
                >
                  <CompanyMark
                    slug={group.companySlug}
                    name={company?.name ?? group.companyName}
                    size="sm"
                  />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companyGroups.map((group) => {
            const company = getCompanyBySlug(group.companySlug);
            const vendorCount = group.plans.filter((plan) => Boolean(plan.vendorName)).length;
            const caveatedPlanCount = group.plans.filter((plan) => Boolean(plan.caveats)).length;

            return (
              <article
                key={group.companySlug}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {company && <CompanyMark slug={company.slug} name={company.name} size="sm" />}
                    <div>
                      <Link
                        to="/companies/$slug"
                        params={{ slug: group.companySlug }}
                        className="font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {group.companyName}
                      </Link>
                      <div className="mt-1 text-xs text-gray-500">
                        {group.plans.length} supported plan{group.plans.length === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                  {(vendorCount > 0 || caveatedPlanCount > 0) && (
                    <div className="text-right text-xs text-gray-500">
                      {vendorCount > 0 && (
                        <div>
                          {vendorCount} vendor label{vendorCount === 1 ? "" : "s"}
                        </div>
                      )}
                      {caveatedPlanCount > 0 && (
                        <div>
                          {caveatedPlanCount} caveat{caveatedPlanCount === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {group.plans.map((plan) => (
                    <div
                      key={`${plan.companySlug}/${plan.planSlug}`}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {company?.plans.find((entry) => entry.slug === plan.planSlug)?.name ??
                            formatPlanSlug(plan.planSlug)}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {plan.vendorName && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              {plan.vendorName}
                            </span>
                          )}
                          <Link
                            to="/companies/$slug"
                            params={{ slug: group.companySlug }}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            View company
                          </Link>
                        </div>
                      </div>
                      {plan.caveats && (
                        <p className="mt-2 text-xs leading-relaxed text-gray-600">{plan.caveats}</p>
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
