import {
  SecFilingSchema,
  safeParseArray,
  sourceSuccess,
  sourceError,
  type SecFiling,
  type DataSourceResult,
} from "@/lib/types/research";

const EDGAR_SEARCH = "https://efts.sec.gov/LATEST/search-index";
const EDGAR_SUBMISSIONS = "https://data.sec.gov/submissions";
const EDGAR_TICKERS = "https://www.sec.gov/files/company_tickers.json";

const USER_AGENT = "ProgRiskAI research-agent admin@progrisk.ai";

async function edgarFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`EDGAR ${url} returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Resolve ticker -> CIK
// ---------------------------------------------------------------------------

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerCache: Record<string, TickerEntry> | null = null;

async function resolveCik(ticker: string): Promise<string | null> {
  if (!tickerCache) {
    const raw = await edgarFetch<Record<string, TickerEntry>>(EDGAR_TICKERS);
    tickerCache = {};
    for (const entry of Object.values(raw)) {
      tickerCache[entry.ticker.toUpperCase()] = entry;
    }
  }

  const entry = tickerCache[ticker.toUpperCase()];
  if (!entry) return null;

  return String(entry.cik_str).padStart(10, "0");
}

// ---------------------------------------------------------------------------
// Fetch recent filings for a company
// ---------------------------------------------------------------------------

interface SubmissionsResponse {
  cik: string;
  entityType: string;
  name: string;
  recentFilings?: {
    accessionNumber: string[];
    filingDate: string[];
    form: string[];
    primaryDocument: string[];
    primaryDocDescription: string[];
  };
  filings?: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

export async function fetchSecFilings(
  ticker: string,
  forms: string[] = ["10-K", "10-Q", "8-K"],
  limit = 20,
): Promise<DataSourceResult<SecFiling[]>> {
  try {
    const cik = await resolveCik(ticker);
    if (!cik) return sourceError("edgar:filings", `Could not resolve CIK for ${ticker}`);

    const raw = await edgarFetch<SubmissionsResponse>(`${EDGAR_SUBMISSIONS}/CIK${cik}.json`);

    const recent = raw.filings?.recent ?? raw.recentFilings;
    if (!recent?.accessionNumber) {
      return sourceSuccess("edgar:filings", []);
    }

    const formSet = new Set(forms.map((f) => f.toUpperCase()));
    const filings: Record<string, unknown>[] = [];

    for (let i = 0; i < recent.accessionNumber.length && filings.length < limit; i++) {
      const form = recent.form[i];
      if (!formSet.has(form.toUpperCase())) continue;

      const accession = recent.accessionNumber[i].replace(/-/g, "");
      const accessionDashed = recent.accessionNumber[i];

      filings.push({
        accessionNumber: accessionDashed,
        filingDate: recent.filingDate[i],
        form,
        description: recent.primaryDocDescription?.[i] ?? form,
        documentUrl: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accession}/${recent.primaryDocument[i]}`,
        filingUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${form}&dateb=&owner=include&count=10`,
      });
    }

    return sourceSuccess("edgar:filings", safeParseArray(SecFilingSchema, filings));
  } catch (err) {
    return sourceError("edgar:filings", (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Full-text search across EDGAR filings
// ---------------------------------------------------------------------------

interface EdgarSearchResult {
  hits: {
    hits: Array<{
      _source: {
        file_date: string;
        form_type: string;
        entity_name: string;
        file_num: string;
        display_date_filed: string;
      };
      _id: string;
    }>;
    total: { value: number };
  };
}

export async function searchEdgarFilings(
  query: string,
  forms?: string[],
  dateFrom?: string,
  dateTo?: string,
  limit = 10,
): Promise<DataSourceResult<SecFiling[]>> {
  try {
    const url = new URL(EDGAR_SEARCH);
    url.searchParams.set("q", query);
    if (forms?.length) url.searchParams.set("forms", forms.join(","));
    if (dateFrom) url.searchParams.set("startdt", dateFrom);
    if (dateTo) url.searchParams.set("enddt", dateTo);

    const raw = await edgarFetch<EdgarSearchResult>(url.toString());

    const filings: Record<string, unknown>[] = raw.hits.hits.slice(0, limit).map((hit) => ({
      accessionNumber: hit._id,
      filingDate: hit._source.file_date ?? hit._source.display_date_filed,
      form: hit._source.form_type,
      description: `${hit._source.entity_name} - ${hit._source.form_type}`,
      documentUrl: "",
      filingUrl: "",
    }));

    return sourceSuccess("edgar:search", safeParseArray(SecFilingSchema, filings));
  } catch (err) {
    return sourceError("edgar:search", (err as Error).message);
  }
}
