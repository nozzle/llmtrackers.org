import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { getAllCompanies, getAllMetrics, getCompanyBySlug } from "~/data";
import { CompanyMark } from "~/components/company-mark";
import { formatMetricId } from "~/metrics";

const metricsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  company: z.string().optional().catch(undefined),
  order: z.enum(["name", "companies", "plans"]).optional().catch(undefined),
});

type MetricsSearch = z.infer<typeof metricsSearchSchema>;

function normalizeSearchValue(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

function normalizeSortValue(
  value: MetricsSearch["order"] | "" | undefined,
): MetricsSearch["order"] | undefined {
  return value && value.length > 0 ? value : undefined;
}

export const Route = createFileRoute("/metrics/")({
  component: MetricsIndexPage,
  validateSearch: metricsSearchSchema,
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
  const companies = getAllCompanies();
  const search: MetricsSearch = Route.useSearch();
  const navigate = useNavigate();

  const query = search.q ?? "";
  const companyFilter = search.company ?? "";
  const sortBy = search.order ?? "name";

  const filteredMetrics = useMemo(() => {
    const result = metrics.filter((metric) => {
      const normalizedName = formatMetricId(metric.id).toLowerCase();
      const normalizedDescription = metric.description.toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        normalizedName.includes(query.toLowerCase()) ||
        metric.id.includes(query.toLowerCase()) ||
        normalizedDescription.includes(query.toLowerCase());

      const matchesCompany =
        companyFilter.length === 0 ||
        metric.supportedBy.some((support) => support.companySlug === companyFilter);

      return matchesQuery && matchesCompany;
    });

    return result.sort((a, b) => {
      if (sortBy === "companies") {
        const companyCountA = new Set(a.supportedBy.map((support) => support.companySlug)).size;
        const companyCountB = new Set(b.supportedBy.map((support) => support.companySlug)).size;
        if (companyCountB !== companyCountA) return companyCountB - companyCountA;
      }

      if (sortBy === "plans") {
        if (b.supportedBy.length !== a.supportedBy.length)
          return b.supportedBy.length - a.supportedBy.length;
      }

      return formatMetricId(a.id).localeCompare(formatMetricId(b.id));
    });
  }, [companyFilter, metrics, query, sortBy]);

  const filteredCount = filteredMetrics.length;

  function updateSearch(patch: Partial<MetricsSearch> & { order?: MetricsSearch["order"] | "" }) {
    void navigate({
      to: "/metrics",
      search: {
        q: patch.q !== undefined ? normalizeSearchValue(patch.q) : search.q,
        company: patch.company !== undefined ? normalizeSearchValue(patch.company) : search.company,
        order: patch.order !== undefined ? normalizeSortValue(patch.order) : search.order,
      },
      replace: true,
    });
  }

  return (
    <div>
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold text-gray-900">Metrics</h1>
          <p className="mt-2 text-gray-600">
            {filteredCount === metrics.length
              ? `${metrics.length} normalized metrics tracked across AI search visibility tools.`
              : `${filteredCount} of ${metrics.length} normalized metrics match the current filters.`}
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto] lg:items-end">
          <div>
            <label
              htmlFor="metrics-search"
              className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Search metrics
            </label>
            <input
              id="metrics-search"
              type="search"
              value={query}
              onChange={(event) => {
                updateSearch({ q: event.target.value });
              }}
              placeholder="Search by name, id, or description"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="metrics-company"
              className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Company
            </label>
            <select
              id="metrics-company"
              value={companyFilter}
              onChange={(event) => {
                updateSearch({ company: event.target.value });
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All companies</option>
              {companies.map((company) => (
                <option key={company.slug} value={company.slug}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="metrics-sort"
              className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Sort by
            </label>
            <select
              id="metrics-sort"
              value={sortBy}
              onChange={(event) => {
                updateSearch({ order: event.target.value as MetricsSearch["order"] });
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="name">Name</option>
              <option value="companies">Most companies</option>
              <option value="plans">Most plans</option>
            </select>
          </div>

          <div className="flex gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => {
                updateSearch({ q: "", company: "", order: "" as MetricsSearch["order"] });
              }}
              disabled={query.length === 0 && companyFilter.length === 0 && sortBy === "name"}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        {(query.length > 0 || companyFilter.length > 0 || sortBy !== "name") && (
          <div className="mt-4 flex flex-wrap gap-2">
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  updateSearch({ q: "" });
                }}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Search: {query} x
              </button>
            )}
            {companyFilter.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  updateSearch({ company: "" });
                }}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Company:{" "}
                {companies.find((company) => company.slug === companyFilter)?.name ?? companyFilter}{" "}
                x
              </button>
            )}
            {sortBy !== "name" && (
              <button
                type="button"
                onClick={() => {
                  updateSearch({ order: "" as MetricsSearch["order"] });
                }}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Sort: {sortBy === "companies" ? "Most companies" : "Most plans"} x
              </button>
            )}
          </div>
        )}
      </div>

      {filteredMetrics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-700">No metrics match the current filters.</p>
          <p className="mt-1 text-sm text-gray-500">
            Try a different search term, company, or sort.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMetrics.map((metric) => {
            const uniqueCompanySlugs = [...new Set(metric.supportedBy.map((s) => s.companySlug))];

            return (
              <Link
                key={metric.id}
                to="/metrics/$id"
                params={{ id: metric.id }}
                className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
              >
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
                  {formatMetricId(metric.id)}
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
