import { describe, expect, it, vi } from "vitest";
import { turnstileEnabled, verifyTurnstileToken } from "./turnstile";

describe("turnstileEnabled", () => {
  it("is enabled only when both keys are present", () => {
    expect(turnstileEnabled("site", "secret")).toBe(true);
    expect(turnstileEnabled("site", undefined)).toBe(false);
    expect(turnstileEnabled(undefined, "secret")).toBe(false);
  });
});

describe("verifyTurnstileToken", () => {
  it("rejects missing tokens", async () => {
    await expect(verifyTurnstileToken("", "secret")).resolves.toEqual({
      ok: false,
      error: "Missing Turnstile token",
    });
  });

  it("returns success for a valid Turnstile response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    );

    await expect(verifyTurnstileToken("token", "secret", "127.0.0.1")).resolves.toEqual({
      ok: true,
    });

    vi.unstubAllGlobals();
  });
});
