import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Primitives & helpers
// ---------------------------------------------------------------------------

const numericString = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? parseFloat(v) : v));

const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().catch(null);

// ---------------------------------------------------------------------------
// Company identifier
// ---------------------------------------------------------------------------

export const CompanyIdentifierSchema = z.object({
  ticker: z.string(),
  name: z.string().optional(),
  cik: z.string().optional(),
});

export type CompanyIdentifier = z.infer<typeof CompanyIdentifierSchema>;

// ---------------------------------------------------------------------------
// Stock quote
// ---------------------------------------------------------------------------

export const StockQuoteSchema = z.object({
  symbol: z.string(),
  price: numericString,
  change: numericString,
  changePercent: numericString,
  volume: numericString,
  marketCap: numericString,
  pe: nullable(numericString),
  timestamp: z.string(),
});

export type StockQuote = z.infer<typeof StockQuoteSchema>;

// ---------------------------------------------------------------------------
// Historical price
// ---------------------------------------------------------------------------

export const HistoricalPriceSchema = z.object({
  date: z.string(),
  open: numericString,
  high: numericString,
  low: numericString,
  close: numericString,
  adjClose: numericString,
  volume: numericString,
  vwap: numericString,
});

export type HistoricalPrice = z.infer<typeof HistoricalPriceSchema>;

// ---------------------------------------------------------------------------
// Income statement
// ---------------------------------------------------------------------------

export const IncomeStatementSchema = z.object({
  date: z.string(),
  period: z.string(),
  revenue: numericString,
  grossProfit: numericString,
  operatingIncome: numericString,
  netIncome: numericString,
  eps: numericString,
  epsDiluted: numericString,
  grossProfitRatio: numericString,
  operatingIncomeRatio: numericString,
  netIncomeRatio: numericString,
});

export type IncomeStatement = z.infer<typeof IncomeStatementSchema>;

// ---------------------------------------------------------------------------
// Balance sheet
// ---------------------------------------------------------------------------

export const BalanceSheetSchema = z.object({
  date: z.string(),
  period: z.string(),
  totalAssets: numericString,
  totalLiabilities: numericString,
  totalEquity: numericString,
  totalDebt: numericString,
  cashAndEquivalents: numericString,
  netDebt: numericString,
  totalCurrentAssets: numericString,
  totalCurrentLiabilities: numericString,
});

export type BalanceSheet = z.infer<typeof BalanceSheetSchema>;

// ---------------------------------------------------------------------------
// Cash flow statement
// ---------------------------------------------------------------------------

export const CashFlowStatementSchema = z.object({
  date: z.string(),
  period: z.string(),
  operatingCashFlow: numericString,
  capitalExpenditure: numericString,
  freeCashFlow: numericString,
  dividendsPaid: numericString,
  netCashFromFinancing: numericString,
  netCashFromInvesting: numericString,
});

export type CashFlowStatement = z.infer<typeof CashFlowStatementSchema>;

// ---------------------------------------------------------------------------
// Financial health scores
// ---------------------------------------------------------------------------

export const FinancialHealthSchema = z.object({
  altmanZScore: nullable(numericString),
  piotroskiScore: nullable(numericString),
  debtToEquity: nullable(numericString),
  currentRatio: nullable(numericString),
  quickRatio: nullable(numericString),
  returnOnEquity: nullable(numericString),
  returnOnAssets: nullable(numericString),
});

export type FinancialHealth = z.infer<typeof FinancialHealthSchema>;

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------

export const CompanyProfileSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  sector: z.string().catch("Unknown"),
  industry: z.string().catch("Unknown"),
  country: z.string().catch("Unknown"),
  exchange: z.string().catch("Unknown"),
  marketCap: numericString,
  employees: nullable(numericString),
  description: z.string().catch(""),
  website: z.string().catch(""),
  cik: z.string().catch(""),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

// ---------------------------------------------------------------------------
// SEC filings
// ---------------------------------------------------------------------------

export const SecFilingSchema = z.object({
  accessionNumber: z.string(),
  filingDate: z.string(),
  form: z.string(),
  description: z.string().catch(""),
  documentUrl: z.string().catch(""),
  filingUrl: z.string().catch(""),
});

export type SecFiling = z.infer<typeof SecFilingSchema>;

// ---------------------------------------------------------------------------
// News articles
// ---------------------------------------------------------------------------

export const NewsArticleSchema = z.object({
  title: z.string(),
  description: nullable(z.string()),
  url: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  content: nullable(z.string()),
});

export type NewsArticle = z.infer<typeof NewsArticleSchema>;

// ---------------------------------------------------------------------------
// Macro indicators (FRED)
// ---------------------------------------------------------------------------

export const MacroObservationSchema = z.object({
  date: z.string(),
  value: nullable(numericString),
});

export const MacroIndicatorSchema = z.object({
  seriesId: z.string(),
  seriesName: z.string(),
  observations: z.array(MacroObservationSchema),
  units: z.string(),
  frequency: z.string(),
});

export type MacroIndicator = z.infer<typeof MacroIndicatorSchema>;

