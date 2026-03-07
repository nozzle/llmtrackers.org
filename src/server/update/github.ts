import { createAppJwt, getInstallationToken, getDefaultBranchSha } from "@llm-tracker/github";
import type { AppEnv } from "../types";
import type { GitHubContext } from "./types";

interface GitHubContentEntry {
  name: string;
  path: string;
}

export async function createGitHubContext(env: AppEnv): Promise<GitHubContext> {
  const jwt = await createAppJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, env.GITHUB_INSTALLATION_ID);
  const owner = env.GITHUB_REPO_OWNER;
  const repo = env.GITHUB_REPO_NAME;
  const { branch: defaultBranch, sha: baseSha } = await getDefaultBranchSha(token, owner, repo);

  return { token, owner, repo, defaultBranch, baseSha };
}

export async function listCompanyFiles(github: GitHubContext): Promise<GitHubContentEntry[]> {
  const dirRes = await fetch(
    `https://api.github.com/repos/${github.owner}/${github.repo}/contents/data/companies`,
    {
      headers: {
        Authorization: `token ${github.token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "llm-tracker-update-checker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!dirRes.ok) {
    throw new Error(`Failed to list companies: ${dirRes.status}`);
  }

  const files: unknown = await dirRes.json();
  if (!Array.isArray(files)) {
    throw new Error("GitHub contents response was not an array");
  }

  return files.filter((file): file is GitHubContentEntry => {
    if (!file || typeof file !== "object") {
      return false;
    }

    const entry = file as Partial<GitHubContentEntry>;
    return (
      typeof entry.name === "string" &&
      entry.name.endsWith(".yaml") &&
      typeof entry.path === "string"
    );
  });
}
