import {
  REVIEW_SITE_LABELS,
  REVIEW_SITE_PLATFORMS,
  type ReviewSitePlatform,
  type ReviewSites,
} from "@llm-tracker/shared";
import { getReviewSiteBranding } from "~/review-site-branding";

function hasReviewSiteData(site: ReviewSites[ReviewSitePlatform] | undefined): boolean {
  if (!site) return false;

  return (
    site.score != null ||
    site.reviewCount != null ||
    site.ratingDistribution.length > 0 ||
    site.reviews.length > 0
  );
}

export function ReviewSiteMark({
  platform,
  mode = "logo",
  size = "md",
}: {
  platform: ReviewSitePlatform;
  mode?: "logo" | "favicon";
  size?: "sm" | "md" | "lg";
}) {
  const branding = getReviewSiteBranding(platform);
  const src = mode === "favicon" ? branding.favicon : branding.logo;
  const sizeClasses =
    mode === "favicon"
      ? size === "sm"
        ? "h-4 w-4"
        : size === "lg"
          ? "h-8 w-8"
          : "h-5 w-5"
      : size === "sm"
        ? "h-4 max-w-16"
        : size === "lg"
          ? "h-8 max-w-28"
          : "h-5 max-w-20";
  const imageClasses = `${sizeClasses} object-contain`;

  return <img src={src} alt={branding.iconAlt} className={imageClasses} loading="lazy" />;
}

export function ReviewSiteLabel({
  platform,
  mode = "logo",
  size = "md",
}: {
  platform: ReviewSitePlatform;
  mode?: "logo" | "favicon";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <ReviewSiteMark platform={platform} mode={mode} size={size} />
      <span>{REVIEW_SITE_LABELS[platform]}</span>
    </span>
  );
}

export function ReviewSiteScoreBadge({
  platform,
  score,
  maxScore,
  compact = false,
  showLogo = false,
}: {
  platform: ReviewSitePlatform;
  score: number | null | undefined;
  maxScore: number | null | undefined;
  compact?: boolean;
  showLogo?: boolean;
}) {
  const branding = getReviewSiteBranding(platform);

  if (score == null || maxScore == null) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-400">
        {showLogo && <ReviewSiteMark platform={platform} mode="favicon" size="sm" />}
        <span>-</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full ${compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"} font-medium ring-1 ${branding.badge} ${branding.text} ${branding.ring}`}
    >
      {showLogo && <ReviewSiteMark platform={platform} mode="favicon" size="sm" />}
      <span>
        {score.toFixed(maxScore <= 5 ? 1 : 0)}/{maxScore}
      </span>
    </span>
  );
}

export function ReviewSiteMiniList({ reviewSites }: { reviewSites: ReviewSites }) {
  const available = REVIEW_SITE_PLATFORMS.filter((platform) =>
    hasReviewSiteData(reviewSites[platform]),
  );

  if (available.length === 0) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((platform) => {
        const site = reviewSites[platform];
        if (!site) return null;
        const branding = getReviewSiteBranding(platform);

        return (
          <a
            key={platform}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ${branding.badge} ${branding.text} ${branding.ring}`}
          >
            <ReviewSiteMark platform={platform} mode="favicon" size="sm" />
            <span>{REVIEW_SITE_LABELS[platform]}</span>
            {site.score != null && <span>{site.score.toFixed(site.maxScore <= 5 ? 1 : 0)}</span>}
          </a>
        );
      })}
    </div>
  );
}
