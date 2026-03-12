import { REVIEW_SITE_PLATFORMS } from "@llm-tracker/shared";
import type { CompanyDesignProps } from "./company-design-props";
import {
  PlansSection,
  MetricDefinitionsSection,
  ScreenshotsSection,
  VideosSection,
  RatingsSection,
  PublishedReviewsSection,
  TweetsSection,
  LinksSection,
} from "./sections";

interface NavEntry {
  id: string;
  label: string;
}

export function SidebarNavLayout({
  company,
  companyMetrics,
  relatedReviews,
  onEditPlan,
  onAddPlan,
  onOpenMedia,
}: CompanyDesignProps) {
  const ratingsCount = REVIEW_SITE_PLATFORMS.filter((p) => company.reviewSites[p]).length;

  const navItems: NavEntry[] = [
    { id: "plans", label: "Plans" },
    ...(companyMetrics.length > 0 ? [{ id: "metrics", label: "Metric Definitions" }] : []),
    ...(company.screenshots.length > 0 ? [{ id: "screenshots", label: "Screenshots" }] : []),
    ...(company.videos.length > 0 ? [{ id: "videos", label: "Videos" }] : []),
    ...(ratingsCount > 0 ? [{ id: "ratings", label: "Ratings" }] : []),
    ...(relatedReviews.length > 0 ? [{ id: "reviews", label: "Published Reviews" }] : []),
    ...(company.tweets.length > 0 ? [{ id: "tweets", label: "Social" }] : []),
    { id: "links", label: "Links" },
  ];

  // Summary metrics
  const minPrice = Math.min(...company.plans.map((p) => p.price.amount ?? Infinity));
  const topReviewSite = REVIEW_SITE_PLATFORMS.find((p) => company.reviewSites[p]);
  const topSite = topReviewSite ? company.reviewSites[topReviewSite] : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      {/* Sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-5">
          {/* Jump links */}
          <nav className="space-y-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
              Sections
            </p>
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
                }}
                className="block rounded-md px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Key metrics */}
          <div className="space-y-3 border-t border-gray-200 pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              Quick Stats
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Plans</span>
                <span className="font-medium text-gray-900">{company.plans.length}</span>
              </div>
              {minPrice < Infinity && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Starting at</span>
                  <span className="font-medium text-gray-900">${minPrice}/mo</span>
                </div>
              )}
              {topSite && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Top score</span>
                  <span className="font-medium text-gray-900">
                    {topSite.score}/{topSite.maxScore}
                  </span>
                </div>
              )}
              {company.screenshots.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Screenshots</span>
                  <span className="font-medium text-gray-900">{company.screenshots.length}</span>
                </div>
              )}
              {companyMetrics.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Metrics</span>
                  <span className="font-medium text-gray-900">{companyMetrics.length}</span>
                </div>
              )}
              {company.videos.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Videos</span>
                  <span className="font-medium text-gray-900">{company.videos.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick links */}
          {(company.pricingUrl ?? company.featuresUrl) && (
            <div className="space-y-2 border-t border-gray-200 pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">External</p>
              {company.pricingUrl && (
                <a
                  href={company.pricingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-600 hover:underline"
                >
                  Pricing Page
                </a>
              )}
              {company.featuresUrl && (
                <a
                  href={company.featuresUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-600 hover:underline"
                >
                  Features Page
                </a>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile nav strip (visible < lg) */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 lg:hidden">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth" });
            }}
            className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* Main content */}
      <div>
        <div id="plans">
          <PlansSection company={company} onEditPlan={onEditPlan} onAddPlan={onAddPlan} />
        </div>
        <div id="metrics">
          <MetricDefinitionsSection company={company} companyMetrics={companyMetrics} />
        </div>
        <div id="screenshots">
          <ScreenshotsSection company={company} onOpenMedia={onOpenMedia} />
        </div>
        <div id="videos">
          <VideosSection company={company} onOpenMedia={onOpenMedia} />
        </div>
        <div id="ratings">
          <RatingsSection company={company} />
        </div>
        <div id="reviews">
          <PublishedReviewsSection company={company} relatedReviews={relatedReviews} />
        </div>
        <div id="tweets">
          <TweetsSection company={company} />
        </div>
        <div id="links">
          <LinksSection company={company} />
        </div>
      </div>
    </div>
  );
}
