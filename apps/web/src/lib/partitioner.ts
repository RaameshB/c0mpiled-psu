import type {
  AggregatedCompanyData,
  EvaluatedData,
  PartitionedVariable,
  PartitionedVariables,
  VariableCategory,
  IndustrySector,
} from "@/lib/types/research";
import { INDUSTRY_SECTORS } from "@/lib/types/research";

// ---------------------------------------------------------------------------
// Sector mapping -- resolve profile sector string to canonical IndustrySector
// ---------------------------------------------------------------------------

const SECTOR_ALIASES: Record<string, IndustrySector> = {
  "technology": "Technology",
  "information technology": "Technology",
  "tech": "Technology",
  "software": "Technology",
  "communication services": "Telecommunications",
  "telecommunications": "Telecommunications",
  "telecom": "Telecommunications",
  "healthcare": "Healthcare",
  "health care": "Healthcare",
  "pharmaceuticals": "Healthcare",
  "biotech": "Healthcare",
  "biotechnology": "Healthcare",
  "financial services": "Finance",
  "financials": "Finance",
  "finance": "Finance",
  "banking": "Finance",
  "insurance": "Finance",
  "energy": "Energy",
  "oil & gas": "Energy",
  "oil and gas": "Energy",
  "renewable energy": "Energy",
  "basic materials": "Natural Resources",
  "materials": "Natural Resources",
  "mining": "Natural Resources",
  "metals": "Natural Resources",
  "natural resources": "Natural Resources",
  "industrials": "Industrials",
  "industrial": "Industrials",
  "manufacturing": "Industrials",
  "construction": "Industrials",
  "aerospace": "Industrials",
  "consumer cyclical": "Consumer Discretionary",
  "consumer discretionary": "Consumer Discretionary",
  "retail": "Consumer Discretionary",
  "automotive": "Consumer Discretionary",
  "consumer defensive": "Consumer Staples",
  "consumer staples": "Consumer Staples",
  "food & beverage": "Consumer Staples",
  "utilities": "Utilities",
  "real estate": "Real Estate",
  "reit": "Real Estate",
  "transportation": "Transportation",
  "logistics": "Transportation",
  "airlines": "Transportation",
  "shipping": "Transportation",
  "agriculture": "Agriculture",
  "farming": "Agriculture",
  "defense": "Defense",
  "military": "Defense",
  "aerospace & defense": "Defense",
};

function resolveIndustry(sectorRaw: string | undefined): IndustrySector {
  if (!sectorRaw || sectorRaw === "Unknown") return "Unknown";
  const normalized = sectorRaw.toLowerCase().trim();
  if (SECTOR_ALIASES[normalized]) return SECTOR_ALIASES[normalized];

  // Fuzzy match: check if any alias is a substring
  for (const [alias, sector] of Object.entries(SECTOR_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) return sector;
  }

  // Check if the raw value itself is a valid sector
  const directMatch = INDUSTRY_SECTORS.find(
    (s) => s.toLowerCase() === normalized,
  );
  if (directMatch) return directMatch;

  return "Unknown";
}

// ---------------------------------------------------------------------------
// Severity ordinal mapping
// ---------------------------------------------------------------------------

const SEVERITY_SCORE: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ---------------------------------------------------------------------------
// Variable builder helper
// ---------------------------------------------------------------------------

function variable(
  name: string,
  value: number | null | undefined,
  category: VariableCategory,
  industry: IndustrySector,
): PartitionedVariable | null {
  if (value === null || value === undefined || !isFinite(value)) return null;
  return { name, value, category, industry };
}

function collect(
  ...maybeVars: (PartitionedVariable | null)[]
): PartitionedVariable[] {
  return maybeVars.filter((v): v is PartitionedVariable => v !== null);
}

// ---------------------------------------------------------------------------
// Macro series category assignments
// ---------------------------------------------------------------------------

type MacroMapping = { category: VariableCategory; displayName: string };

const MACRO_SERIES_CATEGORY: Record<string, MacroMapping> = {
  // Financial -- price/cost signals that directly affect margins & valuation
  DCOILWTICO: { category: "financial", displayName: "crude_oil_wti_price" },
  PCUOMFG: { category: "financial", displayName: "ppi_manufacturing" },
  PPIACO: { category: "financial", displayName: "ppi_all_commodities" },

  // Operational -- supply chain throughput, labor, inventory, deliveries
  GSCPI: { category: "operational", displayName: "global_supply_chain_pressure_index" },
  MANEMP: { category: "operational", displayName: "manufacturing_employment" },
  NAPMII: { category: "operational", displayName: "ism_inventories_index" },
  NAPMSDI: { category: "operational", displayName: "ism_supplier_deliveries_index" },
  TOTALSA: { category: "operational", displayName: "total_vehicle_sales" },

  // Geographical -- trade balance captures import/export geographic exposure
  BOPGSTB: { category: "geographical", displayName: "trade_balance_goods_services" },
};

