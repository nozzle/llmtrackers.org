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

export function StandardLayout({
  company,
  companyMetrics,
  relatedReviews,
  onEditPlan,
  onAddPlan,
  onOpenMedia,
}: CompanyDesignProps) {
  return (
    <>
      <PlansSection company={company} onEditPlan={onEditPlan} onAddPlan={onAddPlan} />
      <MetricDefinitionsSection company={company} companyMetrics={companyMetrics} />
      <ScreenshotsSection company={company} onOpenMedia={onOpenMedia} />
      <VideosSection company={company} onOpenMedia={onOpenMedia} />
      <RatingsSection company={company} />
      <PublishedReviewsSection company={company} relatedReviews={relatedReviews} />
      <TweetsSection company={company} />
      <LinksSection company={company} />
    </>
  );
}
