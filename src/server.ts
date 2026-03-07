import startHandler from "@tanstack/react-start/server-entry";
import { handleFormRequest } from "./server/form/routes";
import {
  handleUpdateAdminRequest,
  handleUpdateQueueBatch,
  handleScheduledUpdate,
} from "./server/update/runtime";
import type { AppEnv, UpdateQueueMessage } from "./server/types";

function isFormRoute(pathname: string): boolean {
  return [
    "/api/suggest",
    "/api/suggest-pr",
    "/api/suggest-company-edit",
    "/api/suggest-add-plan",
    "/api/suggest-add-company",
  ].includes(pathname);
}

function isAdminUpdateRoute(pathname: string): boolean {
  return (
    pathname === "/api/admin/update-checker/enqueue" ||
    pathname.startsWith("/api/admin/update-checker/enqueue/")
  );
}

export default {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (isAdminUpdateRoute(pathname)) {
      return handleUpdateAdminRequest(request, env);
    }

    if (isFormRoute(pathname)) {
      return handleFormRequest(request, env);
    }

    return startHandler.fetch(request, { context: { cloudflare: { env, ctx } } });
  },

  async scheduled(
    _controller: ScheduledController,
    env: AppEnv,
    ctx: ExecutionContext,
  ): Promise<void> {
    await handleScheduledUpdate(env, ctx);
  },

  async queue(batch: MessageBatch<UpdateQueueMessage>, env: AppEnv): Promise<void> {
    await handleUpdateQueueBatch(batch, env);
  },
} satisfies ExportedHandler<AppEnv, UpdateQueueMessage>;
