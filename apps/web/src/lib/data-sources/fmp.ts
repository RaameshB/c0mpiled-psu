import {
  StockQuoteSchema,
  HistoricalPriceSchema,
  IncomeStatementSchema,
  BalanceSheetSchema,
  CashFlowStatementSchema,
  FinancialHealthSchema,
  CompanyProfileSchema,
  safeParseArray,
  safeParse,
  sourceSuccess,
  sourceError,
  type StockQuote,
  type HistoricalPrice,
  type IncomeStatement,
  type BalanceSheet,
  type CashFlowStatement,
  type FinancialHealth,
  type CompanyProfile,
  type DataSourceResult,
} from "@/lib/types/research";

const FMP_BASE = "https://financialmodelingprep.com/stable";

function apiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not set");
  return key;
}

async function fmpFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FMP_BASE}${path}`);
  url.searchParams.set("apikey", apiKey());
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`FMP ${path} returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------

export async function fetchCompanyProfile(ticker: string): Promise<DataSourceResult<CompanyProfile>> {
  try {
    const raw = await fmpFetch<unknown[]>("/profile", { symbol: ticker });
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return sourceError("fmp:profile", `No profile found for ${ticker}`);

    const mapped = {
      symbol: (item as Record<string, unknown>).symbol,
      companyName: (item as Record<string, unknown>).companyName,
      sector: (item as Record<string, unknown>).sector,
      industry: (item as Record<string, unknown>).industry,
      country: (item as Record<string, unknown>).country,
      exchange: (item as Record<string, unknown>).exchangeShortName ?? (item as Record<string, unknown>).exchange,
      marketCap: (item as Record<string, unknown>).mktCap ?? (item as Record<string, unknown>).marketCap,
      employees: (item as Record<string, unknown>).fullTimeEmployees ?? (item as Record<string, unknown>).employees,
      description: (item as Record<string, unknown>).description,
      website: (item as Record<string, unknown>).website,
      cik: (item as Record<string, unknown>).cik,
    };

    const profile = safeParse(CompanyProfileSchema, mapped, null as unknown as CompanyProfile);
    return sourceSuccess("fmp:profile", profile);
  } catch (err) {
    return sourceError("fmp:profile", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Stock quote
// ---------------------------------------------------------------------------

export async function fetchStockQuote(ticker: string): Promise<DataSourceResult<StockQuote>> {
  try {
    const raw = await fmpFetch<unknown[]>("/quote", { symbol: ticker });
    const item = Array.isArray(raw) ? raw[0] : raw;
    if (!item) return sourceError("fmp:quote", `No quote for ${ticker}`);

    const rec = item as Record<string, unknown>;
    const mapped = {
      symbol: rec.symbol,
      price: rec.price,
      change: rec.change,
      changePercent: rec.changesPercentage ?? rec.changePercent,
      volume: rec.volume,
      marketCap: rec.marketCap ?? rec.mktCap,
      pe: rec.pe ?? rec.priceEarningsRatio ?? null,
      timestamp: rec.timestamp ?? new Date().toISOString(),
    };

    const quote = safeParse(StockQuoteSchema, mapped, null as unknown as StockQuote);
    return sourceSuccess("fmp:quote", quote);
  } catch (err) {
    return sourceError("fmp:quote", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Historical prices (EOD)
// ---------------------------------------------------------------------------

export async function fetchHistoricalPrices(
  ticker: string,
  from?: string,
  to?: string,
): Promise<DataSourceResult<HistoricalPrice[]>> {
  try {
    const params: Record<string, string> = { symbol: ticker };
    if (from) params.from = from;
    if (to) params.to = to;

    const raw = await fmpFetch<unknown>("/historical-price-eod/full", params);
    const items = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.historical;
    if (!Array.isArray(items)) return sourceSuccess("fmp:historical", []);

    const mapped = (items as Record<string, unknown>[]).map((d) => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      adjClose: d.adjClose ?? d.close,
      volume: d.volume,
      vwap: d.vwap ?? d.close,
    }));

    const prices = safeParseArray(HistoricalPriceSchema, mapped);
    return sourceSuccess("fmp:historical", prices);
  } catch (err) {
    return sourceError("fmp:historical", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Income statements
// ---------------------------------------------------------------------------

export async function fetchIncomeStatements(
  ticker: string,
  period: "annual" | "quarter" = "quarter",
  limit = 8,
): Promise<DataSourceResult<IncomeStatement[]>> {
  try {
    const raw = await fmpFetch<Record<string, unknown>[]>("/income-statement", {
      symbol: ticker,
      period,
      limit: String(limit),
    });

    const mapped = (raw ?? []).map((d) => ({
      date: d.date ?? d.fillingDate,
      period: d.period ?? period,
      revenue: d.revenue,
      grossProfit: d.grossProfit,
      operatingIncome: d.operatingIncome,
      netIncome: d.netIncome,
      eps: d.eps,
      epsDiluted: d.epsDiluted ?? d.epsdiluted,
      grossProfitRatio: d.grossProfitRatio,
      operatingIncomeRatio: d.operatingIncomeRatio,
      netIncomeRatio: d.netIncomeRatio,
    }));

    return sourceSuccess("fmp:income", safeParseArray(IncomeStatementSchema, mapped));
  } catch (err) {
    return sourceError("fmp:income", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Balance sheets
// ---------------------------------------------------------------------------

export async function fetchBalanceSheets(
  ticker: string,
  period: "annual" | "quarter" = "quarter",
  limit = 8,
): Promise<DataSourceResult<BalanceSheet[]>> {
  try {
    const raw = await fmpFetch<Record<string, unknown>[]>("/balance-sheet-statement", {
      symbol: ticker,
      period,
      limit: String(limit),
    });

    const mapped = (raw ?? []).map((d) => ({
      date: d.date ?? d.fillingDate,
      period: d.period ?? period,
      totalAssets: d.totalAssets,
      totalLiabilities: d.totalLiabilities,
      totalEquity: d.totalStockholdersEquity ?? d.totalEquity,
      totalDebt: d.totalDebt,
      cashAndEquivalents: d.cashAndCashEquivalents ?? d.cashAndShortTermInvestments,
      netDebt: d.netDebt,
      totalCurrentAssets: d.totalCurrentAssets,
      totalCurrentLiabilities: d.totalCurrentLiabilities,
    }));

    return sourceSuccess("fmp:balance", safeParseArray(BalanceSheetSchema, mapped));
  } catch (err) {
    return sourceError("fmp:balance", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Cash flow statements
// ---------------------------------------------------------------------------

export async function fetchCashFlows(
  ticker: string,
  period: "annual" | "quarter" = "quarter",
  limit = 8,
): Promise<DataSourceResult<CashFlowStatement[]>> {
  try {
    const raw = await fmpFetch<Record<string, unknown>[]>("/cash-flow-statement", {
      symbol: ticker,
      period,
      limit: String(limit),
    });

    const mapped = (raw ?? []).map((d) => ({
      date: d.date ?? d.fillingDate,
      period: d.period ?? period,
      operatingCashFlow: d.operatingCashFlow ?? d.netCashProvidedByOperatingActivities,
      capitalExpenditure: d.capitalExpenditure,
      freeCashFlow: d.freeCashFlow,
      dividendsPaid: d.dividendsPaid ?? 0,
      netCashFromFinancing: d.netCashUsedForInvestingActivites ?? d.netCashFromFinancing ?? 0,
      netCashFromInvesting: d.netCashUsedProvidedByFinancingActivities ?? d.netCashFromInvesting ?? 0,
    }));

    return sourceSuccess("fmp:cashflow", safeParseArray(CashFlowStatementSchema, mapped));
  } catch (err) {
    return sourceError("fmp:cashflow", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Financial health (scores + ratios)
// ---------------------------------------------------------------------------

export async function fetchFinancialHealth(ticker: string): Promise<DataSourceResult<FinancialHealth>> {
  try {
    const [scoresRaw, ratiosRaw] = await Promise.all([
      fmpFetch<Record<string, unknown>[]>("/financial-scores", { symbol: ticker }).catch(() => []),
      fmpFetch<Record<string, unknown>[]>("/ratios", { symbol: ticker, limit: "1" }).catch(() => []),
    ]);

    const scores = Array.isArray(scoresRaw) ? scoresRaw[0] ?? {} : {};
    const ratios = Array.isArray(ratiosRaw) ? ratiosRaw[0] ?? {} : {};

    const mapped = {
      altmanZScore: (scores as Record<string, unknown>).altmanZScore ?? null,
      piotroskiScore: (scores as Record<string, unknown>).piotroskiScore ?? null,
      debtToEquity: (ratios as Record<string, unknown>).debtEquityRatio ?? null,
      currentRatio: (ratios as Record<string, unknown>).currentRatio ?? null,
      quickRatio: (ratios as Record<string, unknown>).quickRatio ?? null,
      returnOnEquity: (ratios as Record<string, unknown>).returnOnEquity ?? null,
      returnOnAssets: (ratios as Record<string, unknown>).returnOnAssets ?? null,
    };

    const health = safeParse(FinancialHealthSchema, mapped, null as unknown as FinancialHealth);
    return sourceSuccess("fmp:health", health);
  } catch (err) {
    return sourceError("fmp:health", (err as Error).message);
  }
}
