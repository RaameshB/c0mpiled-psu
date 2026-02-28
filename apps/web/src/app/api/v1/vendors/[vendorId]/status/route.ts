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

  return jsonResponse({
    vendor_id: vendor.vendorId,
    status: vendor.status,
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
