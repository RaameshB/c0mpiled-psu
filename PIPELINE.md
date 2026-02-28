# Research Pipeline -> Covariance Model Interface

## What This Does

The web app (`apps/web`) runs a two-stage data pipeline per company:

1. **Aggregate** -- Fetches quantitative and qualitative data from 7 sources in parallel.
2. **Evaluate** -- Gemini 2.0 Flash filters the aggregated data, identifies risk signals, and decides whether the company is worth passing to the covariance model.

The API endpoint is `POST /api/research`.

## How to Call It

```bash
curl -X POST https://<host>/api/research \
  -H "Content-Type: application/json" \
  -d '{"companies": [{"ticker": "AAPL"}]}'
```

Multiple companies (max 10):

```json
{
  "companies": [
    { "ticker": "AAPL" },
    { "ticker": "TSLA", "name": "Tesla" }
  ]
}
```

Pass `"skipEvaluation": true` to get raw aggregated data without the LLM pass.

## Response Shape

```
{
  "status": "success",
  "pipeline": "aggregate-and-evaluate",
  "results": [ EvaluatedData, ... ],
  "aggregatedData": [ AggregatedCompanyData, ... ]
}
```

## What the Model Should Consume

Only companies where `results[i].recommendedForModel === true` should be passed to the
covariance model. The LLM makes this gate decision.

### Quantitative Fields (ready to use as-is)

These live in `aggregatedData[i]` and are already numeric:

| Field Path | Shape | Description |
|---|---|---|
| `stockQuote.data.price` | `float` | Current price |
| `stockQuote.data.change` | `float` | Absolute price change |
| `stockQuote.data.changePercent` | `float` | Percent change |
| `stockQuote.data.volume` | `float` | Trading volume |
| `stockQuote.data.marketCap` | `float` | Market capitalization |
| `stockQuote.data.pe` | `float \| null` | Price-to-earnings ratio |
| `historicalPrices.data[]` | `array` | Up to 2 years daily OHLCV. Each entry: `{ date, open, high, low, close, adjClose, volume, vwap }`. All floats. |
| `financialHealth.data.altmanZScore` | `float \| null` | Bankruptcy predictor (>2.99 safe, <1.81 distress) |
| `financialHealth.data.piotroskiScore` | `float \| null` | Financial strength 0-9 |
| `financialHealth.data.debtToEquity` | `float \| null` | Leverage ratio |
| `financialHealth.data.currentRatio` | `float \| null` | Liquidity ratio |
| `financialHealth.data.quickRatio` | `float \| null` | Acid-test ratio |
| `financialHealth.data.returnOnEquity` | `float \| null` | ROE |
| `financialHealth.data.returnOnAssets` | `float \| null` | ROA |
| `macroIndicators.data[]` | `array` | 9 FRED series, each with `observations[]: { date, value }`. Series: GSCPI (supply chain pressure), WTI crude, PPI manufacturing, manufacturing employment, trade balance, ISM inventories, ISM supplier deliveries, vehicle sales, PPI all commodities. |
| `environmentalViolations.data[].penaltyAmount` | `float \| null` | Dollar penalties per facility |

### Qualitative Fields (LLM quantifies these)

These live in `results[i]` (the evaluated output). The LLM has already filtered for
relevance, but the data is not numeric. The model consumer needs to convert them.

| Field | Type | How to Quantify |
|---|---|---|
| `riskSignals[].severity` | `"low" \| "medium" \| "high" \| "critical"` | Map to ordinal: low=1, medium=2, high=3, critical=4 |
| `riskSignals[].category` | `string` | One of: `financial`, `supply_chain`, `regulatory`, `litigation`, `environmental`, `safety`, `macro`. Count signals per category, sum severity scores per category. |
| `relevantFinancials` | `Record<string, unknown>` | LLM-curated key financial metrics. Values are typically numeric but keys vary per company. Extract numeric values directly. |
| `relevantNews` | `NewsArticle[]` | Count of relevant articles. For deeper features: run sentiment analysis on `title` + `description` to get a sentiment score per article, then average. |
| `supplyChainInsights` | `string[]` | Count of insights. Each insight can be scored for concentration risk keywords (e.g., "single source", "sole supplier", "geographic concentration"). |
| `evaluationSummary` | `string` | Not useful as a model feature. Human-readable only. |

### Suggested Feature Vector

For a single company, flatten into a vector like this:

```python
features = {
    # Market (5)
    "price": quote.price,
    "change_pct": quote.changePercent,
    "volume": quote.volume,
    "market_cap": quote.marketCap,
    "pe_ratio": quote.pe or 0.0,

    # Financial health (7)
    "altman_z": health.altmanZScore or 0.0,
    "piotroski": health.piotroskiScore or 0.0,
    "debt_to_equity": health.debtToEquity or 0.0,
    "current_ratio": health.currentRatio or 0.0,
    "quick_ratio": health.quickRatio or 0.0,
    "roe": health.returnOnEquity or 0.0,
    "roa": health.returnOnAssets or 0.0,

    # Risk signal scores (7 categories)
    "risk_financial": sum_severity("financial"),
    "risk_supply_chain": sum_severity("supply_chain"),
    "risk_regulatory": sum_severity("regulatory"),
    "risk_litigation": sum_severity("litigation"),
    "risk_environmental": sum_severity("environmental"),
    "risk_safety": sum_severity("safety"),
    "risk_macro": sum_severity("macro"),

    # Regulatory (2)
    "env_violation_count": len(violations),
    "env_total_penalties": sum(v.penaltyAmount for v in violations),

    # News signal (1)
    "relevant_news_count": len(relevant_news),

    # Supply chain (1)
    "supply_chain_insight_count": len(insights),
}
# Total: ~23 scalar features per company
```

For time-series inputs (historical prices, macro indicators), pass them as separate
tensors alongside the scalar feature vector. The model should handle both.

### Macro Series Keys (FRED)

| Series ID | Name | Use |
|---|---|---|
| `GSCPI` | Global Supply Chain Pressure Index | Direct supply chain stress signal |
| `DCOILWTICO` | WTI Crude Oil | Input cost proxy |
| `PCUOMFG` | PPI Manufacturing | Output price pressure |
| `MANEMP` | Manufacturing Employment | Labor market signal |
| `BOPGSTB` | Trade Balance | Import/export exposure |
| `ISRATIO` | ISM Inventories-to-Sales | Inventory buildup signal |
| `MSPNHSUS` | ISM Supplier Deliveries | Delivery delay proxy |
| `TOTALSA` | Total Vehicle Sales | Demand signal (sector-specific) |
| `PPIACO` | PPI All Commodities | Broad input cost pressure |

## Source Reliability

Each data source wraps its result in `{ success, data, error }`. Always check
`success === true` before reading `data`. Failed sources return `data: null`
with an `error` string. The pipeline does not crash on partial failures.

Sources that need API keys: FMP, NewsAPI, FRED, Firecrawl.
Sources that need no keys: SEC EDGAR, EPA ECHO.

## Files

| File | What it does |
|---|---|
| `apps/web/src/app/api/research/route.ts` | API endpoint |
| `apps/web/src/lib/aggregator.ts` | Parallel data fetcher |
| `apps/web/src/lib/evaluator.ts` | Gemini LLM evaluation pass |
| `apps/web/src/lib/types/research.ts` | All Zod schemas and types |
| `apps/web/src/lib/data-sources/*.ts` | Individual data source clients |
