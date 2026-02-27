import type {
  CompanyIdentifier,
  AggregatedCompanyData,
} from "@/lib/types/research";
import { sourceError } from "@/lib/types/research";
import {
  fetchCompanyProfile,
  fetchStockQuote,
  fetchHistoricalPrices,
  fetchIncomeStatements,
  fetchBalanceSheets,
  fetchCashFlows,
  fetchFinancialHealth,
  fetchSecFilings,
  fetchSupplyChainNews,
  fetchLitigationNews,
  fetchSupplyChainIndicators,
  fetchEnvironmentalViolations,
  fetchOshaInspections,
  researchCompanySupplyChain,
} from "@/lib/data-sources";

// ---------------------------------------------------------------------------
// Aggregate all data sources for a single company
// ---------------------------------------------------------------------------

export async function aggregateCompanyData(
  company: CompanyIdentifier,
): Promise<AggregatedCompanyData> {
  const { ticker, name } = company;
  const companyName = name ?? ticker;

  // Calculate date range: last 2 years of historical prices
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const fromDate = twoYearsAgo.toISOString().split("T")[0];

  // Fire all fetches in parallel -- each source handles its own errors
  const [
    profile,
    stockQuote,
    historicalPrices,
    incomeStatements,
    balanceSheets,
    cashFlows,
    financialHealth,
    secFilings,
    supplyChainNews,
    litigationNews,
    macroIndicators,
    environmentalViolations,
    oshaInspections,
    webResearch,
  ] = await Promise.all([
    fetchCompanyProfile(ticker),
    fetchStockQuote(ticker),
    fetchHistoricalPrices(ticker, fromDate),
    fetchIncomeStatements(ticker, "quarter", 8),
    fetchBalanceSheets(ticker, "quarter", 8),
    fetchCashFlows(ticker, "quarter", 8),
    fetchFinancialHealth(ticker),
    fetchSecFilings(ticker, ["10-K", "10-Q", "8-K"], 20),
    fetchSupplyChainNews(companyName, ticker),
    fetchLitigationNews(companyName, ticker),
    fetchSupplyChainIndicators(fromDate),
    fetchEnvironmentalViolations(companyName),
    fetchOshaInspections(companyName),
    researchCompanySupplyChain(companyName, ticker),
  ]);

  // Merge supply chain + litigation news into a single news result
  const mergedNews = mergeNewsResults(supplyChainNews, litigationNews);

  return {
    company,
    profile,
    stockQuote,
    historicalPrices,
    incomeStatements,
    balanceSheets,
    cashFlows,
    financialHealth,
    secFilings,
    news: mergedNews,
    macroIndicators,
    environmentalViolations,
    oshaInspections,
    webResearch,
  };
}

// ---------------------------------------------------------------------------
// Aggregate data for multiple companies (batch)
// ---------------------------------------------------------------------------

export async function aggregateBatch(
  companies: CompanyIdentifier[],
): Promise<AggregatedCompanyData[]> {
  return Promise.all(companies.map(aggregateCompanyData));
}

// ---------------------------------------------------------------------------
// Merge news results, deduplicating by URL
// ---------------------------------------------------------------------------

function mergeNewsResults(
  ...results: { success: boolean; data: { url: string }[] | null; source: string; error: string | null; fetchedAt: string }[]
) {
  const seen = new Set<string>();
  const merged: { url: string }[] = [];

  for (const result of results) {
    if (!result.success || !result.data) continue;
    for (const article of result.data) {
      if (seen.has(article.url)) continue;
      seen.add(article.url);
      merged.push(article);
    }
  }

  if (merged.length > 0) {
    return {
      source: "newsapi:merged",
      success: true as const,
      data: merged as AggregatedCompanyData["news"]["data"],
      error: null,
      fetchedAt: new Date().toISOString(),
    };
  }

  const firstError = results.find((r) => r.error)?.error ?? "No news found";
  return sourceError("newsapi:merged", firstError) as AggregatedCompanyData["news"];
}
