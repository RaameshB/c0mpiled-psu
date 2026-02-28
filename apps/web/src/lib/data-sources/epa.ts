import {
  EnvironmentalViolationSchema,
  safeParseArray,
  sourceSuccess,
  sourceError,
  type EnvironmentalViolation,
  type DataSourceResult,
} from "@/lib/types/research";

const ECHO_BASE = "https://echodata.epa.gov/echo";

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
// EPA ECHO returns summary-level compliance data from get_facilities:
//   QueryRows, CVRows (violations), FEARows (formal enforcement),
//   INSPRows (inspections), TotalPenalties
//
// This is quantitative risk data that's directly usable by the model.
// ---------------------------------------------------------------------------

interface EchoSummaryResponse {
  Results?: {
    Message?: string;
    QueryRows?: number | string;
    CVRows?: number | string;
    V3Rows?: number | string;
    FEARows?: number | string;
    InfFEARows?: number | string;
    INSPRows?: number | string;
    TotalPenalties?: string;
    CAARows?: number | string;
    CWARows?: number | string;
    RCRRows?: number | string;
    TRIRows?: number | string;
    QueryID?: number | string;
  };
}

export async function fetchEnvironmentalViolations(
  companyName: string,
): Promise<DataSourceResult<EnvironmentalViolation[]>> {
  try {
    const raw = await echoFetch<EchoSummaryResponse>(
      "/echo_rest_services.get_facilities",
      { p_fn: companyName },
    );

    const r = raw.Results;
    if (!r || r.Message !== "Success") {
      return sourceError("epa:violations", r?.Message ?? "EPA search returned no results");
    }

    const totalFacilities = parseNumeric(r.QueryRows);
    const complianceViolations = parseNumeric(r.CVRows);
    const formalEnforcements = parseNumeric(r.FEARows);
    const informalEnforcements = parseNumeric(r.InfFEARows);
    const inspections = parseNumeric(r.INSPRows);
    const cleanAirViolations = parseNumeric(r.CAARows);
    const cleanWaterViolations = parseNumeric(r.CWARows);
    const rcraViolations = parseNumeric(r.RCRRows);
    const triReleases = parseNumeric(r.TRIRows);
    const totalPenalties = r.TotalPenalties
      ? parseFloat(r.TotalPenalties.replace(/[$,]/g, "")) || 0
      : 0;

    // Synthesize violation records from the summary counts.
    // Each program area gets a record if it has nonzero violations.
    const violations: Record<string, unknown>[] = [];

    if (complianceViolations > 0) {
      violations.push({
        facilityName: companyName,
        facilityId: `ECHO-QID-${r.QueryID ?? "unknown"}`,
        state: "US",
        violationDate: null,
        violationType: `${complianceViolations} compliance violations across ${totalFacilities} facilities`,
        complianceStatus: "Violation",
        penaltyAmount: totalPenalties,
        programArea: "Cross-Program",
      });
    }

    if (cleanAirViolations > 0) {
      violations.push({
        facilityName: companyName,
        facilityId: `ECHO-CAA-${r.QueryID ?? "unknown"}`,
        state: "US",
        violationDate: null,
        violationType: `${cleanAirViolations} Clean Air Act facility records`,
        complianceStatus: "Review Required",
        penaltyAmount: null,
        programArea: "Clean Air Act",
      });
    }

    if (cleanWaterViolations > 0) {
      violations.push({
        facilityName: companyName,
        facilityId: `ECHO-CWA-${r.QueryID ?? "unknown"}`,
        state: "US",
        violationDate: null,
        violationType: `${cleanWaterViolations} Clean Water Act facility records`,
        complianceStatus: "Review Required",
        penaltyAmount: null,
        programArea: "Clean Water Act",
      });
    }

    if (rcraViolations > 0) {
      violations.push({
        facilityName: companyName,
        facilityId: `ECHO-RCRA-${r.QueryID ?? "unknown"}`,
        state: "US",
        violationDate: null,
        violationType: `${rcraViolations} RCRA (hazardous waste) facility records`,
        complianceStatus: "Review Required",
        penaltyAmount: null,
        programArea: "RCRA",
      });
    }

    if (formalEnforcements > 0 || informalEnforcements > 0) {
      violations.push({
        facilityName: companyName,
        facilityId: `ECHO-ENF-${r.QueryID ?? "unknown"}`,
        state: "US",
        violationDate: null,
        violationType: `${formalEnforcements} formal + ${informalEnforcements} informal enforcement actions`,
        complianceStatus: "Enforcement",
        penaltyAmount: null,
        programArea: "Enforcement",
      });
    }

    if (triReleases > 0) {
      violations.push({
        facilityName: companyName,
        facilityId: `ECHO-TRI-${r.QueryID ?? "unknown"}`,
        state: "US",
        violationDate: null,
        violationType: `${triReleases} Toxics Release Inventory (TRI) reports`,
        complianceStatus: "Reporting",
        penaltyAmount: null,
        programArea: "TRI",
      });
    }

    return sourceSuccess(
      "epa:violations",
      safeParseArray(EnvironmentalViolationSchema, violations),
    );
  } catch (err) {
    return sourceError("epa:violations", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Fetch detailed compliance for a specific facility by registry ID
// ---------------------------------------------------------------------------

export async function fetchFacilityCompliance(
  registryId: string,
): Promise<DataSourceResult<EnvironmentalViolation[]>> {
  try {
    const raw = await echoFetch<EchoSummaryResponse>(
      "/echo_rest_services.get_facilities",
      { p_id: registryId },
    );

    const r = raw.Results;
    if (!r || r.Message !== "Success") {
      return sourceError("epa:compliance", r?.Message ?? "No data for facility");
    }

    const penalties = r.TotalPenalties
      ? parseFloat(r.TotalPenalties.replace(/[$,]/g, "")) || 0
      : 0;

    const violations: Record<string, unknown>[] = [{
      facilityName: registryId,
      facilityId: registryId,
      state: "US",
      violationDate: null,
      violationType: `${parseNumeric(r.CVRows)} compliance violations`,
      complianceStatus: parseNumeric(r.CVRows) > 0 ? "Violation" : "Compliant",
      penaltyAmount: penalties,
      programArea: "Cross-Program",
    }];

    return sourceSuccess(
      "epa:compliance",
      safeParseArray(EnvironmentalViolationSchema, violations),
    );
  } catch (err) {
    return sourceError("epa:compliance", (err as Error).message);
  }
}

function parseNumeric(value: number | string | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return parseInt(value, 10) || 0;
}
