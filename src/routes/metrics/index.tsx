import { createFileRoute, Link } from "@tanstack/react-router";
import { getAllMetrics, getCompanyBySlug } from "~/data";
import { CompanyMark } from "~/components/company-mark";

function formatMetricName(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const Route = createFileRoute("/metrics/")({
  component: MetricsIndexPage,
  head: () => ({
    meta: [
      { title: "Metrics - LLM Trackers" },
      {
        name: "description",
        content:
          "Normalized metrics tracked across AI search visibility tools. See which companies and plans support each metric.",
      },
      { property: "og:title", content: "Metrics - LLM Trackers" },
      {
        property: "og:description",
        content:
          "Normalized metrics tracked across AI search visibility tools. See which companies and plans support each metric.",
      },
    ],
  }),
});

function MetricsIndexPage() {
  const metrics = getAllMetrics();

  return (
    <div>
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold text-gray-900">Metrics</h1>
          <p className="mt-2 text-gray-600">
            {metrics.length} normalized metrics tracked across AI search visibility tools.
          </p>
        </div>
      </div>

      {metrics.length === 0 ? (
        <p className="text-gray-500">No metrics yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => {
            const uniqueCompanySlugs = [...new Set(metric.supportedBy.map((s) => s.companySlug))];

            return (
              <Link
                key={metric.id}
                to="/metrics/$id"
                params={{ id: metric.id }}
                className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
              >
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  {formatMetricName(metric.id)}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">
                  {metric.description}
                </p>

                <div className="mt-auto pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      {uniqueCompanySlugs.slice(0, 6).map((companySlug) => {
                        const company = getCompanyBySlug(companySlug);
                        return (
                          <div
                            key={companySlug}
                            className="relative"
                            title={company?.name ?? companySlug}
                          >
                            <CompanyMark
                              slug={companySlug}
                              name={company?.name ?? companySlug}
                              size="sm"
                            />
                          </div>
                        );
                      })}
                      {uniqueCompanySlugs.length > 6 && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-500">
                          +{uniqueCompanySlugs.length - 6}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {uniqueCompanySlugs.length}{" "}
                      {uniqueCompanySlugs.length === 1 ? "company" : "companies"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
