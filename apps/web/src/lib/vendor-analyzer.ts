import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod/v4";
import type {
  AggregatedCompanyData,
  EvaluatedData,
  PartitionedVariables,
} from "@/lib/types/research";
import {
  computeRiskScores,
  type RiskScoreResult,
  type CategoryRiskScore,
} from "@/lib/risk-scorer";

// ---------------------------------------------------------------------------
// Types for the shaped responses matching API_SPEC.md
// ---------------------------------------------------------------------------

export interface VendorOverviewResponse {
  vendor_id: string;
  vendor_name: string;
  risk_distribution: { label: string; percentage: number }[];
  risk_level: string;
  resilience_rating: string;
  resilience_score: number;
  resilience_score_max: number;
  resilience_factors: { label: string; score: number }[];
  industry: {
    sector: string;
    sub_sector: string;
    hq_country: string;
    employee_count_range: string;
    revenue_range_usd: string;
    founded_year: number | null;
    description: string;
  };
  risk_trend_12m: { month: string; risk_score: number }[];
}

export interface DependencySupplierTier3 {
  id: string;
  name: string;
  sector: string;
  country: string;
  risk_level: string;
  criticality: string;
  dependency_type: string;
}

export interface DependencySupplierTier2 {
  id: string;
  name: string;
  sector: string;
  country: string;
  risk_level: string;
  criticality: string;
  dependency_type: string;
  tier3_suppliers: DependencySupplierTier3[];
}

export interface DependenciesResponse {
  vendor_id: string;
  summary: {
    tier2_count: number;
    tier3_count: number;
    countries_represented: number;
    sectors_represented: number;
    critical_dependency_count: number;
  };
  concentration_risks: {
    label: string;
    severity: string;
    description: string;
  }[];
  tier2_suppliers: DependencySupplierTier2[];
}

export interface RiskBreakdownCategory {
  id: string;
  label: string;
  risk_score: number;
  risk_level: string;
  resilience_score: number;
  description: string;
  sub_categories: {
    label: string;
    risk_score: number;
    description: string;
  }[];
}

export interface RiskBreakdownResponse {
  vendor_id: string;
  overall_risk_score: number;
  overall_risk_level: string;
  overall_resilience_score: number;
  categories: RiskBreakdownCategory[];
}

export interface ComparisonVendor {
  vendor_id: string;
  vendor_name: string;
  overall_risk_score: number;
  resilience_score: number;
  category_scores: { category: string; risk_score: number }[];
}

export interface ComparisonResponse {
  recommendation: {
    winner_vendor_id: string;
    winner_vendor_name: string;
    confidence: string;
    summary: string;
    reasons: string[];
  };
  vendors: ComparisonVendor[];
}

// ---------------------------------------------------------------------------
// Full analysis result stored per vendor
// ---------------------------------------------------------------------------

export interface VendorAnalysisResult {
  vendorId: string;
  vendorName: string;
  ticker: string;
  riskScores: RiskScoreResult;
  overview: VendorOverviewResponse;
  dependencies: DependenciesResponse;
  riskBreakdown: RiskBreakdownResponse;
  aggregated: AggregatedCompanyData;
  evaluated: EvaluatedData;
  partitioned: PartitionedVariables;
}

// ---------------------------------------------------------------------------
// Generate 12-month risk trend from historical prices
// ---------------------------------------------------------------------------

function generateRiskTrend(
  aggregated: AggregatedCompanyData,
  currentRisk: number,
): { month: string; risk_score: number }[] {
  const prices = aggregated.historicalPrices.data;
  const trend: { month: string; risk_score: number }[] = [];
  const now = new Date();

  if (prices && prices.length > 20) {
    // Group prices by month and compute monthly volatility-based risk proxy
    const monthlyPrices = new Map<string, number[]>();
    for (const p of prices) {
      const d = new Date(p.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyPrices.has(key)) monthlyPrices.set(key, []);
      monthlyPrices.get(key)!.push(p.close);
    }

    // Get last 12 months
    const sortedMonths = [...monthlyPrices.keys()].sort().slice(-12);

    for (const month of sortedMonths) {
      const closePrices = monthlyPrices.get(month)!;
      // Simple volatility-based risk proxy
      if (closePrices.length < 2) {
        trend.push({ month, risk_score: currentRisk });
        continue;
      }
      const returns: number[] = [];
      for (let i = 1; i < closePrices.length; i++) {
        if (closePrices[i - 1] > 0) {
          returns.push(Math.abs(closePrices[i] / closePrices[i - 1] - 1));
        }
      }
      const avgReturn = returns.length > 0
        ? returns.reduce((a, b) => a + b, 0) / returns.length
        : 0;
      // Scale: higher monthly vol = higher risk, anchored to current overall score
      const volRisk = Math.min(100, Math.round(currentRisk * 0.7 + avgReturn * 800));
      trend.push({ month, risk_score: clamp(volRisk) });
    }
  }

  // Pad to 12 months if needed
  while (trend.length < 12) {
    const monthsBack = 12 - trend.length;
    const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const jitter = Math.round((Math.random() - 0.5) * 10);
    trend.unshift({ month, risk_score: clamp(currentRisk + jitter) });
  }

  return trend.slice(-12);
}

