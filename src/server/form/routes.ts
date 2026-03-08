import { handleSuggestIssue } from "./public-issue";
import { handlePrMutation } from "./pr-mutations";
import { validateEditPayload, handleEditSuggestion } from "./edit-handler";
import { validateCompanyEditPayload, handleCompanyEdit } from "./company-edit-handler";
import { validateAddPlanPayload, handleAddPlan } from "./add-plan-handler";
import { validateAddCompanyPayload, handleAddCompany } from "./add-company-handler";
import { validateAddReviewPayload, handleAddReview } from "./add-review-handler";
import { validateEditReviewPayload, handleEditReview } from "./edit-review-handler";
import { handlePrefillReview, validatePrefillReviewPayload } from "./prefill-review-handler";
import {
  corsHeaders,
  isJsonRequest,
  isRateLimited,
  jsonResponse,
  parseJsonBody,
  requestBodyTooLarge,
  getClientIdentifier,
} from "./http";
import type { AppEnv } from "../types";

export async function handleFormRequest(request: Request, env: AppEnv): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!isJsonRequest(request)) {
    return jsonResponse({ error: "Content-Type must be application/json" }, 415);
  }

  if (requestBodyTooLarge(request)) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }

  if (isRateLimited(getClientIdentifier(request))) {
    return jsonResponse({ error: "Too many submissions. Please try again later." }, 429);
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return parsed.response;
  }

  const path = new URL(request.url).pathname;
  const body = parsed.value;

  if (path === "/api/suggest-pr") {
    return handlePrMutation({
      body,
      request,
      env,
      validate: validateEditPayload,
      execute: handleEditSuggestion,
      logLabel: "suggest-pr",
    });
  }

  if (path === "/api/suggest-company-edit") {
    return handlePrMutation({
      body,
      request,
      env,
      validate: validateCompanyEditPayload,
      execute: handleCompanyEdit,
      logLabel: "company-edit",
    });
  }

  if (path === "/api/suggest-add-plan") {
    return handlePrMutation({
      body,
      request,
      env,
      validate: validateAddPlanPayload,
      execute: handleAddPlan,
      logLabel: "add-plan",
    });
  }

  if (path === "/api/suggest-add-company") {
    return handlePrMutation({
      body,
      request,
      env,
      validate: validateAddCompanyPayload,
      execute: handleAddCompany,
      logLabel: "add-company",
    });
  }

  if (path === "/api/suggest-add-review") {
    return handlePrMutation({
      body,
      request,
      env,
      validate: validateAddReviewPayload,
      execute: handleAddReview,
      logLabel: "add-review",
    });
  }

  if (path === "/api/prefill-review-from-url") {
    const validated = validatePrefillReviewPayload(body);
    if (!validated.ok) {
      return jsonResponse({ error: validated.error }, 400);
    }

    return handlePrefillReview(validated.value, env);
  }

  if (path === "/api/suggest-review-edit") {
    return handlePrMutation({
      body,
      request,
      env,
      validate: validateEditReviewPayload,
      execute: handleEditReview,
      logLabel: "review-edit",
    });
  }

  return handleSuggestIssue(body, request, env);
}
