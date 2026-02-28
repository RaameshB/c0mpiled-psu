import Foundation

// MARK: - Shared Enums

enum RiskLevel: String, Codable, Sendable {
    case low      = "Low"
    case moderate = "Moderate"
    case high     = "High"
    case critical = "Critical"
}

enum ResilienceRating: String, Codable, Sendable {
    case poor      = "Poor"
    case moderate  = "Moderate"
    case strong    = "Strong"
    case excellent = "Excellent"
}

enum AnalysisStatus: String, Codable, Sendable {
    case processing = "processing"
    case complete   = "complete"
    case failed     = "failed"
}

enum RecommendationConfidence: String, Codable, Sendable {
    case low      = "Low"
    case moderate = "Moderate"
    case high     = "High"
}

// MARK: - Analysis Trigger

struct AnalyzeRequest: Encodable, Sendable {
    let vendorName: String

    enum CodingKeys: String, CodingKey {
        case vendorName = "vendor_name"
    }
}

struct AnalyzeResponse: Decodable, Sendable {
    let vendorId:                    String
    let vendorName:                  String
    let status:                      AnalysisStatus
    let estimatedCompletionSeconds:  Int

    enum CodingKeys: String, CodingKey {
        case vendorId                   = "vendor_id"
        case vendorName                 = "vendor_name"
        case status
        case estimatedCompletionSeconds = "estimated_completion_seconds"
    }
}

// MARK: - Status Poll

struct StatusResponse: Decodable, Sendable {
    let vendorId: String
    let status:   AnalysisStatus

    enum CodingKeys: String, CodingKey {
        case vendorId = "vendor_id"
        case status
    }
}

// MARK: - Tab 1: Vendor Overview

struct VendorOverview: Decodable, Sendable {
    let vendorId:           String
    let vendorName:         String
    let riskDistribution:   [RiskSlice]
    let riskLevel:          RiskLevel
    let resilienceRating:   ResilienceRating
    let resilienceScore:    Int
    let resilienceScoreMax: Int
    let resilienceFactors:  [ResilienceFactor]
    let industry:           IndustryInfo
    let riskTrend12m:       [RiskTrendPoint]

    enum CodingKeys: String, CodingKey {
        case vendorId           = "vendor_id"
        case vendorName         = "vendor_name"
        case riskDistribution   = "risk_distribution"
        case riskLevel          = "risk_level"
        case resilienceRating   = "resilience_rating"
        case resilienceScore    = "resilience_score"
        case resilienceScoreMax = "resilience_score_max"
        case resilienceFactors  = "resilience_factors"
        case industry
        case riskTrend12m       = "risk_trend_12m"
    }
}

struct RiskSlice: Decodable, Identifiable, Sendable {
    var id: String { label }
    let label:      String
    let percentage: Double
}

struct ResilienceFactor: Decodable, Identifiable, Sendable {
    var id: String { label }
    let label: String
    let score: Int
}

struct IndustryInfo: Decodable, Sendable {
    let sector:             String
    let subSector:          String
    let hqCountry:          String
    let employeeCountRange: String
    let revenueRangeUsd:    String
    let foundedYear:        Int
    let description:        String

    enum CodingKeys: String, CodingKey {
        case sector
        case subSector          = "sub_sector"
        case hqCountry          = "hq_country"
        case employeeCountRange = "employee_count_range"
        case revenueRangeUsd    = "revenue_range_usd"
        case foundedYear        = "founded_year"
        case description
    }
}

struct RiskTrendPoint: Decodable, Identifiable, Sendable {
    var id: String { month }
    let month:     String   // "YYYY-MM"
    let riskScore: Int

    enum CodingKeys: String, CodingKey {
        case month
        case riskScore = "risk_score"
    }
}

// MARK: - Tab 2: Tier 2/3 Dependencies

struct DependencyResponse: Decodable, Sendable {
    let vendorId:           String
    let summary:            DependencySummary
    let concentrationRisks: [ConcentrationRisk]
    let tier2Suppliers:     [Tier2Supplier]

    enum CodingKeys: String, CodingKey {
        case vendorId           = "vendor_id"
        case summary
        case concentrationRisks = "concentration_risks"
        case tier2Suppliers     = "tier2_suppliers"
    }
}

struct DependencySummary: Decodable, Sendable {
    let tier2Count:               Int
    let tier3Count:               Int
    let countriesRepresented:     Int
    let sectorsRepresented:       Int
    let criticalDependencyCount:  Int