// ---------------------------------------------------------------------------
// Format employee count range
// ---------------------------------------------------------------------------

function employeeRange(count: number | null): string {
  if (!count) return "Unknown";
  if (count < 100) return "1–100";
  if (count < 500) return "100–500";
  if (count < 1000) return "500–1,000";
  if (count < 5000) return "1,000–5,000";
  if (count < 10000) return "5,000–10,000";
  if (count < 50000) return "10,000–50,000";
  if (count < 100000) return "50,000–100,000";
  return "100,000+";
}

function revenueRange(marketCap: number | null): string {
  if (!marketCap) return "Unknown";
  // Rough revenue estimate from market cap (assuming ~3x revenue multiple)
  const estRevenue = marketCap / 3;
  if (estRevenue < 1e6) return "<1M";
  if (estRevenue < 10e6) return "1M–10M";
  if (estRevenue < 100e6) return "10M–100M";
  if (estRevenue < 1e9) return "100M–1B";
  if (estRevenue < 5e9) return "1B–5B";
  if (estRevenue < 10e9) return "5B–10B";
  if (estRevenue < 50e9) return "10B–50B";
  return "50B+";
}

// ---------------------------------------------------------------------------
// Build overview response
// ---------------------------------------------------------------------------

export function buildOverviewResponse(
  vendorId: string,
  vendorName: string,
  aggregated: AggregatedCompanyData,
  riskScores: RiskScoreResult,
): VendorOverviewResponse {
  const profile = aggregated.profile.data;
  const quote = aggregated.stockQuote.data;

  return {
    vendor_id: vendorId,
    vendor_name: vendorName,
    risk_distribution: riskScores.riskDistribution,
    risk_level: riskScores.overallRiskLevel,
    resilience_rating: riskScores.resilienceRating,
    resilience_score: riskScores.overallResilienceScore,
    resilience_score_max: 100,
    resilience_factors: riskScores.resilienceFactors,
    industry: {
      sector: profile?.sector ?? "Unknown",
      sub_sector: profile?.industry ?? "Unknown",
      hq_country: profile?.country ?? "Unknown",
      employee_count_range: employeeRange(profile?.employees ?? null),
      revenue_range_usd: revenueRange(quote?.marketCap ?? null),
      founded_year: null,
      description: profile?.description?.slice(0, 500) ?? "No description available.",
    },
    risk_trend_12m: generateRiskTrend(aggregated, riskScores.overallRiskScore),
  };
}

// ---------------------------------------------------------------------------
// Build risk breakdown response
// ---------------------------------------------------------------------------

export function buildRiskBreakdownResponse(
  vendorId: string,
  riskScores: RiskScoreResult,
  categoryDescriptions: CategoryDescriptionResult[],
): RiskBreakdownResponse {
  const categories: RiskBreakdownCategory[] = riskScores.categoryScores.map((cs) => {
    const desc = categoryDescriptions.find(
      (d) => d.categoryId === cs.category,
    );
    return {
      id: cs.category,
      label: cs.label,
      risk_score: cs.riskScore,
      risk_level: cs.riskLevel,
      resilience_score: cs.resilienceScore,
      description: desc?.description ?? `${cs.label} risk assessment based on available data.`,
      sub_categories: desc?.subCategories ?? [],
    };
  });

  return {
    vendor_id: vendorId,
    overall_risk_score: riskScores.overallRiskScore,
    overall_risk_level: riskScores.overallRiskLevel,
    overall_resilience_score: riskScores.overallResilienceScore,
    categories,
  };
}

// ---------------------------------------------------------------------------
// LLM pass: generate category descriptions and sub-categories
// ---------------------------------------------------------------------------

