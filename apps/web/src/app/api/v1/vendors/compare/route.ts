import { NextRequest } from "next/server";
import { getMultipleVendorResults } from "@/lib/vendor-store";
import {
  generateComparison,
  buildFallbackComparison,
} from "@/lib/vendor-analyzer";
import {
  jsonResponse,
  errorResponse,
  optionsResponse,
} from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");

  if (!idsParam) {
    return errorResponse(
      "INVALID_IDS",
      "Query parameter 'ids' is required (comma-separated vendor IDs).",
      400,
    );
  }

  const vendorIds = idsParam.split(",").map((id) => id.trim()).filter(Boolean);

  if (vendorIds.length < 2) {
    return errorResponse(
      "INVALID_IDS",
      "At least 2 vendor IDs are required for comparison.",
      400,
    );
  }

  const results = getMultipleVendorResults(vendorIds);
  const missing = vendorIds.filter((_, i) => results[i] === null);

  if (missing.length > 0) {
    return errorResponse(
      "INVALID_IDS",
      `Vendor IDs not found or not yet complete: ${missing.join(", ")}`,
      400,
    );
  }

  const validResults = results.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  try {
    const comparison = await generateComparison(validResults);
    return jsonResponse(comparison);
  } catch (err) {
    console.warn("[vendors/compare] LLM comparison failed, using fallback:", (err as Error).message.slice(0, 200));
    const comparison = buildFallbackComparison(validResults);
    return jsonResponse(comparison);
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
