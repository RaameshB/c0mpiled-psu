import {
  OshaInspectionSchema,
  safeParseArray,
  sourceSuccess,
  sourceError,
  type OshaInspection,
  type DataSourceResult,
} from "@/lib/types/research";

const OSHA_BASE = "https://api.dol.gov/v2/osha/inspection";

// ---------------------------------------------------------------------------
// OSHA inspection search by establishment name
// DOL v2 API requires an API key via X-API-KEY header.
// If no key is set, this source degrades gracefully.
// ---------------------------------------------------------------------------

interface OshaV2Response {
  data?: Array<{
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
  // v1 fallback shape
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
  const apiKey = process.env.DOL_API_KEY;
  if (!apiKey) {
    return sourceError("osha:inspections", "DOL_API_KEY is not set -- OSHA data unavailable");
  }

  try {
    const url = new URL(OSHA_BASE);
    url.searchParams.set("filters", `estab_name sw '${companyName.toUpperCase()}'`);
    url.searchParams.set("page", "0");
    url.searchParams.set("size", String(limit));

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-API-KEY": apiKey,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`OSHA API returned ${response.status}: ${response.statusText}`);
    }

    const raw: OshaV2Response = await response.json();
    const records = raw.data ?? raw.results ?? [];

    const inspections = records.map((r) => ({
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
