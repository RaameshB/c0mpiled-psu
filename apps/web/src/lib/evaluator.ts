import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod/v4";
import type { AggregatedCompanyData, EvaluatedData } from "@/lib/types/research";

// ---------------------------------------------------------------------------
// Evaluation prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a supply chain risk analyst specializing in tier 2 and tier 3 vendor risk assessment. You receive aggregated financial, regulatory, and news data about a company and must evaluate which data points are meaningful risk signals for a covariance-based risk model.

Your job is to:
1. Identify risk signals across categories: financial health, supply chain disruption, regulatory/compliance, litigation, environmental, workplace safety, and macro-economic exposure.
2. Rate each signal's severity: low, medium, high, or critical.
3. Extract the specific data points that support each signal.
4. Filter out noise -- not every data point is relevant. A minor OSHA fine from 5 years ago is not a current risk signal. A declining revenue trend over 4 quarters is.
5. Determine whether the company's data is worth passing to the quantitative model for deeper analysis.
6. Provide concise supply chain insights -- particularly anything suggesting tier 2/3 concentration risk, single-source dependencies, or geographic exposure.

Be rigorous. False positives waste model compute. False negatives miss real risk.`;

// ---------------------------------------------------------------------------
// Schema for structured LLM output
// ---------------------------------------------------------------------------

const EvaluationOutputSchema = z.object({
  riskSignals: z.array(
    z.object({
      category: z.string().describe("Risk category: financial, supply_chain, regulatory, litigation, environmental, safety, macro"),
      signal: z.string().describe("Concise description of the risk signal"),
      severity: z.enum(["low", "medium", "high", "critical"]),
      dataPoints: z.array(z.record(z.string(), z.unknown())).describe("Supporting data points"),
      reasoning: z.string().describe("Why this signal matters for supply chain risk"),
    }),
  ),
  relevantFinancials: z.record(z.string(), z.unknown()).describe("Key financial metrics worth modeling"),
  relevantNewsUrls: z.array(z.string()).describe("URLs of the most relevant news articles"),
  supplyChainInsights: z.array(z.string()).describe("Insights about tier 2/3 supply chain structure and risk"),
  recommendedForModel: z.boolean().describe("Whether this company's data should be passed to the covariance model"),
  evaluationSummary: z.string().describe("2-3 sentence summary of overall risk posture"),
});

// ---------------------------------------------------------------------------
// Evaluate aggregated data
// ---------------------------------------------------------------------------

export async function evaluateCompanyData(
  aggregated: AggregatedCompanyData,
): Promise<EvaluatedData> {
  const dataSnapshot = buildDataSnapshot(aggregated);

  const { object } = await generateObject({
    model: google("gemini-2.0-flash"),
    schema: EvaluationOutputSchema,
    system: SYSTEM_PROMPT,
    prompt: `Evaluate the following aggregated data for ${aggregated.company.ticker} (${aggregated.company.name ?? "unknown company"}) and identify meaningful risk signals for a supply chain covariance risk model.\n\n${dataSnapshot}`,
  });

  // Map relevant news URLs back to full article objects
  const newsArticles = aggregated.news.data ?? [];
  const relevantNews = newsArticles.filter((a) =>
    object.relevantNewsUrls.includes(a.url),
  );

  return {
    company: aggregated.company,
    riskSignals: object.riskSignals,
    relevantFinancials: object.relevantFinancials,
    relevantNews,
    supplyChainInsights: object.supplyChainInsights,
    recommendedForModel: object.recommendedForModel,
    evaluationSummary: object.evaluationSummary,
  };
}

// ---------------------------------------------------------------------------
// Evaluate a batch of companies
// ---------------------------------------------------------------------------

export async function evaluateBatch(
  aggregatedBatch: AggregatedCompanyData[],
): Promise<EvaluatedData[]> {
  // Process sequentially to respect rate limits
  const results: EvaluatedData[] = [];
  for (const aggregated of aggregatedBatch) {
    const evaluated = await evaluateCompanyData(aggregated);
    results.push(evaluated);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Build a compact text snapshot of the aggregated data for the LLM
// ---------------------------------------------------------------------------

function buildDataSnapshot(data: AggregatedCompanyData): string {
  const sections: string[] = [];

  // Company profile
  if (data.profile.success && data.profile.data) {
    const p = data.profile.data;
    sections.push(`## Company Profile
- Name: ${p.companyName}
- Sector: ${p.sector} | Industry: ${p.industry}
- Country: ${p.country} | Exchange: ${p.exchange}
- Market Cap: $${formatNumber(p.marketCap)}
- Employees: ${p.employees ?? "N/A"}
- Description: ${p.description.slice(0, 500)}`);
  }

  // Stock quote
  if (data.stockQuote.success && data.stockQuote.data) {
    const q = data.stockQuote.data;
    sections.push(`## Current Stock
- Price: $${q.price} | Change: ${q.changePercent}%
- Volume: ${formatNumber(q.volume)} | P/E: ${q.pe ?? "N/A"}`);
  }

  // Financial health
  if (data.financialHealth.success && data.financialHealth.data) {
    const h = data.financialHealth.data;
    sections.push(`## Financial Health
