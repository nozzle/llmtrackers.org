const DEFAULT_SITE_URL = "https://llm-tracker.pages.dev";

export function getSiteUrl(): string {
  const previewUrl = import.meta.env.CF_PAGES_URL?.trim();
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  return normalizeSiteUrl(previewUrl || configured || DEFAULT_SITE_URL);
}

export function getCanonicalSiteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  return normalizeSiteUrl(configured || getSiteUrl());
}

export function buildAbsoluteUrl(pathname: string): string {
  const base = getSiteUrl();
  const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return normalizedPath === "/" ? base : `${base}${normalizedPath}`;
}

export function buildCanonicalUrl(pathname: string): string {
  const base = getCanonicalSiteUrl();
  const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return normalizedPath === "/" ? base : `${base}${normalizedPath}`;
}

function normalizeSiteUrl(value: string): string {
  return value.replace(/\/+$/, "");
}
