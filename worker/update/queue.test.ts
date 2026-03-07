import { describe, expect, it, vi } from "vitest";
import { handleUpdateQueueBatch } from "./queue";
import * as githubModule from "./github";
import * as processModule from "./process";
import type { AppEnv, UpdateQueueMessage } from "../types";

describe("handleUpdateQueueBatch", () => {
  it("dedupes duplicate queue messages within a batch", async () => {
    vi.spyOn(githubModule, "createGitHubContext").mockResolvedValue({
      token: "token",
      owner: "nozzle",
      repo: "llm-tracker-comparison",
      defaultBranch: "main",
      baseSha: "abc123",
    });
    const processSpy = vi
      .spyOn(processModule, "processCompanyUpdate")
      .mockResolvedValue({ slug: "test-company", status: "no-changes" });

    const first = {
      body: {
        slug: "test-company",
        filePath: "data/companies/test-company.yaml",
        triggeredBy: "cron",
        requestedAt: new Date().toISOString(),
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };
    const second = {
      body: { ...first.body },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    const batch = {
      messages: [first, second],
      queue: "updates",
    } as unknown as MessageBatch<UpdateQueueMessage>;
    const env = {
      GITHUB_APP_ID: "",
      GITHUB_APP_PRIVATE_KEY: "",
      GITHUB_INSTALLATION_ID: "",
      GITHUB_REPO_OWNER: "",
      GITHUB_REPO_NAME: "",
      UPDATE_QUEUE: { send: vi.fn(), sendBatch: vi.fn() } as unknown as Queue<UpdateQueueMessage>,
      ASSETS: { fetch: vi.fn(), connect: vi.fn() } as unknown as Fetcher,
    } as AppEnv;

    await handleUpdateQueueBatch(batch, env);

    expect(processSpy).toHaveBeenCalledTimes(1);
    expect(first.ack).toHaveBeenCalledTimes(1);
    expect(second.ack).toHaveBeenCalledTimes(1);
    expect(first.retry).not.toHaveBeenCalled();
    expect(second.retry).not.toHaveBeenCalled();
  });
});