// ---------------------------------------------------------------------------
// Compute derived metrics from historical prices
// ---------------------------------------------------------------------------

function computeHistoricalVolatility(
  prices: { close: number }[] | null | undefined,
): number | null {
  if (!prices || prices.length < 10) return null;
  const returns: number[] = [];
  for (let i = 1; i < Math.min(prices.length, 253); i++) {
    if (prices[i - 1].close === 0) continue;
    returns.push(
      Math.log(prices[i].close / prices[i - 1].close),
    );
  }
  if (returns.length < 5) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  // Annualize: multiply daily std dev by sqrt(252)
  return Math.sqrt(variance) * Math.sqrt(252);
}

// ---------------------------------------------------------------------------
// Main partitioner
// ---------------------------------------------------------------------------

export function partitionVariables(
  aggregated: AggregatedCompanyData,
  evaluated: EvaluatedData | null,
): PartitionedVariables {
  const industry = resolveIndustry(aggregated.profile.data?.sector);

  const financial = extractFinancialVariables(aggregated, evaluated, industry);
  const operational = extractOperationalVariables(aggregated, evaluated, industry);
  const geographical = extractGeographicalVariables(aggregated, evaluated, industry);
  const ethical = extractEthicalVariables(aggregated, evaluated, industry);

  return {
    company: aggregated.company,
    industry,
    financial,
    operational,
    geographical,
    ethical,
  };
}

// ---------------------------------------------------------------------------
// Financial variables: market data, health scores, cost indicators
// ---------------------------------------------------------------------------

function extractFinancialVariables(
  data: AggregatedCompanyData,
  evaluated: EvaluatedData | null,
  industry: IndustrySector,
): PartitionedVariable[] {
  const quote = data.stockQuote.data;
  const health = data.financialHealth.data;

  const vars = collect(
    // Market snapshot
    variable("stock_price", quote?.price, "financial", industry),
    variable("price_change_pct", quote?.changePercent, "financial", industry),
    variable("trading_volume", quote?.volume, "financial", industry),
    variable("market_cap", quote?.marketCap, "financial", industry),
    variable("pe_ratio", quote?.pe, "financial", industry),

    // Financial health scores
    variable("altman_z_score", health?.altmanZScore, "financial", industry),
    variable("piotroski_score", health?.piotroskiScore, "financial", industry),
    variable("debt_to_equity", health?.debtToEquity, "financial", industry),
    variable("current_ratio", health?.currentRatio, "financial", industry),
    variable("quick_ratio", health?.quickRatio, "financial", industry),
    variable("return_on_equity", health?.returnOnEquity, "financial", industry),
    variable("return_on_assets", health?.returnOnAssets, "financial", industry),

    // Derived: annualized volatility from historical prices
    variable(
      "annualized_volatility",
      computeHistoricalVolatility(data.historicalPrices.data),
      "financial",
      industry,
    ),
  );

  // Financial risk signals from evaluation
  if (evaluated) {
    const financialSignals = evaluated.riskSignals.filter(
      (s) => s.category === "financial",
    );
    const aggregateSeverity = financialSignals.reduce(
      (sum, s) => sum + (SEVERITY_SCORE[s.severity] ?? 0),
      0,
    );
    vars.push(
      ...collect(
        variable("financial_risk_signal_count", financialSignals.length, "financial", industry),
        variable("financial_risk_severity_score", aggregateSeverity, "financial", industry),
      ),
    );
  }

  // Macro series tagged as financial
  appendMacroVariables(data, vars, "financial", industry);

  return vars;
}

// ---------------------------------------------------------------------------
// Operational variables: supply chain, labor, inventory, throughput
// ---------------------------------------------------------------------------

function extractOperationalVariables(
  data: AggregatedCompanyData,
  evaluated: EvaluatedData | null,
  industry: IndustrySector,
): PartitionedVariable[] {
  const vars = collect(
    variable("employee_count", data.profile.data?.employees, "operational", industry),
  );

  // Supply chain risk signals
  if (evaluated) {
    const supplyChainSignals = evaluated.riskSignals.filter(
      (s) => s.category === "supply_chain",
    );
    const aggregateSeverity = supplyChainSignals.reduce(
      (sum, s) => sum + (SEVERITY_SCORE[s.severity] ?? 0),
      0,
    );
    vars.push(
      ...collect(
        variable("supply_chain_risk_signal_count", supplyChainSignals.length, "operational", industry),
        variable("supply_chain_risk_severity_score", aggregateSeverity, "operational", industry),
        variable("supply_chain_insight_count", evaluated.supplyChainInsights.length, "operational", industry),
      ),
    );
  }

  // SEC filing volume as operational activity indicator
  if (data.secFilings.data) {
    vars.push(
      ...collect(
        variable("sec_filing_count", data.secFilings.data.length, "operational", industry),
      ),
    );
  }

  // News volume as operational signal
  if (data.news.data) {
    vars.push(
      ...collect(
        variable("news_article_count", data.news.data.length, "operational", industry),
      ),
    );
  }

  // Macro series tagged as operational
  appendMacroVariables(data, vars, "operational", industry);

  return vars;
}

