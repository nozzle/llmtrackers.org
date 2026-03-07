import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueSingleCompanyUpdate } from "./enqueue";
import type { AppEnv } from "../types";
import type { UpdateQueueMessage } from "../types";

describe("enqueueSingleCompanyUpdate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends one queue message for the requested slug", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sendBatch = vi.fn().mockResolvedValue(undefined);
    const env: AppEnv = {
      GITHUB_APP_ID: "",
      GITHUB_APP_PRIVATE_KEY: "",
      GITHUB_INSTALLATION_ID: "",
      OPENAI_API_KEY: "",
      MANUAL_TRIGGER_TOKEN: "",
      TURNSTILE_SECRET_KEY: "",
      TURNSTILE_SITE_KEY: "",
      VITE_SITE_URL: "",
      GITHUB_REPO_OWNER: "",
      GITHUB_REPO_NAME: "",
      UPDATE_QUEUE: { send, sendBatch } as unknown as Queue<UpdateQueueMessage>,
      ASSETS: { fetch: vi.fn(), connect: vi.fn() } as unknown as Fetcher,
    };

    const summary = await enqueueSingleCompanyUpdate(env, "test-company", "manual");

    expect(summary.enqueued).toBe(1);
    expect(summary.slugs).toEqual(["test-company"]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "test-company",
        filePath: "data/companies/test-company.yaml",
        triggeredBy: "manual",
      })
    );
  });
});
