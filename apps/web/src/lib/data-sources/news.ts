import {
  NewsArticleSchema,
  safeParseArray,
  sourceSuccess,
  sourceError,
  type NewsArticle,
  type DataSourceResult,
} from "@/lib/types/research";

const NEWSAPI_BASE = "https://newsapi.org/v2";

function apiKey(): string {
  const key = process.env.NEWSAPI_KEY;
  if (!key) throw new Error("NEWSAPI_KEY is not set");
  return key;
}

async function newsApiFetch(
  endpoint: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${NEWSAPI_BASE}${endpoint}`);
  url.searchParams.set("apiKey", apiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`NewsAPI ${endpoint} returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Search articles by query
// ---------------------------------------------------------------------------

export async function searchNews(
  query: string,
  pageSize = 20,
  sortBy: "relevancy" | "publishedAt" | "popularity" = "relevancy",
): Promise<DataSourceResult<NewsArticle[]>> {
  try {
    const raw = await newsApiFetch("/everything", {
      q: query,
      pageSize: String(pageSize),
      sortBy,
      language: "en",
    });

    const articles = (raw.articles as Record<string, unknown>[] | undefined) ?? [];

    const mapped = articles.map((a) => ({
      title: a.title,
      description: a.description ?? null,
      url: a.url,
      source: (a.source as Record<string, unknown>)?.name ?? "Unknown",
      publishedAt: a.publishedAt,
      content: a.content ?? null,
    }));

    return sourceSuccess("newsapi:search", safeParseArray(NewsArticleSchema, mapped));
  } catch (err) {
    return sourceError("newsapi:search", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Supply chain specific news for a company
// ---------------------------------------------------------------------------

export async function fetchSupplyChainNews(
  companyName: string,
  ticker: string,
): Promise<DataSourceResult<NewsArticle[]>> {
  const queries = [
    `"${companyName}" supply chain`,
    `"${companyName}" supplier OR vendor OR procurement`,
    `"${ticker}" supply chain disruption OR risk OR shortage`,
  ];

  try {
    const allArticles: NewsArticle[] = [];

    for (const query of queries) {
      const result = await searchNews(query, 10);
      if (result.success && result.data) {
        allArticles.push(...result.data);
      }
    }

    const deduplicated = deduplicateArticles(allArticles);
    return sourceSuccess("newsapi:supply-chain", deduplicated);
  } catch (err) {
    return sourceError("newsapi:supply-chain", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Lawsuit and litigation news
// ---------------------------------------------------------------------------

export async function fetchLitigationNews(
  companyName: string,
  ticker: string,
): Promise<DataSourceResult<NewsArticle[]>> {
  const queries = [
    `"${companyName}" lawsuit OR litigation OR sued OR settlement`,
    `"${companyName}" regulatory action OR fine OR penalty OR violation`,
    `"${ticker}" fraud OR investigation OR enforcement`,
  ];

  try {
    const allArticles: NewsArticle[] = [];

    for (const query of queries) {
      const result = await searchNews(query, 10);
      if (result.success && result.data) {
        allArticles.push(...result.data);
      }
    }

    const deduplicated = deduplicateArticles(allArticles);
    return sourceSuccess("newsapi:litigation", deduplicated);
  } catch (err) {
    return sourceError("newsapi:litigation", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Deduplication by URL
// ---------------------------------------------------------------------------

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter((article) => {
    if (seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  });
}
