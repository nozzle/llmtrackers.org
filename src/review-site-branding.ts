import type { ReviewSitePlatform } from "@llm-tracker/shared";

export interface ReviewSiteBranding {
  logo: string;
  favicon: string;
  iconAlt: string;
  badge: string;
  text: string;
  ring: string;
  surface: string;
  bar: string;
}

export const REVIEW_SITE_BRANDING: Record<ReviewSitePlatform, ReviewSiteBranding> = {
  g2: {
    logo: "/review-site-assets/g2-logo.svg",
    favicon: "/review-site-assets/g2-favicon.ico",
    iconAlt: "G2",
    badge: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
    surface: "bg-red-50/60",
    bar: "bg-red-500",
  },
  trustpilot: {
    logo: "/review-site-assets/trustpilot-logo.svg",
    favicon: "/review-site-assets/trustpilot-favicon.ico",
    iconAlt: "Trustpilot",
    badge: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    surface: "bg-emerald-50/60",
    bar: "bg-emerald-500",
  },
  trustradius: {
    logo: "/review-site-assets/trustradius-logo.png",
    favicon: "/review-site-assets/trustradius-favicon.ico",
    iconAlt: "TrustRadius",
    badge: "bg-sky-50",
    text: "text-sky-700",
    ring: "ring-sky-200",
    surface: "bg-sky-50/60",
    bar: "bg-sky-500",
  },
  capterra: {
    logo: "/review-site-assets/capterra-logo.svg",
    favicon: "/review-site-assets/capterra-favicon.ico",
    iconAlt: "Capterra",
    badge: "bg-indigo-50",
    text: "text-indigo-700",
    ring: "ring-indigo-200",
    surface: "bg-indigo-50/60",
    bar: "bg-indigo-500",
  },
};

export function getReviewSiteBranding(platform: ReviewSitePlatform): ReviewSiteBranding {
  return REVIEW_SITE_BRANDING[platform];
}