    enum CodingKeys: String, CodingKey {
        case tier2Count              = "tier2_count"
        case tier3Count              = "tier3_count"
        case countriesRepresented    = "countries_represented"
        case sectorsRepresented      = "sectors_represented"
        case criticalDependencyCount = "critical_dependency_count"
    }
}

struct ConcentrationRisk: Decodable, Identifiable, Sendable {
    var id: String { label }
    let label:       String
    let severity:    RiskLevel
    let description: String
}

struct Tier2Supplier: Decodable, Identifiable, Sendable {
    let id:             String
    let name:           String
    let sector:         String
    let country:        String
    let riskLevel:      RiskLevel
    let criticality:    RiskLevel
    let dependencyType: String
    let tier3Suppliers: [Tier3Supplier]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case sector
        case country
        case riskLevel      = "risk_level"
        case criticality
        case dependencyType = "dependency_type"
        case tier3Suppliers = "tier3_suppliers"
    }
}

struct Tier3Supplier: Decodable, Identifiable, Sendable {
    let id:             String
    let name:           String
    let sector:         String
    let country:        String
    let riskLevel:      RiskLevel
    let criticality:    RiskLevel
    let dependencyType: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case sector
        case country
        case riskLevel      = "risk_level"
        case criticality
        case dependencyType = "dependency_type"
    }
}

// MARK: - Tab 3: Risk Breakdown

struct RiskBreakdown: Decodable, Sendable {
    let vendorId:               String
    let overallRiskScore:       Int
    let overallRiskLevel:       RiskLevel
    let overallResilienceScore: Int
    let categories:             [RiskCategory]

    enum CodingKeys: String, CodingKey {
        case vendorId               = "vendor_id"
        case overallRiskScore       = "overall_risk_score"
        case overallRiskLevel       = "overall_risk_level"
        case overallResilienceScore = "overall_resilience_score"
        case categories
    }
}

struct RiskCategory: Decodable, Identifiable, Sendable {
    let id:              String
    let label:           String
    let riskScore:       Int
    let riskLevel:       RiskLevel
    let resilienceScore: Int
    let description:     String
    let subCategories:   [RiskSubCategory]

    enum CodingKeys: String, CodingKey {
        case id
        case label
        case riskScore       = "risk_score"
        case riskLevel       = "risk_level"
        case resilienceScore = "resilience_score"
        case description
        case subCategories   = "sub_categories"
    }
}

struct RiskSubCategory: Decodable, Identifiable, Sendable {
    var id: String { label }
    let label:       String
    let riskScore:   Int
    let description: String

    enum CodingKeys: String, CodingKey {
        case label
        case riskScore   = "risk_score"
        case description
    }
}

// MARK: - Tab 4: Vendor Comparison Engine

struct ComparisonResponse: Decodable, Sendable {
    let recommendation: ComparisonRecommendation
    let vendors:        [VendorComparison]
}

struct ComparisonRecommendation: Decodable, Sendable {
    let winnerVendorId:   String
    let winnerVendorName: String
    let confidence:       RecommendationConfidence
    let summary:          String
    let reasons:          [String]

    enum CodingKeys: String, CodingKey {
        case winnerVendorId   = "winner_vendor_id"
        case winnerVendorName = "winner_vendor_name"
        case confidence
        case summary
        case reasons
    }
}

struct VendorComparison: Decodable, Identifiable, Sendable {
    let vendorId:          String
    let vendorName:        String
    let overallRiskScore:  Int
    let resilienceScore:   Int
    let categoryScores:    [CategoryScore]

    var id: String { vendorId }

    enum CodingKeys: String, CodingKey {
        case vendorId         = "vendor_id"
        case vendorName       = "vendor_name"
        case overallRiskScore = "overall_risk_score"
        case resilienceScore  = "resilience_score"
        case categoryScores   = "category_scores"
    }
}

struct CategoryScore: Decodable, Identifiable, Sendable {
    var id: String { category }
    let category:  String
    let riskScore: Int

    enum CodingKeys: String, CodingKey {
        case category
        case riskScore = "risk_score"
    }
}

// MARK: - API Error

struct APIError: Decodable, Error, Sendable {
    let error: APIErrorBody
}

struct APIErrorBody: Decodable, Sendable {
    let code:    String
    let message: String
    let status:  Int
}
