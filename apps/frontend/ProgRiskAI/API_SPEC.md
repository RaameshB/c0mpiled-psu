# ProgRiskAI — Backend API Specification

**Stack:** Next.js (App Router) + JAX  
**Base URL:** `https://api.progrisk.ai/v1`  
**Auth:** `Authorization: Bearer <token>` on every request  
**Content-Type:** `application/json`

---

## Conventions

- All scores are **0–100, higher = more risk** (resilience scores are separately labeled)
- All timestamps are **ISO 8601 UTC** (`2026-02-27T12:00:00Z`)
- Month strings are **YYYY-MM**
- Arrays with indeterminate length (e.g. risk categories, trend points) must always return at least 1 item
- On error, every endpoint returns the same error envelope (see bottom)

---

## 1. Trigger Analysis

```
POST /vendors/analyze
```

Start analyzing a vendor by name. Returns immediately with a `vendor_id` and `"processing"` status. The frontend then polls `/vendors/{vendor_id}/status` until `"complete"`.

**Request:**
```json
{
  "vendor_name": "Acme Corp"
}
```

**Response `202`:**
```json
{
  "vendor_id": "vnd_abc123",
  "vendor_name": "Acme Corp",
  "status": "processing",
  "estimated_completion_seconds": 8
}
```

---

## 2. Poll Analysis Status

```
GET /vendors/{vendor_id}/status
```

Frontend polls this every 2 seconds until `status` is `"complete"` or `"failed"`.

**Response `200`:**
```json
{
  "vendor_id": "vnd_abc123",
  "status": "complete"
}
```

`status` values: `"processing"` | `"complete"` | `"failed"`

---

## 3. Tab 1 — Vendor Overview

```
GET /vendors/{vendor_id}/overview
```

Powers all four subcategories on the first tab.

**Response `200`:**
```json
{
  "vendor_id": "vnd_abc123",
  "vendor_name": "Acme Corp",

  "risk_distribution": [
    { "label": "Geopolitical",  "percentage": 34.2 },
    { "label": "Financial",     "percentage": 22.1 },
    { "label": "Operational",   "percentage": 18.5 },
    { "label": "Cybersecurity", "percentage": 15.0 },
    { "label": "Regulatory",    "percentage": 10.2 }
  ],

  "risk_level": "High",
  "resilience_rating": "Moderate",
  "resilience_score": 61,
  "resilience_score_max": 100,
  "resilience_factors": [
    { "label": "Geographic Diversification", "score": 72 },
    { "label": "Financial Stability",        "score": 55 },
    { "label": "Redundancy & Backup",        "score": 48 }
  ],

  "industry": {
    "sector":               "Semiconductors",
    "sub_sector":           "Advanced Packaging",
    "hq_country":           "Taiwan",
    "employee_count_range": "10,000–50,000",
    "revenue_range_usd":    "1B–5B",
    "founded_year":         1994,
    "description":          "Acme Corp is a leading OSAT provider specializing in advanced semiconductor packaging."
  },

  "risk_trend_12m": [
    { "month": "2025-03", "risk_score": 58 },
    { "month": "2025-04", "risk_score": 61 },
    { "month": "2025-05", "risk_score": 60 },
    { "month": "2025-06", "risk_score": 65 },
    { "month": "2025-07", "risk_score": 70 },
    { "month": "2025-08", "risk_score": 68 },
    { "month": "2025-09", "risk_score": 72 },
    { "month": "2025-10", "risk_score": 74 },
    { "month": "2025-11", "risk_score": 71 },
    { "month": "2025-12", "risk_score": 76 },
    { "month": "2026-01", "risk_score": 78 },
    { "month": "2026-02", "risk_score": 82 }
  ]
}
```

**Notes:**
- `risk_distribution` is indeterminate length — render dynamically as a percentage ring/bar per item
- `risk_level` values: `"Low"` | `"Moderate"` | `"High"` | `"Critical"`
- `resilience_rating` values: `"Poor"` | `"Moderate"` | `"Strong"` | `"Excellent"`
- `risk_trend_12m` is always exactly 12 items, oldest first

---

## 4. Tab 2 — Tier 2/3 Dependencies

```
GET /vendors/{vendor_id}/dependencies
```

Returns a **nested tree** (not a graph) for easy traversal.

**Response `200`:**
```json
{
  "vendor_id": "vnd_abc123",
  "summary": {
    "tier2_count": 12,
    "tier3_count": 34,
    "countries_represented": 8,
    "sectors_represented": 5,
    "critical_dependency_count": 3
  },
  "concentration_risks": [
    {
      "label":       "Single-country sourcing",
      "severity":    "High",
      "description": "3 of 5 Tier 2 suppliers are concentrated in Japan."
    }
  ],
  "tier2_suppliers": [
    {
      "id":           "n_002",
      "name":         "Silicon Wafer Co",
      "sector":       "Raw Materials",
      "country":      "Japan",
      "risk_level":   "Moderate",
      "criticality":  "Critical",
      "dependency_type": "Raw Material",
      "tier3_suppliers": [
        {
          "id":              "n_010",
          "name":            "Quartz Mining Ltd",
          "sector":          "Mining",
          "country":         "Brazil",
          "risk_level":      "Low",
          "criticality":     "Moderate",
          "dependency_type": "Raw Material"
        }
      ]
    }
  ]
}
```

