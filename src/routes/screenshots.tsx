import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  getAllCompanies,
  getAllScreenshotsWithCompany,
  getMatchedMetricsForScreenshot,
  type ScreenshotWithCompany,
} from "~/data";
import { CompanyMark } from "~/components/company-mark";
import { MediaOverlay, type ScreenshotCompanyContext } from "~/components/media-overlay";

// ---------------------------------------------------------------------------
// Search-param schema
// ---------------------------------------------------------------------------

const screenshotsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  company: z.string().optional().catch(undefined),
  kind: z.string().optional().catch(undefined),
});

type ScreenshotsSearch = z.infer<typeof screenshotsSearchSchema>;

function normalizeSearchValue(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/screenshots")({
  component: ScreenshotsPage,
  validateSearch: screenshotsSearchSchema,
  head: () => ({
    meta: [
      { title: "Screenshots - LLM Trackers" },
      {
        name: "description",
        content:
          "Browse product screenshots from all tracked AI search visibility tools. See which company and metrics each screenshot relates to.",
      },
      { property: "og:title", content: "Screenshots - LLM Trackers" },
      {
        property: "og:description",
        content:
          "Browse product screenshots from all tracked AI search visibility tools. See which company and metrics each screenshot relates to.",
      },
    ],
  }),
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function ScreenshotsPage() {
  const allScreenshots = getAllScreenshotsWithCompany();
  const companies = getAllCompanies();
  const search: ScreenshotsSearch = Route.useSearch();
  const navigate = useNavigate();

  const [mediaOverlay, setMediaOverlay] = useState<{
    index: number;
  } | null>(null);

  const query = search.q ?? "";
  const companyFilter = search.company ?? "";
  const kindFilter = search.kind ?? "";

  // Collect unique kind values for the filter dropdown
  const allKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const s of allScreenshots) {
      if (s.kind) kinds.add(s.kind);
    }
    return [...kinds].sort();
  }, [allScreenshots]);

  // Filter screenshots
  const filteredScreenshots = useMemo(() => {
    return allScreenshots.filter((s) => {
      // Text search across caption, alt, contextHeading, pageTitle, and tags
      if (query.length > 0) {
        const lowerQuery = query.toLowerCase();
        const haystack = [s.caption, s.alt, s.contextHeading, s.pageTitle, ...s.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(lowerQuery)) return false;
      }

      // Company filter
      if (companyFilter.length > 0 && s.companySlug !== companyFilter) return false;

      // Kind filter
      if (kindFilter.length > 0 && s.kind !== kindFilter) return false;

      return true;
    });
  }, [allScreenshots, query, companyFilter, kindFilter]);

  // Pre-compute company contexts + matched metrics for the filtered list
  const companyContexts = useMemo<ScreenshotCompanyContext[]>(() => {
    return filteredScreenshots.map((s) => ({
      companySlug: s.companySlug,
      companyName: s.companyName,
      matchedMetrics: getMatchedMetricsForScreenshot(s, s.companySlug),
    }));
  }, [filteredScreenshots]);

  function updateSearch(patch: Partial<ScreenshotsSearch>) {
    void navigate({
      to: "/screenshots",
      search: {
        q: patch.q !== undefined ? normalizeSearchValue(patch.q) : search.q,
        company: patch.company !== undefined ? normalizeSearchValue(patch.company) : search.company,
        kind: patch.kind !== undefined ? normalizeSearchValue(patch.kind) : search.kind,
      },
      replace: true,
    });
  }

  const filteredCount = filteredScreenshots.length;
  const totalCount = allScreenshots.length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          &larr; Back to comparison
        </Link>
        <div className="mt-4">
          <h1 className="text-3xl font-bold text-gray-900">Screenshots</h1>
          <p className="mt-2 text-gray-600">
            {filteredCount === totalCount
              ? `${totalCount} product screenshots across ${companies.filter((c) => c.screenshots.length > 0).length} tools.`
              : `${filteredCount} of ${totalCount} screenshots match the current filters.`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px_auto] lg:items-end">
          {/* Search */}
          <div>
            <label
              htmlFor="screenshots-search"
              className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Search screenshots
            </label>
            <input
              id="screenshots-search"
              type="search"
              value={query}
              onChange={(e) => {
                updateSearch({ q: e.target.value });
              }}
              placeholder="Search by caption, alt text, heading, or tags"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Company filter */}
          <div>
            <label
              htmlFor="screenshots-company"
              className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Company
            </label>
            <select
              id="screenshots-company"
              value={companyFilter}
              onChange={(e) => {
                updateSearch({ company: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All companies</option>
              {companies
                .filter((c) => c.screenshots.length > 0)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} ({c.screenshots.length})
                  </option>
                ))}
            </select>
          </div>

          {/* Kind filter */}
          <div>
            <label
              htmlFor="screenshots-kind"
              className="text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              Kind
            </label>
            <select
              id="screenshots-kind"
              value={kindFilter}
              onChange={(e) => {
                updateSearch({ kind: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All kinds</option>
              {allKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>

          {/* Clear */}
          <div className="flex gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => {
                updateSearch({ q: "", company: "", kind: "" });
              }}
              disabled={query.length === 0 && companyFilter.length === 0 && kindFilter.length === 0}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>

        {/* Active filter pills */}
        {(query.length > 0 || companyFilter.length > 0 || kindFilter.length > 0) && (
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
                Company: {companies.find((c) => c.slug === companyFilter)?.name ?? companyFilter} x
              </button>
            )}
            {kindFilter.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  updateSearch({ kind: "" });
                }}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Kind: {kindFilter} x
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredScreenshots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-700">
            No screenshots match the current filters.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Try a different search term, company, or kind.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredScreenshots.map((screenshot, i) => (
            <ScreenshotCard
              key={`${screenshot.companySlug}-${screenshot.id}`}
              screenshot={screenshot}
              matchedMetricCount={companyContexts[i].matchedMetrics.length}
              onClick={() => {
                setMediaOverlay({ index: i });
              }}
            />
          ))}
        </div>
      )}

      {/* Media Overlay */}
      {mediaOverlay && (
        <MediaOverlay
          type="screenshot"
          items={filteredScreenshots}
          index={mediaOverlay.index}
          companyContexts={companyContexts}
          onClose={() => {
            setMediaOverlay(null);
          }}
          onNavigate={(i) => {
            setMediaOverlay({ index: i });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screenshot card
// ---------------------------------------------------------------------------

function ScreenshotCard({
  screenshot,
  matchedMetricCount,
  onClick,
}: {
  screenshot: ScreenshotWithCompany;
  matchedMetricCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/30"
    >
      {/* Thumbnail */}
      <div className="relative h-40 w-full overflow-hidden bg-gray-100">
        <img
          src={screenshot.assetPath}
          alt={screenshot.alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        {/* Kind badge */}
        {screenshot.kind && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {screenshot.kind}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-3 text-left">
        {/* Company row */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <CompanyMark
            slug={screenshot.companySlug}
            name={screenshot.companyName}
            size="sm"
            mode="favicon"
          />
          <span className="truncate text-xs font-medium text-gray-500">
            {screenshot.companyName}
          </span>
        </div>

        {/* Heading */}
        <p className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-blue-600">
          {screenshot.contextHeading ?? screenshot.alt}
        </p>

        {/* Footer row */}
        <div className="mt-auto flex items-center gap-2 pt-2">
          {matchedMetricCount > 0 && (
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
              {matchedMetricCount} {matchedMetricCount === 1 ? "metric" : "metrics"}
            </span>
          )}
          <span className="ml-auto text-[10px] text-gray-400">
            {new Date(screenshot.collectedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </button>
  );
}
