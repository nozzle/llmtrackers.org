import {
  createAppJwt,
  getInstallationToken,
  createGitHubIssue,
} from "@llm-tracker/github";
import { validateSubmission, type FormSubmission } from "./validation";
import { validateEditPayload, handleEditSuggestion } from "./edit-handler";
import { validateCompanyEditPayload, handleCompanyEdit } from "./company-edit-handler";
import { validateAddPlanPayload, handleAddPlan } from "./add-plan-handler";
import { validateAddCompanyPayload, handleAddCompany } from "./add-company-handler";
import { turnstileEnabled, verifyTurnstileToken } from "./turnstile";
import type { AppEnv } from "../types";
import type { FormEnv } from "./index";

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const submissionLog = new Map<string, number[]>();

const FIELD_LABELS: Record<string, string> = {
  pricing: "Pricing",
  features: "Features / Capabilities",
  "llm-support": "LLM Support",
  integrations: "Integrations",
  schedule: "Update Schedule",
  "new-plan": "New Plan (not listed)",
  "removed-plan": "Plan Removed / Discontinued",
  "company-info": "Company Info",
  other: "Other",
};

export async function handleFormRequest(
  request: Request,
  env: AppEnv
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!isJsonRequest(request)) {
    return jsonResponse(
      { error: "Content-Type must be application/json" },
      415
    );
  }

  if (requestBodyTooLarge(request)) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }

  if (isRateLimited(getClientIdentifier(request))) {
    return jsonResponse(
      { error: "Too many submissions. Please try again later." },
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const path = new URL(request.url).pathname;

  if (path === "/api/suggest-pr") {
    return handleSuggestPr(body, request, env);
  }

  if (path === "/api/suggest-company-edit") {
    return handleSuggestCompanyEdit(body, request, env);
  }

  if (path === "/api/suggest-add-plan") {
    return handleSuggestAddPlan(body, request, env);
  }

  if (path === "/api/suggest-add-company") {
    return handleSuggestAddCompany(body, request, env);
  }

  return handleSuggestIssue(body, request, env);
}

function formatIssueTitle(form: FormSubmission): string {
  const fieldLabel = FIELD_LABELS[form.field] ?? form.field;
  return `[Suggestion] ${form.companySlug}: ${fieldLabel}`;
}

function formatIssueBody(form: FormSubmission): string {
  const lines: string[] = [
    "## Edit Suggestion",
    "",
    `**Company:** \`${form.companySlug}\``,
    `**Field:** ${FIELD_LABELS[form.field] ?? form.field}`,
    "",
  ];

  if (form.currentValue) {
    lines.push(`**Current value:** ${form.currentValue}`);
  }
  lines.push(`**Suggested value:** ${form.suggestedValue}`);
  lines.push("");

  if (form.sourceUrl) {
    lines.push(`**Source:** ${form.sourceUrl}`);
  }

  if (form.notes) {
    lines.push("", "### Notes", "", form.notes);
  }

  lines.push("", "---", "*Submitted via the LLM Trackers website.*");

  return lines.join("\n");
}

function issueLabels(field: string): string[] {
  const labels = ["suggestion"];
  if (field === "pricing") labels.push("pricing");
  if (field === "new-plan" || field === "removed-plan") labels.push("plans");
  if (field === "llm-support") labels.push("llm-support");
  return labels;
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("Content-Type") ?? "";
  return contentType.includes("application/json");
}

function requestBodyTooLarge(request: Request): boolean {
  const contentLength = request.headers.get("Content-Length");
  if (!contentLength) {
    return false;
  }

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes > MAX_BODY_BYTES;
}

function getClientIdentifier(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function isRateLimited(clientId: string, now: number = Date.now()): boolean {
  const recent = (submissionLog.get(clientId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    submissionLog.set(clientId, recent);
    return true;
  }

  recent.push(now);
  submissionLog.set(clientId, recent);
  return false;
}

async function verifyTurnstile(
  request: Request,
  env: AppEnv,
  token?: string
): Promise<Response | null> {
  if (!turnstileEnabled(env.TURNSTILE_SITE_KEY, env.TURNSTILE_SECRET_KEY)) {
    return null;
  }

  const verification = await verifyTurnstileToken(
    token ?? "",
    env.TURNSTILE_SECRET_KEY as string,
    getClientIdentifier(request)
  );
  if (!verification.ok) {
    return jsonResponse({ error: verification.error }, 403);
  }

  return null;
}

async function handleSuggestIssue(
  body: unknown,
  request: Request,
  env: AppEnv
): Promise<Response> {
  const validation = validateSubmission(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const form = validation.value;
  const turnstileError = await verifyTurnstile(request, env, form.turnstileToken);
  if (turnstileError) return turnstileError;

  try {
    const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
    const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);

    const issue = await createGitHubIssue(
      token,
      env.GITHUB_REPO_OWNER,
      env.GITHUB_REPO_NAME,
      formatIssueTitle(form),
      formatIssueBody(form),
      issueLabels(form.field)
    );

    return jsonResponse(
      {
        success: true,
        issueUrl: issue.html_url,
        issueNumber: issue.number,
      },
      201
    );
  } catch (err) {
    console.error("GitHub API error:", err);
    return jsonResponse(
      { error: "Failed to create GitHub issue. Please try again later." },
      502
    );
  }
}

async function handleSuggestPr(
  body: unknown,
  request: Request,
  env: AppEnv
): Promise<Response> {
  const validation = validateEditPayload(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const payload = validation.value;
  const turnstileError = await verifyTurnstile(request, env, payload.turnstileToken);
  if (turnstileError) return turnstileError;

  try {
    const result = await handleEditSuggestion(payload, env as FormEnv);
    if (!result.success) {
      return jsonResponse({ error: result.error }, result.status);
    }

    return jsonResponse(
      {
        success: true,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
      },
      201
    );
  } catch (err) {
    console.error("GitHub API error (suggest-pr):", err);
    return jsonResponse(
      { error: "Failed to create GitHub PR. Please try again later." },
      502
    );
  }
}

async function handleSuggestCompanyEdit(
  body: unknown,
  request: Request,
  env: AppEnv
): Promise<Response> {
  const validation = validateCompanyEditPayload(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const payload = validation.value;
  const turnstileError = await verifyTurnstile(request, env, payload.turnstileToken);
  if (turnstileError) return turnstileError;

  try {
    const result = await handleCompanyEdit(payload, env as FormEnv);
    if (!result.success) {
      return jsonResponse({ error: result.error }, result.status);
    }

    return jsonResponse(
      {
        success: true,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
      },
      201
    );
  } catch (err) {
    console.error("GitHub API error (company-edit):", err);
    return jsonResponse(
      { error: "Failed to create GitHub PR. Please try again later." },
      502
    );
  }
}

async function handleSuggestAddPlan(
  body: unknown,
  request: Request,
  env: AppEnv
): Promise<Response> {
  const validation = validateAddPlanPayload(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const payload = validation.value;
  const turnstileError = await verifyTurnstile(request, env, payload.turnstileToken);
  if (turnstileError) return turnstileError;

  try {
    const result = await handleAddPlan(payload, env as FormEnv);
    if (!result.success) {
      return jsonResponse({ error: result.error }, result.status);
    }

    return jsonResponse(
      {
        success: true,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
      },
      201
    );
  } catch (err) {
    console.error("GitHub API error (add-plan):", err);
    return jsonResponse(
      { error: "Failed to create GitHub PR. Please try again later." },
      502
    );
  }
}

async function handleSuggestAddCompany(
  body: unknown,
  request: Request,
  env: AppEnv
): Promise<Response> {
  const validation = validateAddCompanyPayload(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const payload = validation.value;
  const turnstileError = await verifyTurnstile(request, env, payload.turnstileToken);
  if (turnstileError) return turnstileError;

  try {
    const result = await handleAddCompany(payload, env as FormEnv);
    if (!result.success) {
      return jsonResponse({ error: result.error }, result.status);
    }

    return jsonResponse(
      {
        success: true,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
      },
      201
    );
  } catch (err) {
    console.error("GitHub API error (add-company):", err);
    return jsonResponse(
      { error: "Failed to create GitHub PR. Please try again later." },
      502
    );
  }
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}