// ---------------------------------------------------------------------------
// Geographical variables: trade exposure, facility distribution
// ---------------------------------------------------------------------------

function extractGeographicalVariables(
  data: AggregatedCompanyData,
  _evaluated: EvaluatedData | null,
  industry: IndustrySector,
): PartitionedVariable[] {
  const vars: PartitionedVariable[] = [];

  // Environmental facility geographic spread
  const violations = data.environmentalViolations.data;
  if (violations && violations.length > 0) {
    const distinctStates = new Set(
      violations.map((v) => v.state).filter((s) => s !== "Unknown"),
    );
    vars.push(
      ...collect(
        variable("facility_state_count", distinctStates.size, "geographical", industry),
        variable("facility_count", violations.length, "geographical", industry),
      ),
    );

    // Geographic concentration: max facilities in a single state / total
    const stateCounts = new Map<string, number>();
    for (const v of violations) {
      if (v.state === "Unknown") continue;
      stateCounts.set(v.state, (stateCounts.get(v.state) ?? 0) + 1);
    }
    const maxInSingleState = Math.max(...stateCounts.values(), 0);
    const totalFacilities = [...stateCounts.values()].reduce((a, b) => a + b, 0);
    if (totalFacilities > 0) {
      vars.push(
        ...collect(
          variable(
            "geographic_concentration_ratio",
            maxInSingleState / totalFacilities,
            "geographical",
            industry,
          ),
        ),
      );
    }
  }

  // Macro series tagged as geographical
  appendMacroVariables(data, vars, "geographical", industry);

  return vars;
}

// ---------------------------------------------------------------------------
// Ethical variables: environmental, safety, regulatory, litigation
// ---------------------------------------------------------------------------

function extractEthicalVariables(
  data: AggregatedCompanyData,
  evaluated: EvaluatedData | null,
  industry: IndustrySector,
): PartitionedVariable[] {
  const vars: PartitionedVariable[] = [];

  // Environmental violations
  const violations = data.environmentalViolations.data;
  if (violations) {
    const totalPenalties = violations.reduce(
      (sum, v) => sum + (v.penaltyAmount ?? 0),
      0,
    );
    vars.push(
      ...collect(
        variable("environmental_violation_count", violations.length, "ethical", industry),
        variable("environmental_total_penalties", totalPenalties, "ethical", industry),
      ),
    );
  }

  // Risk signals from ethical-adjacent categories
  if (evaluated) {
    const ethicalCategories = [
      "regulatory",
      "litigation",
      "environmental",
      "safety",
    ];
    for (const cat of ethicalCategories) {
      const signals = evaluated.riskSignals.filter((s) => s.category === cat);
      const aggregateSeverity = signals.reduce(
        (sum, s) => sum + (SEVERITY_SCORE[s.severity] ?? 0),
        0,
      );
      vars.push(
        ...collect(
          variable(`${cat}_risk_signal_count`, signals.length, "ethical", industry),
          variable(`${cat}_risk_severity_score`, aggregateSeverity, "ethical", industry),
        ),
      );
    }
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Append macro indicator variables for a specific category
// ---------------------------------------------------------------------------

function appendMacroVariables(
  data: AggregatedCompanyData,
  vars: PartitionedVariable[],
  category: VariableCategory,
  industry: IndustrySector,
): void {
  const indicators = data.macroIndicators.data;
  if (!indicators) return;

  for (const indicator of indicators) {
    const mapping = MACRO_SERIES_CATEGORY[indicator.seriesId];
    if (!mapping || mapping.category !== category) continue;

    const latest = indicator.observations[0];
    if (!latest || latest.value === null) continue;

    vars.push(
      ...collect(
        variable(mapping.displayName, latest.value, category, industry),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Batch partitioning
// ---------------------------------------------------------------------------

export function partitionBatch(
  aggregatedBatch: AggregatedCompanyData[],
  evaluatedBatch: EvaluatedData[] | null,
): PartitionedVariables[] {
  return aggregatedBatch.map((aggregated, i) =>
    partitionVariables(aggregated, evaluatedBatch?.[i] ?? null),
  );
}
