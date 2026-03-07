import type { AppEnv } from "./server/types";

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
