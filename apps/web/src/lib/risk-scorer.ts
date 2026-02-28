import type {
  PartitionedVariables,
  PartitionedVariable,
  EvaluatedData,
  VariableCategory,
} from "@/lib/types/research";

// ---------------------------------------------------------------------------
// Risk scoring engine
//
// Transforms partitioned variables + LLM evaluation into quantitative risk
// scores (0-100, higher = more risk) and resilience ratings. This replaces the
// JAX covariance model with a deterministic scoring approach that uses known
// financial benchmarks and the LLM's severity assessments.
// ---------------------------------------------------------------------------

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical";
export type ResilienceRating = "Poor" | "Moderate" | "Strong" | "Excellent";

export interface CategoryRiskScore {
  category: VariableCategory;
  label: string;
  riskScore: number;
  resilienceScore: number;
  riskLevel: RiskLevel;
}

export interface RiskScoreResult {
  overallRiskScore: number;
  overallRiskLevel: RiskLevel;
  overallResilienceScore: number;
  resilienceRating: ResilienceRating;
  categoryScores: CategoryRiskScore[];
  riskDistribution: { label: string; percentage: number }[];
  resilienceFactors: { label: string; score: number }[];
}

// ---------------------------------------------------------------------------
// Thresholds and weights for known financial metrics
// ---------------------------------------------------------------------------

interface BenchmarkRule {
  variableName: string;
  riskFn: (value: number) => number;
}

const FINANCIAL_BENCHMARKS: BenchmarkRule[] = [
  {
    variableName: "altman_z_score",
    riskFn: (v) => {
      if (v > 2.99) return 15;
      if (v > 1.81) return 50;
      return 85;
    },
  },
  {
    variableName: "piotroski_score",
    riskFn: (v) => Math.max(0, Math.min(100, (9 - v) * 11)),
  },
  {
    variableName: "debt_to_equity",
    riskFn: (v) => {
      if (v < 0.5) return 15;
      if (v < 1.0) return 30;
      if (v < 2.0) return 55;
      if (v < 3.0) return 75;
      return 90;
    },
  },
  {
    variableName: "current_ratio",
    riskFn: (v) => {
      if (v > 2.0) return 10;
      if (v > 1.5) return 25;
      if (v > 1.0) return 50;
      return 80;
    },
  },
  {
    variableName: "quick_ratio",
    riskFn: (v) => {
      if (v > 1.5) return 10;
      if (v > 1.0) return 30;
      if (v > 0.5) return 60;
      return 85;
    },
  },
  {
    variableName: "annualized_volatility",
    riskFn: (v) => {
      if (v < 0.2) return 15;
      if (v < 0.35) return 35;
      if (v < 0.5) return 60;
      return 85;
    },
  },
  {
    variableName: "return_on_equity",
    riskFn: (v) => {
      if (v > 0.2) return 10;
      if (v > 0.1) return 25;
      if (v > 0) return 45;
      return 80;
    },
  },
  {
    variableName: "return_on_assets",
    riskFn: (v) => {
      if (v > 0.1) return 10;
      if (v > 0.05) return 30;
      if (v > 0) return 50;
      return 80;
    },
  },
  {
    variableName: "price_change_pct",
    riskFn: (v) => {
      const absChange = Math.abs(v);
      if (absChange < 2) return 15;
      if (absChange < 5) return 35;
      if (absChange < 10) return 60;
      return 80;
    },
  },
];

const OPERATIONAL_BENCHMARKS: BenchmarkRule[] = [
  {
    variableName: "supply_chain_risk_severity_score",
    riskFn: (v) => Math.min(100, v * 20),
  },
  {
    variableName: "supply_chain_risk_signal_count",
    riskFn: (v) => Math.min(100, v * 15),
  },
  {
    variableName: "global_supply_chain_pressure_index",
    riskFn: (v) => {
      // GSCPI: 0 = average, positive = pressure, negative = slack
      if (v < -0.5) return 15;
      if (v < 0.5) return 35;
      if (v < 1.5) return 60;
      return 85;
    },
  },
  {
    variableName: "ism_supplier_deliveries_index",
    riskFn: (v) => {
      // >50 = slower deliveries (more risk)
      if (v < 50) return 20;
      if (v < 55) return 40;
      if (v < 60) return 65;
      return 85;
    },
  },
];

const GEOGRAPHICAL_BENCHMARKS: BenchmarkRule[] = [
  {
    variableName: "geographic_concentration_ratio",
    riskFn: (v) => {
      // 1.0 = all in one state, lower = more diversified
      if (v < 0.3) return 15;
      if (v < 0.5) return 35;
      if (v < 0.7) return 60;
      return 85;
    },
  },
  {
    variableName: "facility_state_count",
    riskFn: (v) => {
      if (v > 10) return 15;
      if (v > 5) return 30;
      if (v > 2) return 50;
      return 75;
    },
  },
];

const ETHICAL_BENCHMARKS: BenchmarkRule[] = [
  {
    variableName: "environmental_violation_count",
    riskFn: (v) => {
      if (v === 0) return 10;
      if (v < 3) return 35;
      if (v < 10) return 60;
      return 85;
    },
  },
  {
    variableName: "environmental_total_penalties",
    riskFn: (v) => {
      if (v === 0) return 10;
      if (v < 50000) return 30;
      if (v < 500000) return 55;
      if (v < 5000000) return 75;
      return 90;
    },
  },
  {
    variableName: "regulatory_risk_severity_score",
    riskFn: (v) => Math.min(100, v * 18),
  },
  {
    variableName: "litigation_risk_severity_score",
    riskFn: (v) => Math.min(100, v * 18),
  },
  {
    variableName: "environmental_risk_severity_score",
    riskFn: (v) => Math.min(100, v * 18),
  },
  {
    variableName: "safety_risk_severity_score",
    riskFn: (v) => Math.min(100, v * 18),
  },
];

