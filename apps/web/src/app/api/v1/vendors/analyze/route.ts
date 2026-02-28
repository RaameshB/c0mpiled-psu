import { NextRequest, after } from "next/server";
import { z } from "zod/v4";
import { triggerAnalysis } from "@/lib/vendor-store";
import {
  jsonResponse,
  errorResponse,
  optionsResponse,
} from "@/lib/api-helpers";

export const maxDuration = 60;

const AnalyzeRequestSchema = z.object({
  vendor_name: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AnalyzeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "ANALYSIS_FAILED",
        "Invalid request: vendor_name is required.",
        422,
      );
    }

    const { vendorId, vendorName, status, estimatedCompletionSeconds, pipelinePromise } =
      triggerAnalysis(parsed.data.vendor_name);

    // Keep the serverless function alive until the pipeline completes
    after(async () => {
      await pipelinePromise;
    });

    return jsonResponse(
      {
        vendor_id: vendorId,
        vendor_name: vendorName,
        status,
        estimated_completion_seconds: estimatedCompletionSeconds,
      },
      202,
    );
  } catch (err) {
    console.error("[vendors/analyze]", err);
    return errorResponse(
      "ANALYSIS_FAILED",
      (err as Error).message,
      422,
    );
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
