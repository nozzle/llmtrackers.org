import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { CompanySchema, CompiledDataSchema, PublishedReviewSchema } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoDataDir = path.resolve(__dirname, "../../../data");
const companiesDir = path.resolve(repoDataDir, "companies");
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
  const reviewFiles = getYamlFiles(reviewsDir);

  if (companyFiles.length === 0) {
    console.error(`No YAML files found in ${companiesDir}`);
    process.exit(1);
  }

  const companies: ReturnType<typeof CompanySchema.parse>[] = [];
  const reviews: ReturnType<typeof PublishedReviewSchema.parse>[] = [];
  let hasErrors = false;
  const companySlugs = new Set<string>();

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

    companies.push(company);
    console.log(`  OK: ${file} (${company.name}, ${company.plans.length} plans)`);
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
    generatedAt: new Date().toISOString(),
  });

  fs.writeFileSync(outputPath, JSON.stringify(compiledData, null, 2));
  console.log(
    `\nCompiled ${companies.length} companies and ${reviews.length} reviews to ${path.relative(process.cwd(), outputPath)}`,
  );
}

compile();
