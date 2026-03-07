import { createAppJwt, getInstallationToken, createGitHubIssue } from "@llm-tracker/github";
import { validateSubmission } from "./validation";
import { formatIssueBody, formatIssueTitle, issueLabels } from "./issue";
import { jsonResponse, verifyTurnstileOrRespond } from "./http";
import type { AppEnv } from "../types";

export async function handleSuggestIssue(
  body: unknown,
  request: Request,
  env: AppEnv,
): Promise<Response> {
  const validation = validateSubmission(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const form = validation.value;
  const turnstileError = await verifyTurnstileOrRespond(request, env, form.turnstileToken);
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
      issueLabels(form.field),
    );

    return jsonResponse(
      {
        success: true,
        issueUrl: issue.html_url,
        issueNumber: issue.number,
      },
      201,
    );
  } catch (err) {
    console.error("GitHub API error:", err);
    return jsonResponse({ error: "Failed to create GitHub issue. Please try again later." }, 502);
  }
}
