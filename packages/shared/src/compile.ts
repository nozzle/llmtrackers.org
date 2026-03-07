import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { CompanySchema, CompiledDataSchema } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../../data/companies");
const outputPath = path.resolve(__dirname, "../compiled-data.json");

function compile() {
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  if (files.length === 0) {
    console.error(`No YAML files found in ${dataDir}`);
    process.exit(1);
  }

  const companies: ReturnType<typeof CompanySchema.parse>[] = [];
  let hasErrors = false;
  const companySlugs = new Set<string>();

  for (const file of files) {
    const filePath = path.join(dataDir, file);
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

  if (hasErrors) {
    console.error("\nCompilation failed due to validation errors.");
    process.exit(1);
  }

  const compiledData = CompiledDataSchema.parse({
    companies,
    generatedAt: new Date().toISOString(),
  });

  fs.writeFileSync(outputPath, JSON.stringify(compiledData, null, 2));
  console.log(
    `\nCompiled ${companies.length} companies to ${path.relative(process.cwd(), outputPath)}`,
  );
}

compile();
