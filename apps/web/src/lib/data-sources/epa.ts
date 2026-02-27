import {
  EnvironmentalViolationSchema,
  safeParseArray,
  sourceSuccess,
  sourceError,
  type EnvironmentalViolation,
  type DataSourceResult,
} from "@/lib/types/research";

const ECHO_BASE = "https://echo.epa.gov/api";

async function echoFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${ECHO_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("output", "JSON");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`EPA ECHO ${path} returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Search facilities by company name
// ---------------------------------------------------------------------------

interface EchoFacility {
  RegistryId: string;
  FacName: string;
  FacState: string;
  FacComplianceStatus: string;
  CurrVioStatus: string;
  FacProgramsWithViol: string;
  FacTotalPenalties: string;
}

interface EchoSearchResponse {
  Results?: {
    Facilities?: EchoFacility[];
    Message?: string;
  };
}

export async function fetchEnvironmentalViolations(
  companyName: string,
): Promise<DataSourceResult<EnvironmentalViolation[]>> {
  try {
    const raw = await echoFetch<EchoSearchResponse>("/echo_rest_services.get_facilities", {
      p_fn: companyName,
      p_act: "Y",
      p_ptype: "GEN",
    });

    const facilities = raw.Results?.Facilities ?? [];

    const violations: Record<string, unknown>[] = facilities
      .filter((f) => f.CurrVioStatus !== "No Violation")
      .map((f) => ({
        facilityName: f.FacName,
        facilityId: f.RegistryId,
        state: f.FacState,
        violationDate: null,
        violationType: f.CurrVioStatus,
        complianceStatus: f.FacComplianceStatus,
        penaltyAmount: f.FacTotalPenalties ? parseFloat(f.FacTotalPenalties) : null,
        programArea: f.FacProgramsWithViol ?? "Unknown",
      }));

    return sourceSuccess(
      "epa:violations",
      safeParseArray(EnvironmentalViolationSchema, violations),
    );
  } catch (err) {
    return sourceError("epa:violations", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Fetch detailed compliance history for a facility
// ---------------------------------------------------------------------------

interface EchoComplianceResponse {
  Results?: {
    CVRows?: Array<{
      FacName: string;
      RegistryId: string;
      State: string;
      ViolationDate: string;
      Agency: string;
      ProgramArea: string;
      ViolationType: string;
      PenaltyAmount: string;
      ComplianceStatus: string;
    }>;
  };
}

export async function fetchFacilityCompliance(
  registryId: string,
): Promise<DataSourceResult<EnvironmentalViolation[]>> {
  try {
    const raw = await echoFetch<EchoComplianceResponse>(
      "/echo_rest_services.get_qid",
      { p_id: registryId },
    );

    const rows = raw.Results?.CVRows ?? [];

    const violations: Record<string, unknown>[] = rows.map((r) => ({
      facilityName: r.FacName,
      facilityId: r.RegistryId,
      state: r.State,
      violationDate: r.ViolationDate ?? null,
      violationType: r.ViolationType,
      complianceStatus: r.ComplianceStatus,
      penaltyAmount: r.PenaltyAmount ? parseFloat(r.PenaltyAmount) : null,
      programArea: r.ProgramArea,
    }));

    return sourceSuccess(
      "epa:compliance",
      safeParseArray(EnvironmentalViolationSchema, violations),
    );
  } catch (err) {
    return sourceError("epa:compliance", (err as Error).message);
  }
}
