import Foundation

// MARK: - MockData
// Provides realistic fake data for all four dashboard tabs.
// Simulates a 2-second backend round-trip via MockDataService.load().

enum MockData {

    // MARK: - Tab 1: Vendor Overview

    static func overview(for vendorName: String) -> VendorOverview {
        VendorOverview(
            vendorId:   "vnd_mock001",
            vendorName: vendorName,
            riskDistribution: [
                RiskSlice(label: "Geopolitical",  percentage: 34.2),
                RiskSlice(label: "Financial",      percentage: 22.1),
                RiskSlice(label: "Operational",    percentage: 18.5),
                RiskSlice(label: "Cybersecurity",  percentage: 15.0),
                RiskSlice(label: "Regulatory",     percentage: 10.2)
            ],
            riskLevel:          .high,
            resilienceRating:   .moderate,
            resilienceScore:    61,
            resilienceScoreMax: 100,
            resilienceFactors: [
                ResilienceFactor(label: "Geographic Diversification", score: 72),
                ResilienceFactor(label: "Financial Stability",        score: 55),
                ResilienceFactor(label: "Redundancy & Backup",        score: 48),
                ResilienceFactor(label: "Crisis Response",            score: 63),
                ResilienceFactor(label: "Supplier Relationships",     score: 70)
            ],
            industry: IndustryInfo(
                sector:             "Semiconductors",
                subSector:          "Advanced Packaging",
                hqCountry:          "Taiwan",
                employeeCountRange: "10,000–50,000",
                revenueRangeUsd:    "$1B–$5B",
                foundedYear:        1994,
                description:        "\(vendorName) is a leading OSAT provider specializing in advanced semiconductor packaging and high-volume assembly. The company serves tier-1 fabless companies across AI, mobile, and automotive segments."
            ),
            riskTrend12m: [
                RiskTrendPoint(month: "2025-03", riskScore: 58),
                RiskTrendPoint(month: "2025-04", riskScore: 61),
                RiskTrendPoint(month: "2025-05", riskScore: 60),
                RiskTrendPoint(month: "2025-06", riskScore: 65),
                RiskTrendPoint(month: "2025-07", riskScore: 70),
                RiskTrendPoint(month: "2025-08", riskScore: 68),
                RiskTrendPoint(month: "2025-09", riskScore: 72),
                RiskTrendPoint(month: "2025-10", riskScore: 74),
                RiskTrendPoint(month: "2025-11", riskScore: 71),
                RiskTrendPoint(month: "2025-12", riskScore: 76),
                RiskTrendPoint(month: "2026-01", riskScore: 78),
                RiskTrendPoint(month: "2026-02", riskScore: 82)
            ]
        )
    }

    // MARK: - Tab 2: Dependencies

    static let dependencies = DependencyResponse(
        vendorId: "vnd_mock001",
        summary: DependencySummary(
            tier2Count:              12,
            tier3Count:              34,
            countriesRepresented:    8,
            sectorsRepresented:      5,
            criticalDependencyCount: 3
        ),
        concentrationRisks: [
            ConcentrationRisk(label: "Single-country sourcing",     severity: .high,     description: "3 of 5 critical Tier 2 suppliers are concentrated in Japan — a single tariff change or natural disaster could disrupt 60% of material flow."),
            ConcentrationRisk(label: "Single-source chemical input", severity: .critical, description: "Ultra-pure hydrogen peroxide is sourced exclusively from Mitsubishi Chemical with no qualified backup supplier."),
            ConcentrationRisk(label: "Logistics bottleneck",        severity: .moderate, description: "95% of outbound shipments route through Kaohsiung port — high exposure to port congestion and maritime disruption.")
        ],
        tier2Suppliers: [
            Tier2Supplier(
                id: "n_002", name: "Silicon Wafer Co", sector: "Raw Materials",
                country: "Japan", riskLevel: .moderate, criticality: .critical,
                dependencyType: "Raw Material",
                tier3Suppliers: [
                    Tier3Supplier(id: "n_010", name: "Quartz Mining Ltd",  sector: "Mining",    country: "Brazil",  riskLevel: .low,      criticality: .moderate, dependencyType: "Raw Material"),
                    Tier3Supplier(id: "n_011", name: "PureSilica GmbH",    sector: "Chemicals", country: "Germany", riskLevel: .low,      criticality: .moderate, dependencyType: "Refined Input")
                ]
            ),
            Tier2Supplier(
                id: "n_003", name: "Photomask Global", sector: "Photonics",
                country: "South Korea", riskLevel: .low, criticality: .high,
                dependencyType: "Tooling",
                tier3Suppliers: [
                    Tier3Supplier(id: "n_012", name: "ChromeBlank Industries", sector: "Metals",    country: "USA",   riskLevel: .low,      criticality: .low,      dependencyType: "Raw Material"),
                    Tier3Supplier(id: "n_013", name: "Laser Optics KR",        sector: "Photonics", country: "Japan", riskLevel: .moderate, criticality: .moderate, dependencyType: "Equipment")
                ]
            ),
            Tier2Supplier(
                id: "n_004", name: "UPH Chemicals Taiwan", sector: "Chemicals",
                country: "Taiwan", riskLevel: .high, criticality: .critical,
                dependencyType: "Process Chemical",
                tier3Suppliers: [
                    Tier3Supplier(id: "n_014", name: "Mitsubishi Chemical", sector: "Chemicals", country: "Japan",   riskLevel: .moderate, criticality: .critical, dependencyType: "Upstream Input"),
                    Tier3Supplier(id: "n_015", name: "H2O2 Pure Systems",  sector: "Chemicals", country: "Germany", riskLevel: .low,      criticality: .moderate, dependencyType: "Refined Input")
                ]
            ),
            Tier2Supplier(
                id: "n_005", name: "Precision Substrates Inc", sector: "Electronics",
                country: "USA", riskLevel: .low, criticality: .moderate,
                dependencyType: "Substrate",
                tier3Suppliers: []
            ),
            Tier2Supplier(
                id: "n_006", name: "Kaohsiung Logistics", sector: "Logistics",
                country: "Taiwan", riskLevel: .moderate, criticality: .high,
                dependencyType: "Logistics",
                tier3Suppliers: [
                    Tier3Supplier(id: "n_016", name: "Pacific Freight Co", sector: "Shipping", country: "Taiwan", riskLevel: .moderate, criticality: .moderate, dependencyType: "Maritime")
                ]
            ),
            Tier2Supplier(
                id: "n_007", name: "NovaSeal Packaging", sector: "Packaging",
                country: "Malaysia", riskLevel: .low, criticality: .low,
                dependencyType: "Packaging",
                tier3Suppliers: []
            )
        ]
    )

