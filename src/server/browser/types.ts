export interface ExtractedPageContent {
  finalUrl: string;
  title: string;
  byline: string | null;
  publishedDate: string | null;
  text: string;
  html: string;
  warnings: string[];
  challengeDetected: boolean;
}
