import { extractPageContent, extractPageHtml, extractPageText } from "../browser/extract-page";

export { extractPageContent };

export async function fetchPageText(url: string): Promise<string | null> {
  return extractPageText(url);
}

export async function fetchPageHtml(url: string): Promise<string | null> {
  return extractPageHtml(url);
}