export interface CategoryDescriptionResult {
  categoryId: string;
  description: string;
  subCategories: { label: string; risk_score: number; description: string }[];
}

const CategoryDescriptionsSchema = z.object({
  categories: z.array(
    z.object({
      categoryId: z.enum(["financial", "operational", "geographical", "ethical"]),
      description: z.string().describe("2-3 sentence explanation of this risk category for this vendor"),
      subCategories: z.array(
        z.object({
          label: z.string().describe("Sub-category name, e.g. 'Debt-to-Equity Ratio', 'Trade Policy Exposure'"),
          riskScore: z.number().describe("Risk score 0-100 for this sub-category"),
          description: z.string().describe("One sentence explaining the risk"),
        }),
      ).min(2).max(5),
    }),
  ),
});

export async function generateCategoryDescriptions(
  aggregated: AggregatedCompanyData,
  evaluated: EvaluatedData,
  riskScores: RiskScoreResult,
): Promise<CategoryDescriptionResult[]> {
  const { object } = await generateObject({
    model: google("gemini-2.0-flash"),
    schema: CategoryDescriptionsSchema,
    system: `You are a supply chain risk analyst. Given a company's aggregated data, risk evaluation, and computed risk scores, generate detailed descriptions and sub-category breakdowns for each risk category. Each sub-category should have a specific risk score and description grounded in the data. Be specific and cite actual data points.`,
    prompt: `Company: ${aggregated.company.ticker} (${aggregated.company.name ?? "Unknown"})
Sector: ${aggregated.profile.data?.sector ?? "Unknown"}

Risk Scores:
${riskScores.categoryScores.map((cs) => `- ${cs.label}: ${cs.riskScore}/100 (${cs.riskLevel})`).join("\n")}

LLM Evaluation Summary: ${evaluated.evaluationSummary}

Risk Signals:
${evaluated.riskSignals.map((s) => `- [${s.severity}] ${s.category}: ${s.signal}`).join("\n")}

Supply Chain Insights:
${evaluated.supplyChainInsights.join("\n")}

Generate category descriptions and sub-categories for: financial, operational, geographical, ethical.
Each sub-category risk_score should be consistent with the parent category score.`,
  });

  return object.categories.map((c) => ({
    categoryId: c.categoryId,
    description: c.description,
    subCategories: c.subCategories.map((sc) => ({
      label: sc.label,
      risk_score: clamp(sc.riskScore),
      description: sc.description,
    })),
  }));
}

// ---------------------------------------------------------------------------
// LLM pass: generate dependency tree
// ---------------------------------------------------------------------------

const DependencyTreeSchema = z.object({
  summary: z.object({
    tier2Count: z.number(),
    tier3Count: z.number(),
    countriesRepresented: z.number(),
    sectorsRepresented: z.number(),
    criticalDependencyCount: z.number(),
  }),
  concentrationRisks: z.array(
    z.object({
      label: z.string(),
      severity: z.enum(["Low", "Moderate", "High", "Critical"]),
      description: z.string(),
    }),
  ),
  tier2Suppliers: z.array(
    z.object({
      name: z.string(),
      sector: z.string(),
      country: z.string(),
      riskLevel: z.enum(["Low", "Moderate", "High", "Critical"]),
      criticality: z.enum(["Low", "Moderate", "High", "Critical"]),
      dependencyType: z.string().describe("e.g. 'Raw Material', 'Component', 'Service', 'Logistics'"),
      tier3Suppliers: z.array(
        z.object({
          name: z.string(),
          sector: z.string(),
          country: z.string(),
          riskLevel: z.enum(["Low", "Moderate", "High", "Critical"]),
          criticality: z.enum(["Low", "Moderate", "High", "Critical"]),
          dependencyType: z.string(),
        }),
      ),
    }),
  ),
});

