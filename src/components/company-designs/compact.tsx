import { useState } from "react";
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

interface AccordionEntry {
  id: string;
  label: string;
  count: number;
}

export function CompactLayout({
  company,
  relatedReviews,
  onEditPlan,
  onAddPlan,
  onOpenMedia,
}: CompanyDesignProps) {
  const ratingsCount = REVIEW_SITE_PLATFORMS.filter((p) => company.reviewSites[p]).length;

  const sections: AccordionEntry[] = [
    { id: "plans", label: "Plans", count: company.plans.length },
    { id: "metrics", label: "Metric Definitions", count: company.metricDefinitions.length },
    { id: "screenshots", label: "Screenshots", count: company.screenshots.length },
    { id: "videos", label: "Videos", count: company.videos.length },
    { id: "ratings", label: "Ratings", count: ratingsCount },
    { id: "reviews", label: "Published Reviews", count: relatedReviews.length },
    { id: "tweets", label: "Social", count: company.tweets.length },
    { id: "links", label: "Links", count: 1 },
  ].filter((s) => s.count > 0);

  const [open, setOpen] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (company.plans.length > 0) initial.add("plans");
    if (ratingsCount > 0) initial.add("ratings");
    return initial;
  });

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Summary chips
  const minPrice = Math.min(...company.plans.map((p) => p.price.amount ?? Infinity));
  const topScore = REVIEW_SITE_PLATFORMS.reduce<string | null>((best, p) => {
    const site = company.reviewSites[p];
    if (!site) return best;
    const label = `${String(site.score)}/${String(site.maxScore)}`;
    return best ?? label;
  }, null);

  return (
    <>
      {/* Summary chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
          {company.plans.length} plan{company.plans.length !== 1 ? "s" : ""}
        </span>
        {minPrice < Infinity && (
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
            From ${minPrice}/mo
          </span>
        )}
        {topScore && (
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
            Top score: {topScore}
          </span>
        )}
        {company.screenshots.length + company.videos.length > 0 && (
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
            {company.screenshots.length + company.videos.length} media items
          </span>
        )}
      </div>

      {/* Accordion sections */}
      <div className="space-y-2">
        {sections.map((s) => (
          <div
            key={s.id}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => {
                toggle(s.id);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              <span>
                {s.label}
                <span className="ml-2 text-xs font-normal text-gray-400">({s.count})</span>
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`h-4 w-4 text-gray-400 transition-transform ${open.has(s.id) ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open.has(s.id) && (
              <div className="border-t border-gray-100 px-4 py-4">
                <AccordionContent
                  id={s.id}
                  company={company}
                  relatedReviews={relatedReviews}
                  onEditPlan={onEditPlan}
                  onAddPlan={onAddPlan}
                  onOpenMedia={onOpenMedia}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function AccordionContent({
  id,
  company,
  relatedReviews,
  onEditPlan,
  onAddPlan,
  onOpenMedia,
}: { id: string } & Omit<CompanyDesignProps, "onEditCompany">) {
  switch (id) {
    case "plans":
      return (
        <PlansSection
          company={company}
          onEditPlan={onEditPlan}
          onAddPlan={onAddPlan}
          className=""
        />
      );
    case "metrics":
      return <MetricDefinitionsSection company={company} onOpenMedia={onOpenMedia} className="" />;
    case "screenshots":
      return <ScreenshotsSection company={company} onOpenMedia={onOpenMedia} className="" />;
    case "videos":
      return <VideosSection company={company} onOpenMedia={onOpenMedia} className="" />;
    case "ratings":
      return <RatingsSection company={company} className="" />;
    case "reviews":
      return (
        <PublishedReviewsSection company={company} relatedReviews={relatedReviews} className="" />
      );
    case "tweets":
      return <TweetsSection company={company} className="" />;
    case "links":
      return (
        <LinksSection company={company} className="flex flex-col gap-3 sm:flex-row sm:gap-4" />
      );
    default:
      return null;
  }
}
