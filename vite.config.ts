import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => ({
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: [
      "playwright",
      "playwright-core",
      "@cloudflare/playwright",
      "chromium-bidi",
    ],
  },
  plugins: [
    tsConfigPaths(),
    ...(!process.env.VITEST ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
        crawlLinks: true,
        autoStaticPathsDiscovery: true,
        concurrency: 14,
        retryCount: 2,
        retryDelay: 1000,
        maxRedirects: 5,
        failOnError: true,
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
}));
