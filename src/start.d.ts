import type { AppEnv } from "./server/types";

declare global {
  interface ImportMetaEnv {
    readonly VITE_SITE_URL?: string;
    readonly VITE_TURNSTILE_SITE_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module "@tanstack/react-start" {
  interface Register {
    server: {
      requestContext: {
        cloudflare: {
          env: AppEnv;
          ctx: ExecutionContext;
        };
      };
    };
  }
}

export {};
