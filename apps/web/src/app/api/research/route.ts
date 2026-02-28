import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { aggregateCompanyData, aggregateBatch } from "@/lib/aggregator";
import { evaluateCompanyData, evaluateBatch } from "@/lib/evaluator";
import { CompanyIdentifierSchema } from "@/lib/types/research";

const RequestSchema = z.object({
  companies: z.array(CompanyIdentifierSchema).min(1).max(10),
  skipEvaluation: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.message },
        { status: 400 },
      );
    }

    const { companies, skipEvaluation } = parsed.data;

    // Aggregate data from all sources
    const aggregated = companies.length === 1
      ? [await aggregateCompanyData(companies[0])]
      : await aggregateBatch(companies);

    // Optionally skip LLM evaluation (return raw aggregated data)
    if (skipEvaluation) {
      return NextResponse.json({
        status: "success",
        pipeline: "aggregate-only",
        results: aggregated,
      });
    }

    // Run LLM evaluation pass
    const evaluated = companies.length === 1
      ? [await evaluateCompanyData(aggregated[0])]
      : await evaluateBatch(aggregated);

    return NextResponse.json({
      status: "success",
      pipeline: "aggregate-and-evaluate",
      results: evaluated,
      aggregatedData: aggregated,
    });
  } catch (err) {
    console.error("[research-api]", err);
    return NextResponse.json(
      { error: "Internal server error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
