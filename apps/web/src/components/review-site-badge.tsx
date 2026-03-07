import {
  REVIEW_SITE_LABELS,
  REVIEW_SITE_PLATFORMS,
  type ReviewSitePlatform,
  type ReviewSites,
} from "@llm-tracker/shared";

const REVIEW_SITE_STYLES: Record<
  ReviewSitePlatform,
  { badge: string; text: string; ring: string }
> = {
  g2: {
    badge: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
  },
  trustpilot: {
    badge: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  trustradius: {
    badge: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
  },
  capterra: {
    badge: "bg-indigo-50",
    text: "text-indigo-700",
    ring: "ring-indigo-200",
  },
};

export function ReviewSiteScoreBadge({
  platform,
  score,
  maxScore,
  compact = false,
}: {
  platform: ReviewSitePlatform;
  score: number | null | undefined;
  maxScore: number | null | undefined;
  compact?: boolean;
}) {
  const styles = REVIEW_SITE_STYLES[platform];

  if (score == null || maxScore == null) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full ${compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"} font-medium ring-1 ${styles.badge} ${styles.text} ${styles.ring}`}
    >
      {score.toFixed(maxScore <= 5 ? 1 : 0)}/{maxScore}
    </span>
  );
}

export function ReviewSiteMiniList({
  reviewSites,
}: {
  reviewSites: ReviewSites;
}) {
  const available = REVIEW_SITE_PLATFORMS.filter((platform) => reviewSites[platform]);

  if (available.length === 0) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {available.map((platform) => {
        const site = reviewSites[platform];
        if (!site) return null;

        return (
          <a
            key={platform}
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${REVIEW_SITE_STYLES[platform].badge} ${REVIEW_SITE_STYLES[platform].text} ${REVIEW_SITE_STYLES[platform].ring}`}
          >
            <span>{REVIEW_SITE_LABELS[platform]}</span>
            {site.score != null && <span>{site.score.toFixed(site.maxScore <= 5 ? 1 : 0)}</span>}
          </a>
        );
      })}
    </div>
  );
}