**Notes:**
- `risk_level` / `criticality` values: `"Low"` | `"Moderate"` | `"High"` | `"Critical"`
- `tier3_suppliers` can be an empty array `[]` if no Tier 3 data is available
- `concentration_risks` can be an empty array `[]`

---

## 5. Tab 3 — Risk Breakdown

```
GET /vendors/{vendor_id}/risk-breakdown
```

Multi-layer breakdown with scores and explanatory text.

**Response `200`:**
```json
{
  "vendor_id": "vnd_abc123",
  "overall_risk_score": 78,
  "overall_risk_level": "High",
  "overall_resilience_score": 61,
  "categories": [
    {
      "id":                "geopolitical",
      "label":             "Geopolitical",
      "risk_score":        82,
      "risk_level":        "High",
      "resilience_score":  45,
      "description":       "Supplier is headquartered in a region with active trade tensions and export control exposure.",
      "sub_categories": [
        {
          "label":       "Trade Policy Exposure",
          "risk_score":  88,
          "description": "Subject to US–China export controls on advanced chips."
        },
        {
          "label":       "Regional Conflict Proximity",
          "risk_score":  75,
          "description": "Operational sites within 200km of contested straits."
        }
      ]
    },
    {
      "id":                "financial",
      "label":             "Financial",
      "risk_score":        64,
      "risk_level":        "Moderate",
      "resilience_score":  60,
      "description":       "Stable revenue base but elevated leverage ratio relative to sector peers.",
      "sub_categories": [
        {
          "label":       "Debt-to-Equity Ratio",
          "risk_score":  70,
          "description": "D/E of 2.1x is above the sector median of 1.4x."
        },
        {
          "label":       "Cash Runway",
          "risk_score":  55,
          "description": "18 months of operating cash at current burn."
        }
      ]
    }
  ]
}
```

**Notes:**
- `categories` array length is indeterminate — render each category card dynamically
- `sub_categories` can be empty `[]` if no sub-level data exists
- Both `risk_score` (higher = more risk) and `resilience_score` (higher = more resilient) are returned per category so charts can show both axes

---

## 6. Tab 4 — Vendor Comparison Engine

The user selects which previously-analyzed vendors to compare from their session history. The frontend sends a list of `vendor_id`s.

```
GET /vendors/compare?ids=vnd_abc123,vnd_def456,vnd_ghi789
```

**Response `200`:**
```json
{
  "recommendation": {
    "winner_vendor_id":   "vnd_def456",
    "winner_vendor_name": "Beta Supplies Ltd",
    "confidence":         "High",
    "summary":            "Beta Supplies Ltd presents the lowest aggregate risk with strong geographic diversification and financial health.",
    "reasons": [
      "Lowest geopolitical risk score (38 vs peer avg 67)",
      "Only vendor with Tier 2 redundancy across 3+ regions",
      "Highest resilience score (84/100)"
    ]
  },
  "vendors": [
    {
      "vendor_id":          "vnd_abc123",
      "vendor_name":        "Acme Corp",
      "overall_risk_score": 78,
      "resilience_score":   61,
      "category_scores": [
        { "category": "Geopolitical", "risk_score": 82 },
        { "category": "Financial",    "risk_score": 64 },
        { "category": "Operational",  "risk_score": 71 },
        { "category": "Cybersecurity","risk_score": 55 },
        { "category": "Regulatory",   "risk_score": 48 }
      ]
    },
    {
      "vendor_id":          "vnd_def456",
      "vendor_name":        "Beta Supplies Ltd",
      "overall_risk_score": 41,
      "resilience_score":   84,
      "category_scores": [
        { "category": "Geopolitical", "risk_score": 38 },
        { "category": "Financial",    "risk_score": 45 },
        { "category": "Operational",  "risk_score": 40 },
        { "category": "Cybersecurity","risk_score": 50 },
        { "category": "Regulatory",   "risk_score": 33 }
      ]
    }
  ]
}
```

**Notes:**
- `vendors` array mirrors the order of `ids` in the query param
- `category_scores` must have the **same categories in the same order** across all vendors so charts align
- `confidence` values: `"Low"` | `"Moderate"` | `"High"`
- `reasons` is always 2–5 bullet strings

---

## Error Envelope

All endpoints return this shape on failure:

```json
{
  "error": {
    "code":    "VENDOR_NOT_FOUND",
    "message": "No vendor found with the given identifier.",
    "status":  404
  }
}
```

**Error codes:**

| Code | Status | Meaning |
|---|---|---|
| `VENDOR_NOT_FOUND` | 404 | `vendor_id` does not exist |
| `ANALYSIS_FAILED` | 422 | Backend could not analyze the vendor name |
| `STILL_PROCESSING` | 202 | Data not ready yet (poll again) |
| `INVALID_IDS` | 400 | One or more `ids` in compare are invalid |
| `UNAUTHORIZED` | 401 | Missing or invalid bearer token |
| `RATE_LIMITED` | 429 | Too many requests |

---

## Endpoint Summary

| Method | Path | Tab / Use |
|---|---|---|
| `POST` | `/vendors/analyze` | Trigger analysis |
| `GET` | `/vendors/{id}/status` | Poll until complete |
| `GET` | `/vendors/{id}/overview` | Tab 1 — Vendor Overall |
| `GET` | `/vendors/{id}/dependencies` | Tab 2 — Tier 2/3 |
| `GET` | `/vendors/{id}/risk-breakdown` | Tab 3 — Risk Breakdown |
| `GET` | `/vendors/compare?ids=...` | Tab 4 — Comparison Engine |
