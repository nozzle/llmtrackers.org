import { handleFormRequest } from "./form/routes";
import {
  handleUpdateQueueBatch,
  handleScheduledUpdate,
  handleUpdateAdminRequest,
} from "./update/runtime";
import type { AppEnv, UpdateQueueMessage } from "./types";

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
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    if (isAdminUpdateRoute(pathname)) {
      return handleUpdateAdminRequest(request, env);
    }

    if (isFormRoute(pathname)) {
      return handleFormRequest(request, env);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(
    _controller: ScheduledController,
    env: AppEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    await handleScheduledUpdate(env, ctx);
  },

  async queue(
    batch: MessageBatch<UpdateQueueMessage>,
    env: AppEnv
  ): Promise<void> {
    await handleUpdateQueueBatch(batch, env);
  },
} satisfies ExportedHandler<AppEnv, UpdateQueueMessage>;
