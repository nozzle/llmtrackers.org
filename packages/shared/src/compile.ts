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

  const companies = [];
  let hasErrors = false;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = parseYaml(raw);

    const result = CompanySchema.safeParse(parsed);
    if (!result.success) {
      console.error(`\nValidation errors in ${file}:`);
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      hasErrors = true;
      continue;
    }

    companies.push(result.data);
    console.log(`  OK: ${file} (${result.data.name}, ${result.data.plans.length} plans)`);
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
    `\nCompiled ${companies.length} companies to ${path.relative(process.cwd(), outputPath)}`
  );
}

compile();
