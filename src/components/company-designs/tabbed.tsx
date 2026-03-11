import { useState } from "react";
import { REVIEW_SITE_PLATFORMS } from "@llm-tracker/shared";
import type { CompanyDesignProps } from "./company-design-props";
import {
  PlansSection,
  ScreenshotsSection,
  VideosSection,
  RatingsSection,
  PublishedReviewsSection,
  TweetsSection,
  LinksSection,
} from "./sections";

interface TabDef {
  id: string;
  label: string;
  count: number;
}

export function TabbedLayout({
  company,
  relatedReviews,
  onEditPlan,
  onAddPlan,
  onOpenMedia,
}: CompanyDesignProps) {
  const mediaCount = company.screenshots.length + company.videos.length;
  const ratingsCount =
    REVIEW_SITE_PLATFORMS.filter((p) => company.reviewSites[p]).length + relatedReviews.length;
  const socialCount = company.tweets.length;

  const tabs: TabDef[] = [
    { id: "plans", label: "Plans", count: company.plans.length },
    ...(mediaCount > 0 ? [{ id: "media", label: "Media", count: mediaCount }] : []),
    ...(ratingsCount > 0 ? [{ id: "reviews", label: "Reviews", count: ratingsCount }] : []),
    ...(socialCount > 0 ? [{ id: "social", label: "Social & Links", count: socialCount }] : []),
  ];

  // Always include links in the last non-empty tab, or show a standalone tab
  if (socialCount === 0) {
    tabs.push({ id: "social", label: "Links", count: 1 });
  }

  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "plans");

  return (
    <>
      {/* Tab bar */}
      <div className="mb-6 border-b border-gray-200">
        <div className="-mb-px flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
              }}
              className={`shrink-0 border-b-2 px-5 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "plans" && (
        <PlansSection company={company} onEditPlan={onEditPlan} onAddPlan={onAddPlan} />
      )}

      {activeTab === "media" && (
        <>
          <ScreenshotsSection company={company} onOpenMedia={onOpenMedia} />
          <VideosSection company={company} onOpenMedia={onOpenMedia} />
        </>
      )}

      {activeTab === "reviews" && (
        <>
          <RatingsSection company={company} />
          <PublishedReviewsSection company={company} relatedReviews={relatedReviews} />
        </>
      )}

      {activeTab === "social" && (
        <>
          <TweetsSection company={company} />
          <LinksSection company={company} />
        </>
      )}
    </>
  );
}
