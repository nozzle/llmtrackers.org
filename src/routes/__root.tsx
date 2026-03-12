/// <reference types="vite/client" />
import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import "~/styles/app.css";
import { getGeneratedAt } from "~/data";
import { buildAbsoluteUrl, buildCanonicalUrl } from "~/site";

const SITE_TITLE = "LLM Trackers - Compare AI Search Visibility Tools";
const SITE_DESCRIPTION =
  "Compare LLM tracking and AI search visibility tools side-by-side. Pricing, features, LLM support, and more for 19 tools and 23 plans.";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESCRIPTION },
      // Open Graph
      { property: "og:type", content: "website" },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:site_name", content: "LLM Trackers" },
      // Twitter Card
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESCRIPTION },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const canonicalUrl = buildCanonicalUrl(pathname);
  const shareUrl = buildAbsoluteUrl(pathname);

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={shareUrl} />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Header />
        <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        <Footer />
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center">
          <img src="/llmtrackers-logo.png" alt="LLM Trackers" className="h-8 w-auto sm:h-10" />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            to="/"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 [&.active]:text-blue-600"
          >
            Compare
          </Link>
          <Link
            to="/reviews"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 [&.active]:text-blue-600"
          >
            Reviews
          </Link>
          <Link
            to="/metrics"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 [&.active]:text-blue-600"
          >
            Metrics
          </Link>
          <Link
            to="/screenshots"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 [&.active]:text-blue-600"
          >
            Screenshots
          </Link>
          <Link
            to="/suggest"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Suggest Edit
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-gray-500">
            LLM Trackers - Open source comparison data.{" "}
            <a
              href="https://github.com/nozzle/llm-tracker-comparison"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contribute on GitHub
            </a>
          </p>
          <p className="text-sm text-gray-500">
            Data sourced from public pricing pages. Last compiled:{" "}
            {new Date(getGeneratedAt()).toLocaleDateString()}
          </p>
        </div>
      </div>
    </footer>
  );
}