    // MARK: - Tab 3: Risk Breakdown

    static let riskBreakdown = RiskBreakdown(
        vendorId:               "vnd_mock001",
        overallRiskScore:       78,
        overallRiskLevel:       .high,
        overallResilienceScore: 61,
        categories: [
            RiskCategory(
                id: "geopolitical", label: "Geopolitical",
                riskScore: 82, riskLevel: .high, resilienceScore: 45,
                description: "Supplier is headquartered in a region with active trade tensions, export control exposure, and proximity to a potential conflict zone.",
                subCategories: [
                    RiskSubCategory(label: "Trade Policy Exposure",      riskScore: 88, description: "Subject to US–China export controls on advanced chips. Potential for further technology restrictions in 2026."),
                    RiskSubCategory(label: "Regional Conflict Proximity", riskScore: 75, description: "Operational sites within 200km of contested straits — top-5 risk scenario for supply disruption."),
                    RiskSubCategory(label: "Sanctions Exposure",          riskScore: 60, description: "No current sanctions but secondary exposure through two Tier 2 suppliers with China-linked ownership.")
                ]
            ),
            RiskCategory(
                id: "financial", label: "Financial",
                riskScore: 64, riskLevel: .moderate, resilienceScore: 60,
                description: "Stable revenue base with strong bookings, but elevated leverage ratio relative to sector peers and thin free cash flow margin.",
                subCategories: [
                    RiskSubCategory(label: "Debt-to-Equity Ratio", riskScore: 70, description: "D/E of 2.1x is above sector median of 1.4x. Refinancing risk materializes in Q3 2026."),
                    RiskSubCategory(label: "Cash Runway",           riskScore: 55, description: "18 months of operating cash at current burn. Adequate but limited headroom for capex."),
                    RiskSubCategory(label: "Revenue Concentration", riskScore: 67, description: "Top 3 customers represent 71% of revenue — high customer concentration risk.")
                ]
            ),
            RiskCategory(
                id: "operational", label: "Operational",
                riskScore: 71, riskLevel: .high, resilienceScore: 52,
                description: "Single-site manufacturing creates significant operational concentration. Aging equipment fleet and low automation ratio are key concerns.",
                subCategories: [
                    RiskSubCategory(label: "Single-Site Concentration", riskScore: 84, description: "85% of output from one facility. No qualified backup site exists in the supply chain."),
                    RiskSubCategory(label: "Equipment Age",              riskScore: 68, description: "Average equipment age of 7.2 years — 30% past OEM-recommended refresh cycle."),
                    RiskSubCategory(label: "Labor Risk",                 riskScore: 58, description: "High skilled labor turnover (22% annually) in tight semiconductor packaging talent market.")
                ]
            ),
            RiskCategory(
                id: "cybersecurity", label: "Cybersecurity",
                riskScore: 55, riskLevel: .moderate, resilienceScore: 71,
                description: "Above-average cyber posture for the sector. ISO 27001 certified. However, OT/IT convergence in manufacturing creates attack surface.",
                subCategories: [
                    RiskSubCategory(label: "OT Attack Surface",    riskScore: 62, description: "Operational technology systems partially connected to corporate network. Legacy PLCs with unpatched firmware."),
                    RiskSubCategory(label: "Third-Party Access",    riskScore: 58, description: "14 third-party vendors with persistent remote access to manufacturing systems."),
                    RiskSubCategory(label: "Data Breach History",   riskScore: 35, description: "No material breaches in last 5 years. Passed 2025 SOC 2 Type II audit with zero critical findings.")
                ]
            ),
            RiskCategory(
                id: "regulatory", label: "Regulatory",
                riskScore: 48, riskLevel: .moderate, resilienceScore: 80,
                description: "Strong compliance record. Low regulatory risk due to established compliance program and clean audit history.",
                subCategories: [
                    RiskSubCategory(label: "Export Control Compliance", riskScore: 55, description: "Strong ITAR/EAR compliance program. Minor finding in 2024 self-disclosure corrected within 30 days."),
                    RiskSubCategory(label: "Environmental Compliance",  riskScore: 42, description: "On track for TSMC green supply chain requirements. ISO 14001 certified."),
                    RiskSubCategory(label: "Labor Standards",           riskScore: 48, description: "Compliant with RBA code of conduct. No findings in last 3 audits.")
                ]
            )
        ]
    )

