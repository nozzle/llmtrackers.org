/**
 * Form submission worker for LLM Tracker Comparison.
 *
 * Accepts POST requests from the "Suggest Edit" form on the website,
 * validates the data, and creates a GitHub Issue via the GitHub App API.
 */

import {
  createAppJwt,
  getInstallationToken,
  createGitHubIssue,
} from "./github";
import { validateSubmission, type FormSubmission } from "./validation";
import { turnstileEnabled, verifyTurnstileToken } from "./turnstile";

// ---- Types ----

interface Env {
  // Secrets (set via wrangler secret put)
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET_KEY?: string;

  // Vars (set in wrangler.toml)
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  TURNSTILE_SITE_KEY?: string;
}

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const submissionLog = new Map<string, number[]>();

// ---- Issue formatting ----

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

  lines.push("", "---", "*Submitted via the LLM Tracker Comparison website.*");

  return lines.join("\n");
}

function issueLabels(field: string): string[] {
  const labels = ["suggestion"];
  if (field === "pricing") labels.push("pricing");
  if (field === "new-plan" || field === "removed-plan") labels.push("plans");
  if (field === "llm-support") labels.push("llm-support");
  return labels;
}

// ---- CORS ----

function corsHeaders(origin: string, allowedOrigin: string): HeadersInit {
  // In dev, allow any localhost origin; in prod, check against ALLOWED_ORIGIN
  const isAllowed =
    !allowedOrigin ||
    origin === allowedOrigin ||
    origin.startsWith("http://localhost:");

  if (!isAllowed) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function isAllowedOrigin(origin: string, allowedOrigin: string): boolean {
  return Boolean(
    origin && (!allowedOrigin || origin === allowedOrigin || origin.startsWith("http://localhost:"))
  );
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

// ---- Worker ----

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!isAllowedOrigin(origin, env.ALLOWED_ORIGIN)) {
      return jsonResponse({ error: "Origin not allowed" }, 403, cors);
    }

    // Only accept POST
    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed" },
        405,
        cors
      );
    }

    if (!isJsonRequest(request)) {
      return jsonResponse(
        { error: "Content-Type must be application/json" },
        415,
        cors
      );
    }

    if (requestBodyTooLarge(request)) {
      return jsonResponse(
        { error: "Request body is too large" },
        413,
        cors
      );
    }

    if (isRateLimited(getClientIdentifier(request))) {
      return jsonResponse(
        { error: "Too many submissions. Please try again later." },
        429,
        cors
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        { error: "Invalid JSON body" },
        400,
        cors
      );
    }

    // Validate
    const validation = validateSubmission(body);
    if (!validation.ok) {
      return jsonResponse(
        { error: validation.error },
        400,
        cors
      );
    }

    const form = validation.value;

    if (turnstileEnabled(env.TURNSTILE_SITE_KEY, env.TURNSTILE_SECRET_KEY)) {
      const verification = await verifyTurnstileToken(
        form.turnstileToken ?? "",
        env.TURNSTILE_SECRET_KEY as string,
        getClientIdentifier(request)
      );

      if (!verification.ok) {
        return jsonResponse({ error: verification.error }, 403, cors);
      }
    }

    // Create GitHub issue
    try {
      const jwt = await createAppJwt(
        env.GITHUB_APP_ID,
        env.GITHUB_APP_PRIVATE_KEY
      );
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
        201,
        cors
      );
    } catch (err) {
      console.error("GitHub API error:", err);
      return jsonResponse(
        { error: "Failed to create GitHub issue. Please try again later." },
        502,
        cors
      );
    }
  },
} satisfies ExportedHandler<Env>;

function jsonResponse(
  data: unknown,
  status: number,
  extraHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
