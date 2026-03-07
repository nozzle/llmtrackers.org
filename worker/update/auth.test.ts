import { describe, expect, it } from "vitest";
import { isAuthorizedManualTrigger } from "./auth";

describe("isAuthorizedManualTrigger", () => {
  it("returns false when token is missing", () => {
    const request = new Request("https://example.com", { method: "POST" });
    expect(isAuthorizedManualTrigger(request, undefined)).toBe(false);
  });

  it("returns false when authorization header is missing", () => {
    const request = new Request("https://example.com", { method: "POST" });
    expect(isAuthorizedManualTrigger(request, "secret-token")).toBe(false);
  });

  it("returns false when bearer token does not match", () => {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(isAuthorizedManualTrigger(request, "secret-token")).toBe(false);
  });

  it("returns true when bearer token matches", () => {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: { Authorization: "Bearer secret-token" },
    });
    expect(isAuthorizedManualTrigger(request, "secret-token")).toBe(true);
  });
});
