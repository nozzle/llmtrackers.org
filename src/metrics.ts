export function formatMetricId(metricId: string): string {
  return metricId
    .split("-")
    .map((part) => {
      if (part === "ai") return "AI";
      if (part === "llm") return "LLM";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function formatPlanSlug(planSlug: string): string {
  return planSlug
    .split("-")
    .map((part) => {
      if (part === "ai") return "AI";
      if (part === "llm") return "LLM";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}
