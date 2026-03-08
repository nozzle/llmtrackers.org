import fs from "node:fs";
import path from "node:path";
import { extractPageContent } from "../src/server/browser/extract-page";

async function main() {
  const [url, outputBase = "tmp/rendered-page"] = process.argv.slice(2);

  if (!url) {
    console.error("Usage: tsx scripts/inspect-rendered-page.ts <url> [outputBase]");
    process.exit(1);
  }

  const extracted = await extractPageContent(url);
  if (!extracted) {
    console.error("Failed to extract page content");
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outputBase), { recursive: true });
  fs.writeFileSync(`${outputBase}.html`, extracted.html);
  fs.writeFileSync(`${outputBase}.txt`, extracted.text);
  fs.writeFileSync(`${outputBase}.json`, JSON.stringify(extracted, null, 2));

  console.log(`Wrote ${outputBase}.html`);
  console.log(`Wrote ${outputBase}.txt`);
  console.log(`Wrote ${outputBase}.json`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
