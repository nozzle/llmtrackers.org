const DEFAULT_SITE_URL = "https://llm-tracker.pages.dev";

export function getSiteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  return normalizeSiteUrl(configured || DEFAULT_SITE_URL);
}

export function buildAbsoluteUrl(pathname: string): string {
  const base = getSiteUrl();
  const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/+$/, "");
  return normalizedPath === "/" ? base : `${base}${normalizedPath}`;
}

function normalizeSiteUrl(value: string): string {
  return value.replace(/\/+$/, "");
}
