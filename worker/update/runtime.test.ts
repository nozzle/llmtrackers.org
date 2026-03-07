import { afterEach, describe, expect, it, vi } from "vitest";
import { enqueueSingleCompanyUpdate } from "./runtime";
import type { AppEnv } from "../types";

describe("enqueueSingleCompanyUpdate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends one queue message for the requested slug", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const env = {
      UPDATE_QUEUE: { send },
    } as unknown as AppEnv;

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
