import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  CompanySchema,
  CompiledDataSchema,
  MetricSchema,
  PublishedReviewSchema,
} from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDataDir = path.resolve(__dirname, "../../../data");
const companiesDir = path.resolve(repoDataDir, "companies");
const metricsDir = path.resolve(repoDataDir, "metrics");
const reviewsDir = path.resolve(repoDataDir, "reviews");
const outputPath = path.resolve(__dirname, "../compiled-data.json");

function getYamlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
}

function compile() {
  const companyFiles = getYamlFiles(companiesDir);
  const metricFiles = getYamlFiles(metricsDir);
  const reviewFiles = getYamlFiles(reviewsDir);

  if (companyFiles.length === 0) {
    console.error(`No YAML files found in ${companiesDir}`);
    process.exit(1);
  }

  const companies: ReturnType<typeof CompanySchema.parse>[] = [];
  const metrics: ReturnType<typeof MetricSchema.parse>[] = [];
  const reviews: ReturnType<typeof PublishedReviewSchema.parse>[] = [];
  let hasErrors = false;
  const companySlugs = new Set<string>();
  const planSlugsByCompany = new Map<string, Set<string>>();

  for (const file of companyFiles) {
    const filePath = path.join(companiesDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed: unknown = parseYaml(raw);

    const result = CompanySchema.safeParse(parsed);
    if (!result.success) {
      console.error(`\nValidation errors in ${file}:`);
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      hasErrors = true;
      continue;
    }

    const company = result.data;
    const expectedSlug = file.replace(/\.ya?ml$/, "");

    if (company.slug !== expectedSlug) {
      console.error(`\nInvariant error in ${file}: slug must match filename (${expectedSlug})`);
      hasErrors = true;
      continue;
    }

    if (companySlugs.has(company.slug)) {
      console.error(`\nInvariant error in ${file}: duplicate company slug ${company.slug}`);
      hasErrors = true;
      continue;
    }
    companySlugs.add(company.slug);

    const planSlugs = new Set<string>();
    const planNames = new Set<string>();
    let companyHasPlanErrors = false;

    for (const plan of company.plans) {
      if (planSlugs.has(plan.slug)) {
        console.error(`\nInvariant error in ${file}: duplicate plan slug ${plan.slug}`);
        hasErrors = true;
        companyHasPlanErrors = true;
      }
      if (planNames.has(plan.name.toLowerCase())) {
        console.error(`\nInvariant error in ${file}: duplicate plan name ${plan.name}`);
        hasErrors = true;
        companyHasPlanErrors = true;
      }

      planSlugs.add(plan.slug);
      planNames.add(plan.name.toLowerCase());
    }

    if (companyHasPlanErrors) {
      continue;
    }

    planSlugsByCompany.set(company.slug, planSlugs);
    companies.push(company);
    console.log(`  OK: ${file} (${company.name}, ${company.plans.length} plans)`);
  }

  const metricIds = new Set<string>();

  for (const file of metricFiles) {
    const filePath = path.join(metricsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed: unknown = parseYaml(raw);

    const result = MetricSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`\nValidation errors in ${file}:`);
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      hasErrors = true;
      continue;
    }

    const metric = result.data;
    const expectedId = file.replace(/\.ya?ml$/, "");

    if (metric.id !== expectedId) {
      console.error(`\nInvariant error in ${file}: id must match filename (${expectedId})`);
      hasErrors = true;
      continue;
    }

    if (metricIds.has(metric.id)) {
      console.error(`\nInvariant error in ${file}: duplicate metric id ${metric.id}`);
      hasErrors = true;
      continue;
    }
    metricIds.add(metric.id);

    const supportPairs = new Set<string>();
    let metricHasErrors = false;

    for (const support of metric.supportedBy) {
      if (!companySlugs.has(support.companySlug)) {
        console.error(
          `\nInvariant error in ${file}: unknown company slug ${support.companySlug} in supportedBy`,
        );
        hasErrors = true;
        metricHasErrors = true;
      }

      const planSlugs = planSlugsByCompany.get(support.companySlug);
      if (!planSlugs?.has(support.planSlug)) {
        console.error(
          `\nInvariant error in ${file}: unknown plan slug ${support.companySlug}/${support.planSlug} in supportedBy`,
        );
        hasErrors = true;
        metricHasErrors = true;
      }

      const pairKey = `${support.companySlug}/${support.planSlug}`;
      if (supportPairs.has(pairKey)) {
        console.error(`\nInvariant error in ${file}: duplicate supportedBy entry ${pairKey}`);
        hasErrors = true;
        metricHasErrors = true;
      }
      supportPairs.add(pairKey);
    }

    if (metricHasErrors) {
      continue;
    }

    metrics.push(metric);
    console.log(`  OK: ${file} (${metric.supportedBy.length} supported plans)`);
  }

  const reviewSlugs = new Set<string>();

  for (const file of reviewFiles) {
    const filePath = path.join(reviewsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed: unknown = parseYaml(raw);

    const result = PublishedReviewSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`\nValidation errors in ${file}:`);
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      hasErrors = true;
      continue;
    }

    const review = result.data;
    const expectedSlug = file.replace(/\.ya?ml$/, "");

    if (review.slug !== expectedSlug) {
      console.error(`\nInvariant error in ${file}: slug must match filename (${expectedSlug})`);
      hasErrors = true;
      continue;
    }

    if (reviewSlugs.has(review.slug)) {
      console.error(`\nInvariant error in ${file}: duplicate review slug ${review.slug}`);
      hasErrors = true;
      continue;
    }
    reviewSlugs.add(review.slug);

    const ratedCompanies = new Set<string>();
    let reviewHasErrors = false;

    for (const rating of review.companyRatings) {
      if (!companySlugs.has(rating.companySlug)) {
        console.error(
          `\nInvariant error in ${file}: unknown company slug ${rating.companySlug} in companyRatings`,
        );
        hasErrors = true;
        reviewHasErrors = true;
      }

      if (ratedCompanies.has(rating.companySlug)) {
        console.error(
          `\nInvariant error in ${file}: duplicate company rating for ${rating.companySlug}`,
        );
        hasErrors = true;
        reviewHasErrors = true;
      }

      ratedCompanies.add(rating.companySlug);
    }

    if (reviewHasErrors) {
      continue;
    }

    reviews.push(review);
    console.log(`  OK: ${file} (${review.name}, ${review.companyRatings.length} ratings)`);
  }

  if (hasErrors) {
    console.error("\nCompilation failed due to validation errors.");
    process.exit(1);
  }

  const compiledData = CompiledDataSchema.parse({
    companies,
    reviews,
    metrics,
    generatedAt: new Date().toISOString(),
  });

  fs.writeFileSync(outputPath, JSON.stringify(compiledData, null, 2));
  console.log(
    `\nCompiled ${companies.length} companies, ${metrics.length} metrics, and ${reviews.length} reviews to ${path.relative(process.cwd(), outputPath)}`,
  );
}

compile();
