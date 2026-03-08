import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { backfillCompanyReviewSites } from "./review-site-backfill";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const dataDir = path.resolve(repoRoot, "data/companies");

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const targetSlug = args.find((arg) => !arg.startsWith("--"));

  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith(".yaml"))
    .sort()
    .filter((file) => (targetSlug ? file === `${targetSlug}.yaml` : true));

  if (files.length === 0) {
    console.error(
      targetSlug
        ? `No company YAML found for slug '${targetSlug}'`
        : `No YAML files found in ${dataDir}`,
    );
    process.exit(1);
  }

  let changedCount = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const raw = fs.readFileSync(filePath, "utf8");
    const result = await backfillCompanyReviewSites(raw);

    if (result.diffs.length === 0) {
      console.log(`SKIP ${file} (${result.company.name}) - no review-site changes`);
      for (const warning of result.warnings) {
        console.log(`  WARN ${warning.platform}: ${warning.message} (${warning.url})`);
      }
      continue;
    }

    changedCount += 1;
    console.log(`UPDATE ${file} (${result.company.name})`);
    for (const diff of result.diffs) {
      console.log(`  ${diff.platform}: ${diff.changes.length} change(s)`);
    }
    for (const warning of result.warnings) {
      console.log(`  WARN ${warning.platform}: ${warning.message} (${warning.url})`);
    }

    if (write) {
      fs.writeFileSync(filePath, result.updatedYamlText);
      console.log(`  wrote ${path.relative(repoRoot, filePath)}`);
    }
  }

  if (!write) {
    console.log("\nDry run only. Re-run with --write to persist YAML updates.");
  }

  console.log(`\nProcessed ${files.length} file(s); ${changedCount} changed.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