// ---------------------------------------------------------------------------
// Environmental violations (EPA ECHO)
// ---------------------------------------------------------------------------

export const EnvironmentalViolationSchema = z.object({
  facilityName: z.string(),
  facilityId: z.string(),
  state: z.string().catch("Unknown"),
  violationDate: nullable(z.string()),
  violationType: z.string().catch("Unknown"),
  complianceStatus: z.string().catch("Unknown"),
  penaltyAmount: nullable(numericString),
  programArea: z.string().catch("Unknown"),
});

export type EnvironmentalViolation = z.infer<typeof EnvironmentalViolationSchema>;

// ---------------------------------------------------------------------------
// OSHA inspections
// ---------------------------------------------------------------------------

export const OshaInspectionSchema = z.object({
  activityNumber: z.string(),
  establishmentName: z.string(),
  siteState: z.string().catch("Unknown"),
  openDate: z.string(),
  closeDate: nullable(z.string()),
  violationType: nullable(z.string()),
  penaltyAmount: numericString,
  inspectionType: z.string().catch("Unknown"),
  industry: z.string().catch("Unknown"),
});

export type OshaInspection = z.infer<typeof OshaInspectionSchema>;

// ---------------------------------------------------------------------------
// Web research (Firecrawl)
// ---------------------------------------------------------------------------

export const WebResearchItemSchema = z.object({
  url: z.string(),
  title: z.string().catch(""),
  content: z.string().catch(""),
  source: z.string().catch("web"),
});

export const WebResearchResultSchema = z.object({
  query: z.string(),
  results: z.array(WebResearchItemSchema),
});

export type WebResearchResult = z.infer<typeof WebResearchResultSchema>;

// ---------------------------------------------------------------------------
// Data source result wrapper -- every source returns this
// ---------------------------------------------------------------------------

export function DataSourceResultSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    source: z.string(),
    success: z.boolean(),
    data: dataSchema.nullable().catch(null),
    error: z.string().nullable().catch(null),
    fetchedAt: z.string(),
  });
}

export type DataSourceResult<T> = {
  source: string;
  success: boolean;
  data: T | null;
  error: string | null;
  fetchedAt: string;
};

// ---------------------------------------------------------------------------
// Aggregated company data
// ---------------------------------------------------------------------------

export const AggregatedCompanyDataSchema = z.object({
  company: CompanyIdentifierSchema,
  profile: DataSourceResultSchema(CompanyProfileSchema),
  stockQuote: DataSourceResultSchema(StockQuoteSchema),
  historicalPrices: DataSourceResultSchema(z.array(HistoricalPriceSchema)),
  financialHealth: DataSourceResultSchema(FinancialHealthSchema),
  secFilings: DataSourceResultSchema(z.array(SecFilingSchema)),
  news: DataSourceResultSchema(z.array(NewsArticleSchema)),
  macroIndicators: DataSourceResultSchema(z.array(MacroIndicatorSchema)),
  environmentalViolations: DataSourceResultSchema(z.array(EnvironmentalViolationSchema)),
  webResearch: DataSourceResultSchema(z.array(WebResearchResultSchema)),
});

export type AggregatedCompanyData = z.infer<typeof AggregatedCompanyDataSchema>;

// ---------------------------------------------------------------------------
// Evaluated data -- output of LLM evaluation pass
// ---------------------------------------------------------------------------

export const RiskSignalSchema = z.object({
  category: z.string(),
  signal: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  dataPoints: z.array(z.record(z.string(), z.unknown())),
  reasoning: z.string(),
});

export const EvaluatedDataSchema = z.object({
  company: CompanyIdentifierSchema,
  riskSignals: z.array(RiskSignalSchema),
  relevantFinancials: z.record(z.string(), z.unknown()),
  relevantNews: z.array(NewsArticleSchema),
  supplyChainInsights: z.array(z.string()),
  recommendedForModel: z.boolean(),
  evaluationSummary: z.string(),
});

export type EvaluatedData = z.infer<typeof EvaluatedDataSchema>;

// ---------------------------------------------------------------------------
// Utility: safe parse with fallback
// ---------------------------------------------------------------------------

export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  fallback: T,
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  console.warn("[schema-validation] Parse failed, using fallback:", result.error.message);
  return fallback;
}

export function safeParseArray<T>(
  itemSchema: z.ZodType<T>,
  data: unknown,
): T[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => itemSchema.safeParse(item))
    .filter((r): r is z.ZodSafeParseSuccess<T> => r.success)
    .map((r) => r.data);
}

// ---------------------------------------------------------------------------
// Utility: DataSourceResult constructors
// ---------------------------------------------------------------------------

export function sourceSuccess<T>(source: string, data: T): DataSourceResult<T> {
  return { source, success: true, data, error: null, fetchedAt: new Date().toISOString() };
}

/**
 * Returns DataSourceResult<never> which is assignable to DataSourceResult<T>
 * for any T, because `never | null` = `null` which satisfies `T | null`.
 */
export function sourceError(source: string, error: string): DataSourceResult<never> {
  return { source, success: false, data: null, error, fetchedAt: new Date().toISOString() };
}
