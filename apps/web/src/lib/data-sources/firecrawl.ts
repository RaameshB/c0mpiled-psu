import Firecrawl from "@mendable/firecrawl-js";
import {
  WebResearchResultSchema,
  safeParseArray,
  sourceSuccess,
  sourceError,
  type WebResearchResult,
  type DataSourceResult,
} from "@/lib/types/research";

function getClient(): Firecrawl {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set");
  return new Firecrawl({ apiKey: key });
}

// ---------------------------------------------------------------------------
// Web search + scrape
// ---------------------------------------------------------------------------

export async function searchWeb(
  query: string,
  limit = 5,
): Promise<WebResearchResult> {
  const client = getClient();

  const searchResult = await client.search(query, {
    limit,
    scrapeOptions: { formats: ["markdown"] },
  });

  const items = Array.isArray(searchResult) ? searchResult : [];
  const results = items.map((item: { url?: string; title?: string; markdown?: string; description?: string }) => ({
    url: item.url ?? "",
    title: item.title ?? "",
    content: item.markdown ?? item.description ?? "",
    source: "firecrawl:search",
  }));

  return { query, results };
}

// ---------------------------------------------------------------------------
// Scrape a specific URL
// ---------------------------------------------------------------------------

export async function scrapeUrl(url: string): Promise<WebResearchResult> {
  const client = getClient();

  const result = await client.scrape(url, { formats: ["markdown"] });

  return {
    query: url,
    results: [
      {
        url,
        title: result.metadata?.title ?? "",
        content: result.markdown ?? "",
        source: "firecrawl:scrape",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Deep research for a company's supply chain
// ---------------------------------------------------------------------------

export async function researchCompanySupplyChain(
  companyName: string,
  ticker: string,
): Promise<DataSourceResult<WebResearchResult[]>> {
  const queries = [
    `${companyName} supply chain tier 2 tier 3 suppliers`,
    `${companyName} supplier risk disruption`,
    `${companyName} ${ticker} vendor concentration risk`,
    `${companyName} procurement sourcing strategy`,
  ];

  try {
    const results = await Promise.allSettled(
      queries.map((q) => searchWeb(q, 3)),
    );

    const webResults: WebResearchResult[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        webResults.push(result.value);
      }
    }

    return sourceSuccess(
      "firecrawl:research",
      safeParseArray(WebResearchResultSchema, webResults) as WebResearchResult[],
    );
  } catch (err) {
    return sourceError("firecrawl:research", (err as Error).message);
  }
}