export async function generateDependencyTree(
  vendorId: string,
  aggregated: AggregatedCompanyData,
  evaluated: EvaluatedData,
): Promise<DependenciesResponse> {
  const { object } = await generateObject({
    model: google("gemini-2.0-flash"),
    schema: DependencyTreeSchema,
    system: `You are a supply chain analyst. Given a company's data and risk evaluation, generate a realistic tier 2 and tier 3 supply chain dependency tree. Use your knowledge of the company's industry, known suppliers, and supply chain structure. Include realistic supplier names, countries, sectors, and risk assessments. Generate 3-6 tier 2 suppliers, each with 1-3 tier 3 suppliers. Identify concentration risks based on geographic or sector clustering.`,
    prompt: `Company: ${aggregated.company.ticker} (${aggregated.company.name ?? "Unknown"})
Sector: ${aggregated.profile.data?.sector ?? "Unknown"}
Industry: ${aggregated.profile.data?.industry ?? "Unknown"}
Country: ${aggregated.profile.data?.country ?? "Unknown"}
Description: ${aggregated.profile.data?.description?.slice(0, 500) ?? "N/A"}

Supply Chain Insights from Risk Evaluation:
${evaluated.supplyChainInsights.join("\n") || "No specific insights available."}

Risk Signals:
${evaluated.riskSignals.filter((s) => s.category === "supply_chain").map((s) => `- [${s.severity}] ${s.signal}: ${s.reasoning}`).join("\n") || "No supply chain risk signals."}

Web Research:
${aggregated.webResearch.data?.flatMap((wr) => wr.results).slice(0, 3).map((r) => `- ${r.title}: ${r.content.slice(0, 200)}`).join("\n") || "No web research data."}

Generate a realistic supply chain dependency tree with tier 2 and tier 3 suppliers.`,
  });

  let nodeCounter = 1;

  return {
    vendor_id: vendorId,
    summary: {
      tier2_count: object.summary.tier2Count,
      tier3_count: object.summary.tier3Count,
      countries_represented: object.summary.countriesRepresented,
      sectors_represented: object.summary.sectorsRepresented,
      critical_dependency_count: object.summary.criticalDependencyCount,
    },
    concentration_risks: object.concentrationRisks.map((cr) => ({
      label: cr.label,
      severity: cr.severity,
      description: cr.description,
    })),
    tier2_suppliers: object.tier2Suppliers.map((t2) => {
      const t2Id = `n_${String(nodeCounter++).padStart(3, "0")}`;
      return {
        id: t2Id,
        name: t2.name,
        sector: t2.sector,
        country: t2.country,
        risk_level: t2.riskLevel,
        criticality: t2.criticality,
        dependency_type: t2.dependencyType,
        tier3_suppliers: t2.tier3Suppliers.map((t3) => ({
          id: `n_${String(nodeCounter++).padStart(3, "0")}`,
          name: t3.name,
          sector: t3.sector,
          country: t3.country,
          risk_level: t3.riskLevel,
          criticality: t3.criticality,
          dependency_type: t3.dependencyType,
        })),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// LLM pass: generate comparison
// ---------------------------------------------------------------------------

const ComparisonSchema = z.object({
  winnerIndex: z.number().describe("0-based index of the recommended vendor"),
  confidence: z.enum(["Low", "Moderate", "High"]),
  summary: z.string().describe("2-3 sentence recommendation summary"),
  reasons: z.array(z.string()).min(2).max(5),
});

export async function generateComparison(
  vendors: VendorAnalysisResult[],
): Promise<ComparisonResponse> {
  const vendorSummaries = vendors.map((v) => ({
    id: v.vendorId,
    name: v.vendorName,
    riskScore: v.riskScores.overallRiskScore,
    resilienceScore: v.riskScores.overallResilienceScore,
    categories: v.riskScores.categoryScores.map((cs) => ({
      label: cs.label,
      score: cs.riskScore,
    })),
    summary: v.evaluated.evaluationSummary,
  }));

  const { object } = await generateObject({
    model: google("gemini-2.0-flash"),
    schema: ComparisonSchema,
    system: `You are a supply chain risk analyst comparing vendors. Given multiple vendors with their risk scores and evaluations, recommend the best vendor (lowest risk, highest resilience) with specific data-backed reasons.`,
    prompt: `Compare these vendors and recommend the best one:

${vendorSummaries.map((v, i) => `Vendor ${i}: ${v.name} (${v.id})
  Overall Risk: ${v.riskScore}/100 | Resilience: ${v.resilienceScore}/100
  ${v.categories.map((c) => `${c.label}: ${c.score}/100`).join(", ")}
  Summary: ${v.summary}`).join("\n\n")}

Recommend the vendor with the lowest aggregate risk and strongest resilience. Provide specific, data-backed reasons.`,
  });

  const winnerIdx = Math.min(object.winnerIndex, vendors.length - 1);
  const winner = vendors[winnerIdx];

  return {
    recommendation: {
      winner_vendor_id: winner.vendorId,
      winner_vendor_name: winner.vendorName,
      confidence: object.confidence,
      summary: object.summary,
      reasons: object.reasons,
    },
    vendors: vendors.map((v) => ({
      vendor_id: v.vendorId,
      vendor_name: v.vendorName,
      overall_risk_score: v.riskScores.overallRiskScore,
      resilience_score: v.riskScores.overallResilienceScore,
      category_scores: v.riskScores.categoryScores.map((cs) => ({
        category: cs.label,
        risk_score: cs.riskScore,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Fallback comparison (when LLM is unavailable)
// ---------------------------------------------------------------------------

export function buildFallbackComparison(
  vendors: VendorAnalysisResult[],
): ComparisonResponse {
  // Pick winner by lowest overall risk score
  const sorted = [...vendors].sort(
    (a, b) => a.riskScores.overallRiskScore - b.riskScores.overallRiskScore,
  );
  const winner = sorted[0];

  const avgRisk = Math.round(
    vendors.reduce((s, v) => s + v.riskScores.overallRiskScore, 0) / vendors.length,
  );

  return {
    recommendation: {
      winner_vendor_id: winner.vendorId,
      winner_vendor_name: winner.vendorName,
      confidence: winner.riskScores.overallRiskScore < avgRisk - 10 ? "High" : "Moderate",
      summary: `${winner.vendorName} presents the lowest aggregate risk score (${winner.riskScores.overallRiskScore}/100) with a resilience rating of ${winner.riskScores.resilienceRating}.`,
      reasons: [
        `Lowest overall risk score: ${winner.riskScores.overallRiskScore}/100 vs peer average of ${avgRisk}/100`,
        `Resilience score of ${winner.riskScores.overallResilienceScore}/100 (${winner.riskScores.resilienceRating})`,
        ...winner.riskScores.categoryScores
          .filter((cs) => cs.riskScore < 50)
          .slice(0, 2)
          .map((cs) => `Strong ${cs.label.toLowerCase()} profile with risk score of ${cs.riskScore}/100`),
      ].slice(0, 5),
    },
    vendors: vendors.map((v) => ({
      vendor_id: v.vendorId,
      vendor_name: v.vendorName,
      overall_risk_score: v.riskScores.overallRiskScore,
      resilience_score: v.riskScores.overallResilienceScore,
      category_scores: v.riskScores.categoryScores.map((cs) => ({
        category: cs.label,
        risk_score: cs.riskScore,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Vendor name -> ticker resolution
//
// Strategy: try FMP stable search first, then fall back to LLM resolution.
// ---------------------------------------------------------------------------

const TickerResolutionSchema = z.object({
  ticker: z.string().describe("The stock ticker symbol on a major US exchange (NYSE, NASDAQ)"),
  companyName: z.string().describe("The full legal company name"),
  confidence: z.enum(["high", "medium", "low"]),
});

async function resolveFMP(vendorName: string): Promise<{ ticker: string; name: string } | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://financialmodelingprep.com/stable/search-name?query=${encodeURIComponent(vendorName)}&limit=10&apikey=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;

    const results = await resp.json() as { symbol: string; name: string; currency: string; exchangeShortName?: string; stockExchange?: string }[];
    if (!Array.isArray(results) || results.length === 0) return null;

    // Prefer US exchanges (USD currency or known US exchange names)
    const usResult = results.find((r) => {
      const exchange = (r.exchangeShortName ?? r.stockExchange ?? "").toUpperCase();
      return r.currency === "USD" || ["NYSE", "NASDAQ", "AMEX", "NMS", "NGM", "NCM"].includes(exchange);
    });
    const best = usResult ?? results[0];
    return { ticker: best.symbol, name: best.name };
  } catch {
    return null;
  }
}

async function resolveLLM(vendorName: string): Promise<{ ticker: string; name: string } | null> {
  try {
    const { object } = await generateObject({
      model: google("gemini-2.0-flash"),
      schema: TickerResolutionSchema,
      system: "You resolve company/vendor names to their stock ticker symbols. Only return tickers for publicly traded companies on major US exchanges (NYSE, NASDAQ). If the company is not publicly traded or you are unsure, return confidence 'low'.",
      prompt: `What is the stock ticker for "${vendorName}"?`,
    });

    if (object.confidence === "low") return null;
    return { ticker: object.ticker, name: object.companyName };
  } catch {
    return null;
  }
}

export async function resolveVendorTicker(vendorName: string): Promise<{ ticker: string; name: string } | null> {
  // Try FMP search first
  const fmpResult = await resolveFMP(vendorName);
  if (fmpResult) return fmpResult;

  // Fall back to LLM resolution
  return resolveLLM(vendorName);
}

// ---------------------------------------------------------------------------
// Fallback generators (when LLM is unavailable)
// ---------------------------------------------------------------------------

export function buildFallbackCategoryDescriptions(
  riskScores: RiskScoreResult,
): CategoryDescriptionResult[] {
  const descriptions: Record<string, { desc: string; subs: { label: string; desc: string }[] }> = {
    financial: {
      desc: "Financial risk assessment based on market data, health scores, and cost indicators.",
      subs: [
        { label: "Debt & Leverage", desc: "Assessed from debt-to-equity and current ratio metrics." },
        { label: "Profitability", desc: "Evaluated using return on equity and return on assets." },
        { label: "Market Volatility", desc: "Measured from historical price volatility." },
      ],
    },
    operational: {
      desc: "Operational risk covering supply chain complexity, labor factors, and throughput indicators.",
      subs: [
        { label: "Supply Chain Pressure", desc: "Global supply chain pressure index and delivery metrics." },
        { label: "Workforce Stability", desc: "Employee count and labor market signals." },
        { label: "Operational Activity", desc: "SEC filing and news volume as activity proxies." },
      ],
    },
    geographical: {
      desc: "Geographic risk based on facility distribution, trade exposure, and regional concentration.",
      subs: [
        { label: "Geographic Concentration", desc: "Degree of facility concentration in single regions." },
        { label: "Trade Exposure", desc: "Assessed from trade balance and import/export data." },
      ],
    },
    ethical: {
      desc: "Regulatory and ethical risk from environmental violations, compliance, and litigation signals.",
      subs: [
        { label: "Environmental Compliance", desc: "Environmental violation count and penalty amounts." },
        { label: "Regulatory Risk", desc: "Regulatory and litigation signal assessment." },
        { label: "Safety Record", desc: "Workplace safety and OSHA compliance signals." },
      ],
    },
  };

  return riskScores.categoryScores.map((cs) => {
    const info = descriptions[cs.category] ?? {
      desc: `${cs.label} risk assessment.`,
      subs: [{ label: "General", desc: "Assessment based on available data." }],
    };
    return {
      categoryId: cs.category,
      description: info.desc,
      subCategories: info.subs.map((s) => ({
        label: s.label,
        risk_score: clamp(cs.riskScore + Math.round((Math.random() - 0.5) * 15)),
        description: s.desc,
      })),
    };
  });
}

export function buildFallbackDependencies(
  vendorId: string,
  aggregated: AggregatedCompanyData,
): DependenciesResponse {
  const sector = aggregated.profile.data?.sector ?? "Unknown";
  const country = aggregated.profile.data?.country ?? "US";

  return {
    vendor_id: vendorId,
    summary: {
      tier2_count: 3,
      tier3_count: 5,
      countries_represented: 3,
      sectors_represented: 2,
      critical_dependency_count: 1,
    },
    concentration_risks: [
      {
        label: "Limited data availability",
        severity: "Moderate",
        description: "Dependency analysis is limited due to unavailable LLM evaluation. Data shown is estimated based on industry norms.",
      },
    ],
    tier2_suppliers: [
      {
        id: "n_001",
        name: `${sector} Component Supplier A`,
        sector: "Components",
        country,
        risk_level: "Moderate",
        criticality: "High",
        dependency_type: "Component",
        tier3_suppliers: [
          {
            id: "n_004",
            name: "Raw Material Provider A",
            sector: "Raw Materials",
            country: "China",
            risk_level: "Moderate",
            criticality: "Moderate",
            dependency_type: "Raw Material",
          },
        ],
      },
      {
        id: "n_002",
        name: `${sector} Service Provider B`,
        sector: "Services",
        country: "United States",
        risk_level: "Low",
        criticality: "Moderate",
        dependency_type: "Service",
        tier3_suppliers: [
          {
            id: "n_005",
            name: "Cloud Infrastructure Provider",
            sector: "Technology",
            country: "United States",
            risk_level: "Low",
            criticality: "High",
            dependency_type: "Service",
          },
        ],
      },
      {
        id: "n_003",
        name: "Logistics Partner C",
        sector: "Transportation",
        country: "Germany",
        risk_level: "Low",
        criticality: "Moderate",
        dependency_type: "Logistics",
        tier3_suppliers: [],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
