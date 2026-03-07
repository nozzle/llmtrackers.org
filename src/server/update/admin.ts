import { isAuthorizedManualTrigger } from "./auth";
import { enqueueAllCompanyUpdates, enqueueSingleCompanyUpdate } from "./enqueue";
import type { AppEnv } from "../types";

export async function handleUpdateAdminRequest(request: Request, env: AppEnv): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "POST required" }, 405);
  }

  if (!isAuthorizedManualTrigger(request, env.MANUAL_TRIGGER_TOKEN)) {
    return new Response(JSON.stringify({ error: "Unauthorized manual trigger" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": "Bearer",
      },
    });
  }

  const path = new URL(request.url).pathname;

  try {
    if (path === "/api/admin/update-checker/enqueue") {
      return jsonResponse(await enqueueAllCompanyUpdates(env, "manual"), 202);
    }

    const slugMatch = /^\/api\/admin\/update-checker\/enqueue\/([a-z0-9-]+)$/.exec(path);
    if (slugMatch) {
      return jsonResponse(await enqueueSingleCompanyUpdate(env, slugMatch[1], "manual"), 202);
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
