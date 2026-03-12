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

export function TwoColumnLayout({
  company,
  companyMetrics,
  relatedReviews,
  onEditPlan,
  onAddPlan,
  onOpenMedia,
}: CompanyDesignProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* Left column: Plans + Media */}
      <div className="lg:col-span-3">
        <PlansSection company={company} onEditPlan={onEditPlan} onAddPlan={onAddPlan} />
        <MetricDefinitionsSection company={company} companyMetrics={companyMetrics} />
        <ScreenshotsSection company={company} onOpenMedia={onOpenMedia} />
        <VideosSection company={company} onOpenMedia={onOpenMedia} />
      </div>

      {/* Right column: Reviews + Social */}
      <div className="lg:col-span-2">
        <RatingsSection company={company} />
        <PublishedReviewsSection company={company} relatedReviews={relatedReviews} />
        <TweetsSection company={company} />
        <LinksSection company={company} />
      </div>
    </div>
  );
}