    // MARK: - Tab 4: Comparison

    static func comparison(primaryVendor: String) -> ComparisonResponse {
        ComparisonResponse(
            recommendation: ComparisonRecommendation(
                winnerVendorId:   "vnd_mock002",
                winnerVendorName: "Beta Supplies Ltd",
                confidence:       .high,
                summary:          "Beta Supplies Ltd presents the lowest aggregate risk profile with strong geographic diversification, superior financial health, and Tier 2 redundancy across three regions.",
                reasons: [
                    "Lowest geopolitical risk score (38 vs peer avg 67)",
                    "Only vendor with qualified backup manufacturing site",
                    "Highest resilience score (84/100) — 23 pts above group avg",
                    "Debt-free balance sheet with 36-month cash runway",
                    "ISO 27001 + SOC 2 Type II — strongest cyber posture in group"
                ]
            ),
            vendors: [
                VendorComparison(
                    vendorId: "vnd_mock001", vendorName: primaryVendor,
                    overallRiskScore: 78, resilienceScore: 61,
                    categoryScores: [
                        CategoryScore(category: "Geopolitical",  riskScore: 82),
                        CategoryScore(category: "Financial",     riskScore: 64),
                        CategoryScore(category: "Operational",   riskScore: 71),
                        CategoryScore(category: "Cybersecurity", riskScore: 55),
                        CategoryScore(category: "Regulatory",    riskScore: 48)
                    ]
                ),
                VendorComparison(
                    vendorId: "vnd_mock002", vendorName: "Beta Supplies Ltd",
                    overallRiskScore: 41, resilienceScore: 84,
                    categoryScores: [
                        CategoryScore(category: "Geopolitical",  riskScore: 38),
                        CategoryScore(category: "Financial",     riskScore: 45),
                        CategoryScore(category: "Operational",   riskScore: 40),
                        CategoryScore(category: "Cybersecurity", riskScore: 50),
                        CategoryScore(category: "Regulatory",    riskScore: 33)
                    ]
                ),
                VendorComparison(
                    vendorId: "vnd_mock003", vendorName: "Gamma Components Co",
                    overallRiskScore: 63, resilienceScore: 58,
                    categoryScores: [
                        CategoryScore(category: "Geopolitical",  riskScore: 71),
                        CategoryScore(category: "Financial",     riskScore: 58),
                        CategoryScore(category: "Operational",   riskScore: 65),
                        CategoryScore(category: "Cybersecurity", riskScore: 60),
                        CategoryScore(category: "Regulatory",    riskScore: 52)
                    ]
                )
            ]
        )
    }
}

// MARK: - MockDataService

/// Drop-in replacement for APIClient while the real backend is being built.
/// All methods simulate a 2-second network round-trip.
@MainActor
final class MockDataService {

    static let shared = MockDataService()
    private init() {}

    private let simulatedDelay: UInt64 = 2_000_000_000 // 2 seconds in nanoseconds

    func analyzeVendor(name: String) async -> String {
        try? await Task.sleep(nanoseconds: simulatedDelay)
        return "vnd_mock001"
    }

    func fetchOverview(vendorId: String, vendorName: String) async -> VendorOverview {
        try? await Task.sleep(nanoseconds: simulatedDelay)
        return MockData.overview(for: vendorName)
    }

    func fetchDependencies(vendorId: String) async -> DependencyResponse {
        try? await Task.sleep(nanoseconds: simulatedDelay)
        return MockData.dependencies
    }

    func fetchRiskBreakdown(vendorId: String) async -> RiskBreakdown {
        try? await Task.sleep(nanoseconds: simulatedDelay)
        return MockData.riskBreakdown
    }

    func fetchComparison(primaryVendor: String) async -> ComparisonResponse {
        try? await Task.sleep(nanoseconds: simulatedDelay)
        return MockData.comparison(primaryVendor: primaryVendor)
    }
}
