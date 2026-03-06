import compiledData from "../../../packages/shared/compiled-data.json";
import type { Company, CompiledData, Plan, PlanWithCompany } from "@llm-tracker/shared";

const data = compiledData as CompiledData;

export function getAllCompanies(): Company[] {
  return data.companies;
}

export function getCompanyBySlug(slug: string): Company | undefined {
  return data.companies.find((c) => c.slug === slug);
}

export function getAllPlansWithCompany(): PlanWithCompany[] {
  return data.companies.flatMap((company) =>
    company.plans.map((plan) => ({
      ...plan,
      companySlug: company.slug,
      companyName: company.name,
      companyWebsite: company.website,
    }))
  );
}

export function getPlanByKey(key: string): PlanWithCompany | undefined {
  // key format: "company-slug/plan-slug"
  const [companySlug, planSlug] = key.split("/");
  const company = getCompanyBySlug(companySlug);
  if (!company) return undefined;
  const plan = company.plans.find((p) => p.slug === planSlug);
  if (!plan) return undefined;
  return {
    ...plan,
    companySlug: company.slug,
    companyName: company.name,
    companyWebsite: company.website,
  };
}

export function getGeneratedAt(): string {
  return data.generatedAt;
}
