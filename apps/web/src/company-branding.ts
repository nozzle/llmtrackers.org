export interface CompanyBranding {
  logo?: string;
  favicon?: string;
}

export const COMPANY_BRANDING: Record<string, CompanyBranding> = {
  "ahrefs-brand-radar": {
    logo: "/company-assets/ahrefs-brand-radar-logo.svg",
    favicon: "/company-assets/ahrefs-brand-radar-favicon.ico",
  },
  airops: {
    logo: "/company-assets/airops-logo.svg",
  },
  athenahq: {
    logo: "/company-assets/athenahq-logo.svg",
    favicon: "/company-assets/athenahq-favicon.svg",
  },
  "brandlight-ai": {
    logo: "/company-assets/brandlight-ai-logo.webp",
  },
  conductor: {
    logo: "/company-assets/conductor-logo.svg",
    favicon: "/company-assets/conductor-favicon.ico",
  },
  demandsphere: {
    logo: "/company-assets/demandsphere-logo.png",
  },
  getstat: {
    logo: "/company-assets/getstat-logo.svg",
  },
  "gumshoe-ai": {
    logo: "/company-assets/gumshoe-ai-logo.png",
    favicon: "/company-assets/gumshoe-ai-favicon.png",
  },
  knowatoa: {
    logo: "/company-assets/knowatoa-logo.svg",
  },
  "otterly-ai": {
    logo: "/company-assets/otterly-ai-logo.png",
  },
  "peec-ai": {
    logo: "/company-assets/peec-ai-logo.png",
    favicon: "/company-assets/peec-ai-favicon.png",
  },
  profound: {
    favicon: "/company-assets/profound-favicon.ico",
  },
  rankscale: {
    logo: "/company-assets/rankscale-logo.png",
    favicon: "/company-assets/rankscale-favicon.png",
  },
  "scrunch-ai": {
    favicon: "/company-assets/scrunch-ai-favicon.ico",
  },
  waikay: {
    logo: "/company-assets/waikay-logo.png",
  },
  "writesonic-geo": {
    logo: "/company-assets/writesonic-geo-logo.svg",
  },
  "ziptie-dev": {
    logo: "/company-assets/ziptie-dev-logo.png",
    favicon: "/company-assets/ziptie-dev-favicon.png",
  },
};

export function getCompanyBranding(slug: string): CompanyBranding {
  return COMPANY_BRANDING[slug] ?? {};
}
