import { NextRequest } from "next/server";
import { getVendor } from "@/lib/vendor-store";
import {
  jsonResponse,
  errorResponse,
  optionsResponse,
} from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> },
) {
  const { vendorId } = await params;
  const vendor = getVendor(vendorId);

  if (!vendor) {
    return errorResponse(
      "VENDOR_NOT_FOUND",
      "No vendor found with the given identifier.",
      404,
    );
  }

  if (vendor.status === "processing") {
    return errorResponse(
      "STILL_PROCESSING",
      "Analysis is still in progress. Poll /status and retry.",
      202,
    );
  }

  if (vendor.status === "failed" || !vendor.result) {
    return errorResponse(
      "ANALYSIS_FAILED",
      vendor.error ?? "Analysis failed.",
      422,
    );
  }

  return jsonResponse(vendor.result.dependencies);
}

export async function OPTIONS() {
  return optionsResponse();
}
