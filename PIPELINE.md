# Research Pipeline -> Covariance Model Interface

## What This Does

The web app (`apps/web`) runs a three-stage data pipeline per company:

1. **Aggregate** -- Fetches quantitative and qualitative data from 7 sources in parallel.
2. **Evaluate** -- Gemini 2.0 Flash filters the aggregated data, identifies risk signals, and decides whether the company is worth passing to the covariance model.
3. **Partition** -- Extracts all quantitative variables and partitions them into four risk categories (financial, operational, geographical, ethical), each tagged with the company's industry sector.

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
  "aggregatedData": [ AggregatedCompanyData, ... ],
  "modelVariables": [ PartitionedVariables, ... ]
}
```

When `skipEvaluation` is true, the response omits `results` and `aggregatedData` fields
and returns the raw aggregated data as `results` instead. `modelVariables` is always
present (partitioning works with or without evaluation data).

## What the Model Should Consume

The primary model input is `modelVariables[i]`. Only companies where
`results[i].recommendedForModel === true` should be passed to the covariance model.
The LLM makes this gate decision.

### Partitioned Variables (`modelVariables`)

Each entry in `modelVariables` has this shape:

```typescript
{
  company: { ticker, name?, cik? },
  industry: IndustrySector,       // resolved sector tag
  financial: PartitionedVariable[],
  operational: PartitionedVariable[],
  geographical: PartitionedVariable[],
  ethical: PartitionedVariable[],
}
```

Each `PartitionedVariable` is:

```typescript
{
  name: string,        // e.g. "altman_z_score", "crude_oil_wti_price"
  value: number,       // always quantitative
  category: "financial" | "operational" | "geographical" | "ethical",
  industry: IndustrySector,
}
```

`IndustrySector` is one of: Technology, Healthcare, Finance, Energy, Natural Resources,
Industrials, Consumer Discretionary, Consumer Staples, Utilities, Real Estate,
Telecommunications, Transportation, Agriculture, Defense, Unknown.

The industry tag is resolved from the company profile's sector string through an alias
map with fuzzy matching (e.g. "Financial Services" -> Finance, "Basic Materials" ->
Natural Resources).

### Variables by Category

| Category | Variables | Source |
|---|---|---|
| **Financial** | `stock_price`, `price_change_pct`, `trading_volume`, `market_cap`, `pe_ratio`, `altman_z_score`, `piotroski_score`, `debt_to_equity`, `current_ratio`, `quick_ratio`, `return_on_equity`, `return_on_assets`, `annualized_volatility`, `financial_risk_signal_count`, `financial_risk_severity_score`, `crude_oil_wti_price`, `ppi_manufacturing`, `ppi_all_commodities` | StockQuote, FinancialHealth, HistoricalPrices, FRED, RiskSignals |
| **Operational** | `employee_count`, `supply_chain_risk_signal_count`, `supply_chain_risk_severity_score`, `supply_chain_insight_count`, `sec_filing_count`, `news_article_count`, `global_supply_chain_pressure_index`, `manufacturing_employment`, `ism_inventories_index`, `ism_supplier_deliveries_index`, `total_vehicle_sales` | CompanyProfile, RiskSignals, SEC, News, FRED |
| **Geographical** | `facility_state_count`, `facility_count`, `geographic_concentration_ratio`, `trade_balance_goods_services` | EPA violations, FRED |
| **Ethical** | `environmental_violation_count`, `environmental_total_penalties`, `regulatory_risk_signal_count`, `regulatory_risk_severity_score`, `litigation_risk_signal_count`, `litigation_risk_severity_score`, `environmental_risk_signal_count`, `environmental_risk_severity_score`, `safety_risk_signal_count`, `safety_risk_severity_score` | EPA, RiskSignals |

Categories are not required to be the same size. Financial has the most variables
(~18), ethical ~10, operational ~11, geographical ~4.

### Using Partitioned Variables in Python

```python
import jax.numpy as jnp

response = requests.post(url, json=payload).json()

for company_vars in response["modelVariables"]:
    industry = company_vars["industry"]

    financial = jnp.array([v["value"] for v in company_vars["financial"]])
    operational = jnp.array([v["value"] for v in company_vars["operational"]])
    geographical = jnp.array([v["value"] for v in company_vars["geographical"]])
    ethical = jnp.array([v["value"] for v in company_vars["ethical"]])

    # Variable names for labeling axes
    financial_names = [v["name"] for v in company_vars["financial"]]
```

### Raw Fields (aggregatedData)

The `aggregatedData` array contains the full unprocessed data from all sources. The
partitioner has already extracted the quantitative values from these into
`modelVariables`, but the raw data is available if the model needs time-series inputs
or additional context.

| Field Path | Shape | Description |
|---|---|---|
| `historicalPrices.data[]` | `array` | Up to 2 years daily OHLCV. Each entry: `{ date, open, high, low, close, adjClose, volume, vwap }`. All floats. Use for time-series model inputs. |
| `macroIndicators.data[]` | `array` | 9 FRED series, each with `observations[]: { date, value }`. Use for time-series model inputs. |

For time-series inputs (historical prices, macro indicators), pass them as separate
tensors alongside the partitioned scalar variables.

### Macro Series Keys (FRED)

| Series ID | Partitioned Name | Category | Use |
|---|---|---|---|
| `GSCPI` | `global_supply_chain_pressure_index` | Operational | Direct supply chain stress signal |
| `DCOILWTICO` | `crude_oil_wti_price` | Financial | Input cost proxy |
| `PCUOMFG` | `ppi_manufacturing` | Financial | Output price pressure |
| `MANEMP` | `manufacturing_employment` | Operational | Labor market signal |
| `BOPGSTB` | `trade_balance_goods_services` | Geographical | Import/export exposure |
| `NAPMII` | `ism_inventories_index` | Operational | Inventory buildup signal |
| `NAPMSDI` | `ism_supplier_deliveries_index` | Operational | Delivery delay proxy |
| `TOTALSA` | `total_vehicle_sales` | Operational | Demand signal (sector-specific) |
| `PPIACO` | `ppi_all_commodities` | Financial | Broad input cost pressure |

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
| `apps/web/src/lib/partitioner.ts` | Extracts quantitative variables, partitions by category, tags with industry |
| `apps/web/src/lib/types/research.ts` | All Zod schemas and types |
| `apps/web/src/lib/data-sources/*.ts` | Individual data source clients |