- Altman Z-Score: ${h.altmanZScore ?? "N/A"} (>2.99 safe, <1.81 distress)
- Piotroski Score: ${h.piotroskiScore ?? "N/A"} (0-9, higher is healthier)
- Debt/Equity: ${h.debtToEquity ?? "N/A"}
- Current Ratio: ${h.currentRatio ?? "N/A"}
- ROE: ${h.returnOnEquity ?? "N/A"} | ROA: ${h.returnOnAssets ?? "N/A"}`);
  }

  // Income statements (last 4 quarters)
  if (data.incomeStatements.success && data.incomeStatements.data?.length) {
    const stmts = data.incomeStatements.data.slice(0, 4);
    sections.push(`## Income Statements (Last ${stmts.length} Quarters)
${stmts.map((s) => `- ${s.date}: Revenue $${formatNumber(s.revenue)} | Net Income $${formatNumber(s.netIncome)} | Margin ${(s.netIncomeRatio * 100).toFixed(1)}%`).join("\n")}`);
  }

  // Balance sheets
  if (data.balanceSheets.success && data.balanceSheets.data?.length) {
    const bs = data.balanceSheets.data[0];
    sections.push(`## Latest Balance Sheet (${bs.date})
- Total Assets: $${formatNumber(bs.totalAssets)}
- Total Debt: $${formatNumber(bs.totalDebt)} | Net Debt: $${formatNumber(bs.netDebt)}
- Cash: $${formatNumber(bs.cashAndEquivalents)}
- Current Ratio: ${(bs.totalCurrentAssets / bs.totalCurrentLiabilities).toFixed(2)}`);
  }

  // SEC filings
  if (data.secFilings.success && data.secFilings.data?.length) {
    sections.push(`## Recent SEC Filings (${data.secFilings.data.length} total)
${data.secFilings.data.slice(0, 5).map((f) => `- ${f.filingDate}: ${f.form} - ${f.description}`).join("\n")}`);
  }

  // News
  if (data.news.success && data.news.data?.length) {
    sections.push(`## News Articles (${data.news.data.length} total)
${data.news.data.slice(0, 10).map((a) => `- [${a.publishedAt}] ${a.title} (${a.source}) URL: ${a.url}${a.description ? `\n  ${a.description.slice(0, 200)}` : ""}`).join("\n")}`);
  }

  // Macro indicators
  if (data.macroIndicators.success && data.macroIndicators.data?.length) {
    sections.push(`## Macro Indicators
${data.macroIndicators.data.map((m) => {
  const latest = m.observations[0];
  const prev = m.observations[Math.min(3, m.observations.length - 1)];
  return `- ${m.seriesName}: ${latest?.value ?? "N/A"} ${m.units}${prev ? ` (was ${prev.value} on ${prev.date})` : ""}`;
}).join("\n")}`);
  }

  // Environmental violations
  if (data.environmentalViolations.success && data.environmentalViolations.data?.length) {
    const viols = data.environmentalViolations.data;
    const totalPenalties = viols.reduce((sum, v) => sum + (v.penaltyAmount ?? 0), 0);
    sections.push(`## Environmental Violations (${viols.length} facilities)
- Total Penalties: $${formatNumber(totalPenalties)}
${viols.slice(0, 5).map((v) => `- ${v.facilityName} (${v.state}): ${v.violationType} | Status: ${v.complianceStatus} | Penalty: $${formatNumber(v.penaltyAmount ?? 0)}`).join("\n")}`);
  }

  // OSHA inspections
  if (data.oshaInspections.success && data.oshaInspections.data?.length) {
    const insp = data.oshaInspections.data;
    const totalPenalties = insp.reduce((sum, i) => sum + i.penaltyAmount, 0);
    sections.push(`## OSHA Inspections (${insp.length} total)
- Total Penalties: $${formatNumber(totalPenalties)}
${insp.slice(0, 5).map((i) => `- ${i.openDate}: ${i.establishmentName} (${i.siteState}) | Type: ${i.violationType ?? "N/A"} | Penalty: $${formatNumber(i.penaltyAmount)}`).join("\n")}`);
  }

  // Web research
  if (data.webResearch.success && data.webResearch.data?.length) {
    const allResults = data.webResearch.data.flatMap((wr) => wr.results);
    sections.push(`## Web Research (${allResults.length} results)
${allResults.slice(0, 5).map((r) => `- ${r.title}: ${r.content.slice(0, 300)}`).join("\n")}`);
  }

  // Report which sources failed
  const failures = Object.entries(data)
    .filter(([key, val]) => key !== "company" && typeof val === "object" && val !== null && "success" in val && !val.success)
    .map(([key, val]) => `- ${key}: ${(val as { error: string | null }).error}`);

  if (failures.length > 0) {
    sections.push(`## Data Source Failures\n${failures.join("\n")}`);
  }

  return sections.join("\n\n");
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
}
