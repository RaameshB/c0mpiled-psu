import {
  MacroIndicatorSchema,
  MacroObservationSchema,
  safeParseArray,
  safeParse,
  sourceSuccess,
  sourceError,
  type MacroIndicator,
  type DataSourceResult,
} from "@/lib/types/research";

const FRED_BASE = "https://api.stlouisfed.org/fred";

function apiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY is not set");
  return key;
}

async function fredFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${FRED_BASE}${path}`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("file_type", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`FRED ${path} returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Supply-chain-relevant FRED series
// ---------------------------------------------------------------------------

export const SUPPLY_CHAIN_SERIES = {
  GSCPI: {
    id: "GSCPI",
    name: "Global Supply Chain Pressure Index",
    units: "Standard Deviations",
    frequency: "Monthly",
  },
  DCOILWTICO: {
    id: "DCOILWTICO",
    name: "Crude Oil Prices: WTI",
    units: "Dollars per Barrel",
    frequency: "Daily",
  },
  PCUOMFG: {
    id: "PCUOMFG",
    name: "Producer Price Index: Total Manufacturing",
    units: "Index",
    frequency: "Monthly",
  },
  MANEMP: {
    id: "MANEMP",
    name: "Manufacturing Employees",
    units: "Thousands of Persons",
    frequency: "Monthly",
  },
  BOPGSTB: {
    id: "BOPGSTB",
    name: "Trade Balance: Goods and Services",
    units: "Millions of Dollars",
    frequency: "Monthly",
  },
  NAPMII: {
    id: "NAPMII",
    name: "ISM Manufacturing: Inventories Index",
    units: "Percent",
    frequency: "Monthly",
  },
  NAPMSDI: {
    id: "NAPMSDI",
    name: "ISM Manufacturing: Supplier Deliveries Index",
    units: "Percent",
    frequency: "Monthly",
  },
  TOTALSA: {
    id: "TOTALSA",
    name: "Total Vehicle Sales",
    units: "Millions of Units",
    frequency: "Monthly",
  },
  PPIACO: {
    id: "PPIACO",
    name: "Producer Price Index: All Commodities",
    units: "Index 1982=100",
    frequency: "Monthly",
  },
} as const;

// ---------------------------------------------------------------------------
// Fetch a single FRED series
// ---------------------------------------------------------------------------

interface FredObservation {
  date: string;
  value: string;
}

interface FredSeriesResponse {
  observations: FredObservation[];
}

interface FredSeriesInfo {
  seriess: Array<{
    id: string;
    title: string;
    units: string;
    frequency: string;
  }>;
}

async function fetchSingleSeries(
  seriesId: string,
  observationStart?: string,
  limit = 120,
): Promise<MacroIndicator> {
  const [infoRaw, obsRaw] = await Promise.all([
    fredFetch<FredSeriesInfo>("/series", { series_id: seriesId }),
    fredFetch<FredSeriesResponse>("/series/observations", {
      series_id: seriesId,
      sort_order: "desc",
      limit: String(limit),
      ...(observationStart ? { observation_start: observationStart } : {}),
    }),
  ]);

  const info = infoRaw.seriess?.[0];
  const observations = (obsRaw.observations ?? []).map((obs) => ({
    date: obs.date,
    value: obs.value === "." ? null : parseFloat(obs.value),
  }));

  const indicator: MacroIndicator = {
    seriesId,
    seriesName: info?.title ?? seriesId,
    observations: safeParseArray(MacroObservationSchema, observations),
    units: info?.units ?? "Unknown",
    frequency: info?.frequency ?? "Unknown",
  };

  return safeParse(MacroIndicatorSchema, indicator, indicator);
}

// ---------------------------------------------------------------------------
// Fetch all supply-chain-relevant macro indicators
// ---------------------------------------------------------------------------

export async function fetchSupplyChainIndicators(
  observationStart?: string,
): Promise<DataSourceResult<MacroIndicator[]>> {
  try {
    const seriesIds = Object.values(SUPPLY_CHAIN_SERIES).map((s) => s.id);

    const results = await Promise.allSettled(
      seriesIds.map((id) => fetchSingleSeries(id, observationStart)),
    );

    const indicators: MacroIndicator[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        indicators.push(result.value);
      }
    }

    return sourceSuccess("fred:macro", indicators);
  } catch (err) {
    return sourceError("fred:macro", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Fetch specific series by ID
// ---------------------------------------------------------------------------

export async function fetchFredSeries(
  seriesId: string,
  observationStart?: string,
  limit = 120,
): Promise<DataSourceResult<MacroIndicator>> {
  try {
    const indicator = await fetchSingleSeries(seriesId, observationStart, limit);
    return sourceSuccess(`fred:${seriesId}`, indicator);
  } catch (err) {
    return sourceError(`fred:${seriesId}`, (err as Error).message);
  }
}
