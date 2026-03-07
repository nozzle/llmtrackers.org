import { getCompanyBranding } from "~/company-branding";

export function CompanyMark({
  slug,
  name,
  size = "md",
  mode = "auto",
}: Readonly<{
  slug: string;
  name: string;
  size?: "sm" | "md" | "lg";
  mode?: "auto" | "logo" | "favicon";
}>) {
  const branding = getCompanyBranding(slug);
  const src =
    mode === "logo"
      ? branding.logo
      : mode === "favicon"
        ? branding.favicon
        : (branding.logo ?? branding.favicon);

  const sizeClasses = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-16 w-16" : "h-10 w-10";

  const imageClasses =
    mode === "favicon" || (!branding.logo && branding.favicon)
      ? "h-full w-full object-contain"
      : "h-full w-full object-contain";

  if (!src) {
    return (
      <div
        className={`${sizeClasses} flex items-center justify-center rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-500`}
        aria-hidden="true"
      >
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses} flex items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1`}
    >
      <img src={src} alt={`${name} logo`} className={imageClasses} loading="lazy" />
    </div>
  );
}