const BENCHMARKS_BY_CATEGORY: Record<VariableCategory, BenchmarkRule[]> = {
  financial: FINANCIAL_BENCHMARKS,
  operational: OPERATIONAL_BENCHMARKS,
  geographical: GEOGRAPHICAL_BENCHMARKS,
  ethical: ETHICAL_BENCHMARKS,
};

// ---------------------------------------------------------------------------
// Severity score from LLM evaluation
// ---------------------------------------------------------------------------

const SEVERITY_WEIGHT: Record<string, number> = {
  low: 10,
  medium: 30,
  high: 60,
  critical: 90,
};

function computeEvaluationRisk(
  evaluated: EvaluatedData | null,
  categoryFilter: string[],
): number {
  if (!evaluated) return 50;
  const signals = evaluated.riskSignals.filter((s) =>
    categoryFilter.includes(s.category),
  );
  if (signals.length === 0) return 35;
  const total = signals.reduce(
    (sum, s) => sum + (SEVERITY_WEIGHT[s.severity] ?? 30),
    0,
  );
  return Math.min(100, Math.round(total / signals.length + signals.length * 3));
}

// ---------------------------------------------------------------------------
// Score a single category
// ---------------------------------------------------------------------------

function scoreCategory(
  variables: PartitionedVariable[],
  benchmarks: BenchmarkRule[],
  evaluationRisk: number,
): number {
  const scores: number[] = [];

  for (const benchmark of benchmarks) {
    const variable = variables.find((v) => v.name === benchmark.variableName);
    if (variable) {
      scores.push(benchmark.riskFn(variable.value));
    }
  }

  // Blend benchmark-based scores with LLM evaluation signal
  if (scores.length === 0) return evaluationRisk;
  const benchmarkAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
  // 60% benchmarks, 40% LLM evaluation
  return Math.round(benchmarkAvg * 0.6 + evaluationRisk * 0.4);
}

// ---------------------------------------------------------------------------
// Category label mapping
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<VariableCategory, string> = {
  financial: "Financial",
  operational: "Operational",
  geographical: "Geopolitical",
  ethical: "Regulatory & Ethical",
};

const CATEGORY_EVAL_FILTERS: Record<VariableCategory, string[]> = {
  financial: ["financial", "macro"],
  operational: ["supply_chain"],
  geographical: ["supply_chain", "macro"],
  ethical: ["regulatory", "litigation", "environmental", "safety"],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeRiskScores(
  partitioned: PartitionedVariables,
  evaluated: EvaluatedData | null,
): RiskScoreResult {
  const categories: VariableCategory[] = [
    "financial",
    "operational",
    "geographical",
    "ethical",
  ];

  const categoryScores: CategoryRiskScore[] = categories.map((cat) => {
    const evalRisk = computeEvaluationRisk(
      evaluated,
      CATEGORY_EVAL_FILTERS[cat],
    );
    const riskScore = scoreCategory(
      partitioned[cat],
      BENCHMARKS_BY_CATEGORY[cat],
      evalRisk,
    );
    const resilienceScore = Math.max(0, Math.min(100, 100 - riskScore + randomJitter(8)));

    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      riskScore: clamp(riskScore),
      resilienceScore: clamp(resilienceScore),
      riskLevel: riskLevelFromScore(riskScore),
    };
  });

  // Overall: weighted average (financial gets more weight)
  const weights = { financial: 0.35, operational: 0.25, geographical: 0.2, ethical: 0.2 };
  const overallRiskScore = Math.round(
    categoryScores.reduce(
      (sum, cs) => sum + cs.riskScore * weights[cs.category],
      0,
    ),
  );
  const overallResilienceScore = Math.round(
    categoryScores.reduce(
      (sum, cs) => sum + cs.resilienceScore * weights[cs.category],
      0,
    ),
  );

  // Risk distribution: normalize category scores to percentages
  const totalRisk = categoryScores.reduce((s, c) => s + c.riskScore, 0);
  const riskDistribution = categoryScores.map((cs) => ({
    label: cs.label,
    percentage: totalRisk > 0
      ? Math.round((cs.riskScore / totalRisk) * 1000) / 10
      : 25,
  }));

  // Resilience factors
  const resilienceFactors = [
    {
      label: "Geographic Diversification",
      score: categoryScores.find((c) => c.category === "geographical")
        ?.resilienceScore ?? 50,
    },
    {
      label: "Financial Stability",
      score: categoryScores.find((c) => c.category === "financial")
        ?.resilienceScore ?? 50,
    },
    {
      label: "Operational Redundancy",
      score: categoryScores.find((c) => c.category === "operational")
        ?.resilienceScore ?? 50,
    },
  ];

  return {
    overallRiskScore: clamp(overallRiskScore),
    overallRiskLevel: riskLevelFromScore(overallRiskScore),
    overallResilienceScore: clamp(overallResilienceScore),
    resilienceRating: resilienceRatingFromScore(overallResilienceScore),
    categoryScores,
    riskDistribution,
    resilienceFactors,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskLevelFromScore(score: number): RiskLevel {
  if (score < 30) return "Low";
  if (score < 55) return "Moderate";
  if (score < 75) return "High";
  return "Critical";
}

function resilienceRatingFromScore(score: number): ResilienceRating {
  if (score < 30) return "Poor";
  if (score < 55) return "Moderate";
  if (score < 75) return "Strong";
  return "Excellent";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function randomJitter(range: number): number {
  return (Math.random() - 0.5) * range;
}
