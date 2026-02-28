"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CompanyInput = { ticker: string; name: string };

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Home() {
  const [companies, setCompanies] = useState<CompanyInput[]>([
    { ticker: "", name: "" },
  ]);
  const [skipEvaluation, setSkipEvaluation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addCompany = useCallback(() => {
    if (companies.length >= 10) return;
    setCompanies((prev) => [...prev, { ticker: "", name: "" }]);
  }, [companies.length]);

  const removeCompany = useCallback((index: number) => {
    setCompanies((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateCompany = useCallback(
    (index: number, field: keyof CompanyInput, value: string) => {
      setCompanies((prev) =>
        prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
      );
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    const validCompanies = companies.filter((c) => c.ticker.trim());
    if (validCompanies.length === 0) {
      setError("Add at least one company ticker.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: validCompanies.map((c) => ({
            ticker: c.ticker.trim().toUpperCase(),
            ...(c.name.trim() ? { name: c.name.trim() } : {}),
          })),
          skipEvaluation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || `Request failed (${response.status})`);
        return;
      }

      setResults(data);
    } catch (err) {
      setError((err as Error).message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [companies, skipEvaluation]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">ProgRisk AI</h1>
          <p className="mt-1 text-muted-foreground">
            Supply chain risk research pipeline
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Input Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Companies</CardTitle>
              <CardDescription>
                Add up to 10 tickers to analyze. The pipeline aggregates data
                from FMP, EDGAR, FRED, EPA, NewsAPI, and Firecrawl, then
                optionally runs an LLM evaluation pass.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {companies.map((company, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`ticker-${index}`}>Ticker</Label>
                    <Input
                      id={`ticker-${index}`}
                      placeholder="AAPL"
                      value={company.ticker}
                      onChange={(e) =>
                        updateCompany(index, "ticker", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`name-${index}`}>Name (optional)</Label>
                    <Input
                      id={`name-${index}`}
                      placeholder="Apple Inc."
                      value={company.name}
                      onChange={(e) =>
                        updateCompany(index, "name", e.target.value)
                      }
                    />
                  </div>
                  {companies.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCompany(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCompany}
                  disabled={companies.length >= 10}
                >
                  + Add Company
                </Button>
                <span className="text-xs text-muted-foreground">
                  {companies.length}/10
                </span>
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="skip-eval"
                  checked={skipEvaluation}
                  onChange={(e) => setSkipEvaluation(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="skip-eval" className="cursor-pointer">
                  Skip LLM evaluation (faster, raw data only)
                </Label>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Running pipeline..." : "Run Research Pipeline"}
              </Button>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>

          {/* Status Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                  <p className="text-sm text-muted-foreground">
                    Aggregating data from 7+ sources per company...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This may take 30-60 seconds.
                  </p>
                </div>
              )}

              {!loading && !results && !error && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Enter tickers and run the pipeline to see results.
                </p>
              )}

              {results && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {(results as Record<string, unknown>).pipeline as string}
                    </Badge>
                    <Badge variant="outline" className="text-green-700 dark:text-green-400">
                      {(results as Record<string, unknown>).status as string}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(
                      (results as Record<string, unknown>)
                        .results as unknown[]
                    )?.length ?? 0}{" "}
                    company result(s) returned. See details below.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        {results && <ResultsView data={results} />}
      </div>
    </div>
  );
}

function ResultsView({ data }: { data: Record<string, unknown> }) {
  const evaluated = data.results as Record<string, unknown>[] | undefined;
  const aggregated = (data.aggregatedData ??
    data.results) as Record<string, unknown>[] | undefined;
  const modelVariables = data.modelVariables as
    | Record<string, unknown>[]
    | undefined;
  const isEvaluated = data.pipeline === "aggregate-and-evaluate";

  return (
    <div className="mt-6 space-y-6">
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {isEvaluated && (
            <TabsTrigger value="risks">Risk Signals</TabsTrigger>
          )}
          <TabsTrigger value="variables">Model Variables</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {(isEvaluated ? evaluated : aggregated)?.map((result, i) => (
            <CompanyOverviewCard
              key={i}
              result={result}
              isEvaluated={isEvaluated}
            />
          ))}
        </TabsContent>

        {isEvaluated && (
          <TabsContent value="risks" className="mt-4 space-y-4">
            {evaluated?.map((result, i) => (
              <RiskSignalsCard key={i} result={result} />
            ))}
          </TabsContent>
        )}

        <TabsContent value="variables" className="mt-4 space-y-4">
          {modelVariables?.map((vars, i) => (
            <ModelVariablesCard key={i} vars={vars} />
          ))}
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <pre className="max-h-[600px] overflow-auto rounded-md bg-muted p-4 text-xs">
                {JSON.stringify(data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyOverviewCard({
  result,
  isEvaluated,
}: {
  result: Record<string, unknown>;
  isEvaluated: boolean;
}) {
  const company = result.company as Record<string, string> | undefined;
  const ticker = company?.ticker ?? "Unknown";

  if (isEvaluated) {
    const summary = (result.evaluationSummary as string) ?? "";
    const recommended = result.recommendedForModel as boolean;
    const signalCount = (
      result.riskSignals as Record<string, unknown>[]
    )?.length;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{ticker}</CardTitle>
            <Badge variant={recommended ? "default" : "secondary"}>
              {recommended ? "Recommended for Model" : "Not Recommended"}
            </Badge>
          </div>
          <CardDescription>{signalCount} risk signal(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{summary}</p>
        </CardContent>
      </Card>
    );
  }

  const profile = result.profile as Record<string, unknown> | undefined;
  const profileData = profile?.data as Record<string, unknown> | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ticker}</CardTitle>
        <CardDescription>
          {profileData
            ? `${profileData.companyName} -- ${profileData.sector} / ${profileData.industry}`
            : "Raw aggregated data"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <DataSourceStatus label="Profile" source={result.profile} />
          <DataSourceStatus label="Quote" source={result.stockQuote} />
          <DataSourceStatus label="Financials" source={result.financialHealth} />
          <DataSourceStatus label="SEC" source={result.secFilings} />
          <DataSourceStatus label="News" source={result.news} />
          <DataSourceStatus label="Macro" source={result.macroIndicators} />
          <DataSourceStatus label="EPA" source={result.environmentalViolations} />
          <DataSourceStatus label="Web" source={result.webResearch} />
        </div>
      </CardContent>
    </Card>
  );
}

function DataSourceStatus({
  label,
  source,
}: {
  label: string;
  source: unknown;
}) {
  const src = source as Record<string, unknown> | undefined;
  const success = src?.success as boolean | undefined;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${success ? "bg-green-500" : "bg-red-400"}`}
      />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function RiskSignalsCard({ result }: { result: Record<string, unknown> }) {
  const company = result.company as Record<string, string>;
  const signals = (result.riskSignals as Record<string, unknown>[]) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{company?.ticker}</CardTitle>
        <CardDescription>{signals.length} risk signal(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((signal, i) => (
          <div
            key={i}
            className="rounded-md border p-3"
          >
            <div className="flex items-center gap-2">
              <Badge
                className={
                  SEVERITY_COLORS[signal.severity as string] ?? ""
                }
              >
                {signal.severity as string}
              </Badge>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {signal.category as string}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium">
              {signal.signal as string}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {signal.reasoning as string}
            </p>
          </div>
        ))}
        {signals.length === 0 && (
          <p className="text-sm text-muted-foreground">No risk signals.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ModelVariablesCard({ vars }: { vars: Record<string, unknown> }) {
  const company = vars.company as Record<string, string> | undefined;
  const industry = vars.industry as string;
  const categories = ["financial", "operational", "geographical", "ethical"] as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{company?.ticker ?? "Unknown"}</CardTitle>
          <Badge variant="outline">{industry}</Badge>
        </div>
        <CardDescription>
          Partitioned variables for JAX model input
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((cat) => {
            const variables = (vars[cat] as Record<string, unknown>[]) ?? [];
            return (
              <div key={cat}>
                <h4 className="mb-2 text-sm font-semibold capitalize">
                  {cat}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({variables.length})
                  </span>
                </h4>
                <div className="max-h-48 space-y-1 overflow-auto">
                  {variables.map((v, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded px-2 py-1 text-xs odd:bg-muted"
                    >
                      <span className="truncate">{v.name as string}</span>
                      <span className="ml-2 shrink-0 font-mono">
                        {typeof v.value === "number"
                          ? (v.value as number).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })
                          : String(v.value)}
                      </span>
                    </div>
                  ))}
                  {variables.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No variables.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
