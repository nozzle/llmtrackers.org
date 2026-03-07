import { describe, expect, it } from "vitest";
import {
  diffReviewSites,
  formatReviewSiteDiffMarkdown,
  parseTrustpilotReviewSite,
  parseTrustRadiusReviewSite,
} from "./review-sites";

const trustpilotHtml = `
<html><head>
<script type="application/ld+json">{
  "@context":"https://schema.org",
  "@graph":[
    {
      "@type":"Organization",
      "aggregateRating":{
        "@type":"AggregateRating",
        "bestRating":"5",
        "worstRating":"1",
        "ratingValue":"1.8",
        "reviewCount":"306"
      }
    },
    {
      "@type":"Review",
      "author":{"@type":"Person","name":"Jane Doe","url":"https://www.trustpilot.com/users/1"},
      "datePublished":"2026-02-16T07:39:34.000Z",
      "headline":"Great when it works",
      "reviewBody":"The interface is useful but billing is frustrating.",
      "reviewRating":{"@type":"Rating","bestRating":"5","worstRating":"1","ratingValue":"2"}
    }
  ]
}</script>
</head><body>
<div class="styles_distributions__3hJ2W">
  <div data-star-rating="five"><span>5-star</span><div><span style="width:20%"></span></div></div>
  <div data-star-rating="four"><span>4-star</span><div><span style="width:10%"></span></div></div>
  <div data-star-rating="three"><span>3-star</span><div><span style="width:5%"></span></div></div>
  <div data-star-rating="two"><span>2-star</span><div><span style="width:15%"></span></div></div>
  <div data-star-rating="one"><span>1-star</span><div><span style="width:50%"></span></div></div>
</div>
</body></html>`;

const trustRadiusNextData = {
  props: {
    pageProps: {
      product: {
        rating: { trScore: 8.977 },
        counts: { publishedReviews: 77 },
      },
      truncatedReviews: {
        hits: [
          {
            slug: "ahrefs-2025-04-17-11-11-41",
            heading: "Ahrefs the best all rounder SEO tool",
            rating: 9,
            publishedDate: "2025-04-17T11:11:41.000Z",
            reviewer: { fullName: "Jon Baldwin" },
            questions: [
              {
                slug: "product-usage",
                responseText:
                  "Ahrefs is the tool we rely on for getting an accurate count of referring domains.",
              },
            ],
          },
        ],
      },
      productPageFilteredReviews: {
        searchData: {
          userFilters: [
            {
              type: "terms",
              buckets: [
                { key: "5", filtered_count: 60 },
                { key: "4", filtered_count: 15 },
                { key: "3", filtered_count: 1 },
                { key: "2", filtered_count: 0 },
                { key: "1", filtered_count: 1 },
              ],
            },
          ],
        },
      },
    },
  },
};

const trustRadiusHtml = `
<html><head>
<script type="application/ld+json">[{"@context":"https://schema.org","@type":"SoftwareApplication","aggregateRating":{"@type":"AggregateRating","ratingValue":9,"ratingCount":389,"bestRating":10,"worstRating":0}}]</script>
</head><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(trustRadiusNextData)}</script>
</body></html>`;

describe("review site parsers", () => {
  it("parses Trustpilot aggregate data, native distribution, and snippets", () => {
    const parsed = parseTrustpilotReviewSite(
      "https://www.trustpilot.com/review/example.com",
      trustpilotHtml,
    );

    expect(parsed?.score).toBe(1.8);
    expect(parsed?.maxScore).toBe(5);
    expect(parsed?.reviewCount).toBe(306);
    expect(parsed?.ratingDistribution).toEqual([
      { label: "5-star", value: 5, count: 61 },
      { label: "4-star", value: 4, count: 31 },
      { label: "3-star", value: 3, count: 15 },
      { label: "2-star", value: 2, count: 46 },
      { label: "1-star", value: 1, count: 153 },
    ]);
    expect(parsed?.reviews[0]?.author).toBe("Jane Doe");
    expect(parsed?.reviews[0]?.rating).toBe(2);
  });

  it("parses TrustRadius aggregate data, buckets, and review snippets", () => {
    const parsed = parseTrustRadiusReviewSite(
      "https://www.trustradius.com/products/ahrefs/reviews",
      trustRadiusHtml,
    );

    expect(parsed?.score).toBe(8.977);
    expect(parsed?.maxScore).toBe(10);
    expect(parsed?.reviewCount).toBe(77);
    expect(parsed?.ratingDistribution[0]).toEqual({
      label: "5",
      value: 5,
      count: 60,
    });
    expect(parsed?.reviews[0]?.title).toContain("Ahrefs");
    expect(parsed?.reviews[0]?.excerpt).toContain("accurate count of referring domains");
  });
});

describe("review site diffs", () => {
  it("detects material review-site changes and formats markdown", () => {
    const diffs = diffReviewSites(
      {
        trustpilot: {
          url: "https://www.trustpilot.com/review/example.com",
          score: 4.0,
          maxScore: 5,
          reviewCount: 100,
          ratingDistribution: [
            { label: "5-star", value: 5, count: 80 },
            { label: "1-star", value: 1, count: 20 },
          ],
          reviews: [],
        },
      },
      {
        trustpilot: {
          url: "https://www.trustpilot.com/review/example.com",
          score: 4.3,
          maxScore: 5,
          reviewCount: 112,
          ratingDistribution: [
            { label: "5-star", value: 5, count: 88 },
            { label: "1-star", value: 1, count: 24 },
          ],
          reviews: [],
        },
      },
    );

    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.changes.some((change) => change.field === "score")).toBe(true);
    expect(diffs[0]?.changes.some((change) => change.field === "reviewCount")).toBe(true);

    const markdown = formatReviewSiteDiffMarkdown(diffs);
    expect(markdown).toContain("## Review Site Changes");
    expect(markdown).toContain("Trustpilot");
  });
});
