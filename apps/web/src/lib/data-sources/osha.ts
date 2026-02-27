import {
  OshaInspectionSchema,
  safeParseArray,
  sourceSuccess,
  sourceError,
  type OshaInspection,
  type DataSourceResult,
} from "@/lib/types/research";

const OSHA_BASE = "https://enforcedata.dol.gov/api/enforcement/osha_inspection";

// ---------------------------------------------------------------------------
// OSHA inspection search by establishment name
// ---------------------------------------------------------------------------

interface OshaApiResponse {
  results?: Array<{
    activity_nr: string;
    estab_name: string;
    site_state: string;
    open_date: string;
    close_case_date: string;
    viol_type: string;
    total_current_penalty: string | number;
    insp_type: string;
    naics_code: string;
    sic_code: string;
  }>;
}

export async function fetchOshaInspections(
  companyName: string,
  limit = 25,
): Promise<DataSourceResult<OshaInspection[]>> {
  try {
    const url = new URL(OSHA_BASE);
    url.searchParams.set("estab_name", companyName);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("sort", "-open_date");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-API-KEY": process.env.DOL_API_KEY ?? "",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`OSHA API returned ${response.status}: ${response.statusText}`);
    }

    const raw: OshaApiResponse = await response.json();
    const inspections = (raw.results ?? []).map((r) => ({
      activityNumber: r.activity_nr,
      establishmentName: r.estab_name,
      siteState: r.site_state,
      openDate: r.open_date,
      closeDate: r.close_case_date ?? null,
      violationType: r.viol_type ?? null,
      penaltyAmount: typeof r.total_current_penalty === "string"
        ? parseFloat(r.total_current_penalty) || 0
        : r.total_current_penalty ?? 0,
      inspectionType: r.insp_type,
      industry: r.naics_code || r.sic_code || "Unknown",
    }));

    return sourceSuccess("osha:inspections", safeParseArray(OshaInspectionSchema, inspections));
  } catch (err) {
    return sourceError("osha:inspections", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Aggregate OSHA penalty stats for a company
// ---------------------------------------------------------------------------

export interface OshaPenaltySummary {
  totalInspections: number;
  totalPenalties: number;
  averagePenalty: number;
  mostRecentInspection: string | null;
  violationTypes: Record<string, number>;
}

export function summarizeOshaInspections(inspections: OshaInspection[]): OshaPenaltySummary {
  const totalPenalties = inspections.reduce((sum, i) => sum + i.penaltyAmount, 0);
  const violationTypes: Record<string, number> = {};

  for (const inspection of inspections) {
    if (inspection.violationType) {
      violationTypes[inspection.violationType] =
        (violationTypes[inspection.violationType] ?? 0) + 1;
    }
  }

  return {
    totalInspections: inspections.length,
    totalPenalties,
    averagePenalty: inspections.length > 0 ? totalPenalties / inspections.length : 0,
    mostRecentInspection: inspections[0]?.openDate ?? null,
    violationTypes,
  };
}
