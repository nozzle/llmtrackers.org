import { describe, expect, it } from "vitest";
import { validateSubmission } from "./validation";

describe("validateSubmission", () => {
  it("accepts a valid public suggestion payload", () => {
    const result = validateSubmission({
      companySlug: "test-company",
      field: "pricing",
      suggestedValue: "$99/month",
      sourceUrl: "https://example.com/pricing",
      notes: "Public note",
      website: "",
      turnstileToken: "token",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects honeypot spam submissions", () => {
    const result = validateSubmission({
      companySlug: "test-company",
      field: "pricing",
      suggestedValue: "$99/month",
      website: "https://spam.example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Spam submission rejected");
    }
  });

  it("rejects invalid source URLs", () => {
    const result = validateSubmission({
      companySlug: "test-company",
      field: "pricing",
      suggestedValue: "$99/month",
      sourceUrl: "not-a-url",
      website: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("sourceUrl must be a valid URL");
    }
  });

  it("rejects non-string turnstile tokens", () => {
    const result = validateSubmission({
      companySlug: "test-company",
      field: "pricing",
      suggestedValue: "$99/month",
      website: "",
      turnstileToken: 123,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("turnstileToken must be a string");
    }
  });
});
