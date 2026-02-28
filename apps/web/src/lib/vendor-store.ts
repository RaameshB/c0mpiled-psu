import { aggregateCompanyData } from "@/lib/aggregator";
import { evaluateCompanyData } from "@/lib/evaluator";
import { partitionVariables } from "@/lib/partitioner";
import { computeRiskScores } from "@/lib/risk-scorer";
import type { EvaluatedData } from "@/lib/types/research";
import {
  resolveVendorTicker,
  buildOverviewResponse,
  buildRiskBreakdownResponse,
  generateCategoryDescriptions,
  generateDependencyTree,
  buildFallbackDependencies,
  buildFallbackCategoryDescriptions,
  type VendorAnalysisResult,
} from "@/lib/vendor-analyzer";

// ---------------------------------------------------------------------------
// In-memory vendor store
//
// Tracks vendor analysis lifecycle: processing -> complete | failed.
// On Vercel this lives in the serverless function's memory, which is
// sufficient for a hackathon demo. For production, swap with a database.
// ---------------------------------------------------------------------------

export type VendorStatus = "processing" | "complete" | "failed";

interface VendorEntry {
  vendorId: string;
  vendorName: string;
  status: VendorStatus;
  error: string | null;
  result: VendorAnalysisResult | null;
  createdAt: string;
  completedAt: string | null;
}

const store = new Map<string, VendorEntry>();

function generateVendorId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "vnd_";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getVendor(vendorId: string): VendorEntry | undefined {
  return store.get(vendorId);
}

export function getVendorResult(vendorId: string): VendorAnalysisResult | null {
  return store.get(vendorId)?.result ?? null;
}

export function getMultipleVendorResults(
  vendorIds: string[],
): (VendorAnalysisResult | null)[] {
  return vendorIds.map((id) => getVendorResult(id));
}

export function getAllVendorIds(): string[] {
  return [...store.keys()];
}

// ---------------------------------------------------------------------------
// Trigger analysis (returns immediately, runs in background)
// ---------------------------------------------------------------------------

export function triggerAnalysis(vendorName: string): {
  vendorId: string;
  vendorName: string;
  status: VendorStatus;
  estimatedCompletionSeconds: number;
} {
  const vendorId = generateVendorId();

  const entry: VendorEntry = {
    vendorId,
    vendorName,
    status: "processing",
    error: null,
    result: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  store.set(vendorId, entry);

  // Fire and forget -- run the full pipeline in the background
  runPipeline(vendorId, vendorName).catch((err) => {
    console.error(`[vendor-store] Pipeline failed for ${vendorId}:`, err);
    const existing = store.get(vendorId);
    if (existing) {
      existing.status = "failed";
      existing.error = (err as Error).message;
    }
  });

  return {
    vendorId,
    vendorName,
    status: "processing",
    estimatedCompletionSeconds: 15,
  };
}

// ---------------------------------------------------------------------------
// Full analysis pipeline
// ---------------------------------------------------------------------------

async function runPipeline(
  vendorId: string,
  vendorName: string,
): Promise<void> {
  const entry = store.get(vendorId);
  if (!entry) return;

  try {
    // Step 1: Resolve vendor name to ticker symbol
    const resolved = await resolveVendorTicker(vendorName);
    if (!resolved) {
      throw new Error(
        `Could not resolve vendor "${vendorName}" to a stock ticker. Try using the company's publicly traded name.`,
      );
    }

    const ticker = resolved.ticker;
    const companyName = resolved.name;
    console.log(`[vendor-store] Resolved "${vendorName}" -> ${ticker} (${companyName})`);

    // Step 2: Aggregate data from all sources
    const aggregated = await aggregateCompanyData({
      ticker,
      name: companyName,
    });
    console.log(`[vendor-store] Aggregation complete for ${ticker}`);

    // Step 3: LLM evaluation pass (graceful degradation if quota exceeded)
    let evaluated: EvaluatedData | null = null;
    try {
      evaluated = await evaluateCompanyData(aggregated);
      console.log(`[vendor-store] LLM evaluation complete for ${ticker}`);
    } catch (evalErr) {
      console.warn(
        `[vendor-store] LLM evaluation failed for ${ticker}, continuing with data-only scoring:`,
        (evalErr as Error).message.slice(0, 200),
      );
    }

    // Step 4: Partition variables (works with or without evaluation)
    const partitioned = partitionVariables(aggregated, evaluated);

    // Step 5: Compute risk scores
    const riskScores = computeRiskScores(partitioned, evaluated);

    // Step 6: Build overview
    const overview = buildOverviewResponse(
      vendorId,
      vendorName,
      aggregated,
      riskScores,
    );

    // Step 7: Generate category descriptions (LLM, with fallback)
    let categoryDescriptions;
    try {
      if (!evaluated) throw new Error("No evaluation data available");
      categoryDescriptions = await generateCategoryDescriptions(
        aggregated,
        evaluated,
        riskScores,
      );
    } catch {
      console.warn(`[vendor-store] Category descriptions LLM failed, using fallback`);
      categoryDescriptions = buildFallbackCategoryDescriptions(riskScores);
    }

    // Step 8: Build risk breakdown
    const riskBreakdown = buildRiskBreakdownResponse(
      vendorId,
      riskScores,
      categoryDescriptions,
    );

    // Step 9: Generate dependency tree (LLM, with fallback)
    let dependencies;
    try {
      if (!evaluated) throw new Error("No evaluation data available");
      dependencies = await generateDependencyTree(
        vendorId,
        aggregated,
        evaluated,
      );
    } catch {
      console.warn(`[vendor-store] Dependency tree LLM failed, using fallback`);
      dependencies = buildFallbackDependencies(vendorId, aggregated);
    }

    // Build fallback evaluated data for the result if LLM was unavailable
    const evaluatedResult: EvaluatedData = evaluated ?? {
      company: aggregated.company,
      riskSignals: [],
      relevantFinancials: {},
      relevantNews: [],
      supplyChainInsights: ["LLM evaluation was unavailable. Risk scores are computed from quantitative data only."],
      recommendedForModel: true,
      evaluationSummary: `Data-only risk analysis for ${companyName}. LLM evaluation was skipped due to API quota limitations.`,
    };

    // Store the complete result
    entry.result = {
      vendorId,
      vendorName,
      ticker,
      riskScores,
      overview,
      dependencies,
      riskBreakdown,
      aggregated,
      evaluated: evaluatedResult,
      partitioned,
    };
    entry.status = "complete";
    entry.completedAt = new Date().toISOString();

    console.log(
      `[vendor-store] Analysis complete for ${vendorId} (${vendorName} -> ${ticker})`,
    );
  } catch (err) {
    entry.status = "failed";
    entry.error = (err as Error).message;
    entry.completedAt = new Date().toISOString();
    console.error(`[vendor-store] Analysis failed for ${vendorId}:`, err);
  }
}
