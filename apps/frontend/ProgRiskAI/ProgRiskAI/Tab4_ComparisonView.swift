import SwiftUI

// MARK: - Tab 4: Vendor Comparison Engine

struct ComparisonTabView: View {
    let data: ComparisonResponse
    let primaryVendorName: String
    @State private var appeared = false
    @State private var selectedMetric: String = "Overall"

    private let metrics = ["Overall", "Geopolitical", "Financial", "Operational", "Cybersecurity", "Regulatory"]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Winner recommendation banner
                RecommendationBanner(
                    recommendation: data.recommendation,
                    appeared: appeared
                )

                // Metric selector
                DashCard(title: "Category Deep-Dive", icon: "slider.horizontal.3") {
                    VStack(spacing: 16) {
                        // Pill metric picker
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(metrics, id: \.self) { metric in
                                    MetricPill(
                                        label:      metric,
                                        isSelected: selectedMetric == metric
                                    ) {
                                        withAnimation(.spring(duration: 0.35, bounce: 0.1)) {
                                            selectedMetric = metric
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal, 2)
                        }

                        // Bar chart for selected metric
                        ComparisonBarChart(
                            vendors:       data.vendors,
                            metric:        selectedMetric,
                            winnerId:      data.recommendation.winnerVendorId,
                            appeared:      appeared
                        )
                        .frame(height: 180)
                    }
                }

                // Per-vendor cards with radar-style breakdown
                VStack(spacing: 16) {
                    ForEach(Array(data.vendors.enumerated()), id: \.element.id) { idx, vendor in
                        VendorComparisonCard(
                            vendor:   vendor,
                            isWinner: vendor.vendorId == data.recommendation.winnerVendorId,
                            index:    idx,
                            appeared: appeared
                        )
                    }
                }

                // Reasons panel
                DashCard(title: "Why \(data.recommendation.winnerVendorName)?", icon: "star.fill") {
                    ReasonsPanel(
                        recommendation: data.recommendation,
                        appeared:       appeared
                    )
                }
            }
            .padding(24)
        }
        .scrollIndicators(.never)
        .onAppear {
            withAnimation(.spring(duration: 0.6).delay(0.1)) {
                appeared = true
            }
        }
    }
}

// MARK: - Recommendation Banner

private struct RecommendationBanner: View {
    let recommendation: ComparisonRecommendation
    let appeared: Bool

    var confidenceColor: Color {
        switch recommendation.confidence {
        case .low:      Color(hex: "FACC15")
        case .moderate: Color(hex: "FB923C")
        case .high:     Color(hex: "4ADE80")
        }
    }

    var body: some View {
        ZStack {
            // Gradient background
            RoundedRectangle(cornerRadius: 20)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(hex: "00C9FF").opacity(0.18),
                            Color(hex: "92FE9D").opacity(0.08)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(
                            LinearGradient(
                                colors: [Color(hex: "00C9FF").opacity(0.5), Color(hex: "92FE9D").opacity(0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1.5
                        )
                )

            HStack(spacing: 20) {
                // Trophy icon
                ZStack {
                    Circle()
                        .fill(Color(hex: "00C9FF").opacity(0.15))
                        .frame(width: 64, height: 64)
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Color(hex: "00C9FF"), Color(hex: "92FE9D")],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .shadow(color: Color(hex: "00C9FF").opacity(0.5), radius: 8)
                }
                .scaleEffect(appeared ? 1 : 0.5)
                .animation(.spring(duration: 0.7, bounce: 0.35).delay(0.2), value: appeared)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Recommended Vendor")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(.white.opacity(0.5))
                            .textCase(.uppercase)
                            .kerning(0.8)

                        // Confidence badge
                        HStack(spacing: 4) {
                            Circle()
                                .fill(confidenceColor)
                                .frame(width: 5, height: 5)
                            Text("\(recommendation.confidence.rawValue) Confidence")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundColor(confidenceColor)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(confidenceColor.opacity(0.12), in: Capsule())
                        .overlay(Capsule().stroke(confidenceColor.opacity(0.3), lineWidth: 1))
                    }

                    Text(recommendation.winnerVendorName)
                        .font(.system(size: 24, weight: .black, design: .rounded))
                        .foregroundStyle(DesignSystem.Gradients.primaryAccent)

                    Text(recommendation.summary)
                        .font(.system(size: 13, design: .rounded))
                        .foregroundColor(.white.opacity(0.65))
                        .lineSpacing(3)
                        .lineLimit(3)
                }

                Spacer()
            }
            .padding(20)
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 24)
        .animation(.spring(duration: 0.7, bounce: 0.1).delay(0.05), value: appeared)
    }
}

// MARK: - Metric Pill

private struct MetricPill: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void
    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .foregroundStyle(isSelected
                    ? AnyShapeStyle(Color.black)
                    : AnyShapeStyle(Color.white.opacity(isHovered ? 0.8 : 0.5))
                )
                .background(
                    Group {
                        if isSelected {
                            Capsule().fill(DesignSystem.Gradients.primaryAccent)
                        } else {
                            Capsule().fill(Color.white.opacity(0.07))
                                .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 1))
                        }
                    }
                )
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(.spring(duration: 0.25), value: isSelected)
    }
}

// MARK: - Comparison Bar Chart

private struct ComparisonBarChart: View {
    let vendors:  [VendorComparison]
    let metric:   String
    let winnerId: String
    let appeared: Bool

    private func score(for vendor: VendorComparison) -> Int {
        if metric == "Overall" { return vendor.overallRiskScore }
        return vendor.categoryScores.first(where: { $0.category == metric })?.riskScore ?? 0
    }

    private func barColor(for vendor: VendorComparison) -> LinearGradient {
        if vendor.vendorId == winnerId {
            return LinearGradient(colors: [Color(hex: "00C9FF"), Color(hex: "92FE9D")], startPoint: .leading, endPoint: .trailing)
        }
        return LinearGradient(colors: [Color.white.opacity(0.25), Color.white.opacity(0.15)], startPoint: .leading, endPoint: .trailing)
    }

    var body: some View {
        VStack(spacing: 14) {
            ForEach(Array(vendors.enumerated()), id: \.element.id) { idx, vendor in
                let s = score(for: vendor)
                let isWinner = vendor.vendorId == winnerId

                HStack(spacing: 12) {
                    // Vendor name
                    HStack(spacing: 6) {
                        if isWinner {
                            Image(systemName: "checkmark.seal.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                        }
                        Text(vendor.vendorName)
                            .font(.system(size: 13, weight: isWinner ? .bold : .medium, design: .rounded))
                            .foregroundColor(isWinner ? .white : .white.opacity(0.6))
                            .lineLimit(1)
                    }
                    .frame(width: 160, alignment: .leading)

                    // Bar
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(0.06))
                            Capsule()
                                .fill(barColor(for: vendor))
                                .frame(width: appeared ? geo.size.width * CGFloat(s) / 100 : 0)
                                .shadow(color: isWinner ? Color(hex: "00C9FF").opacity(0.4) : .clear, radius: 6)
                                .animation(.spring(duration: 0.9, bounce: 0.05).delay(Double(idx) * 0.12 + 0.2), value: appeared)
                        }
                    }
                    .frame(height: 12)

                    // Score
                    Text("\(s)")
                        .font(.system(size: 14, weight: .black, design: .monospaced))
                        .foregroundColor(isWinner ? Color(hex: "00C9FF") : .white.opacity(0.55))
                        .frame(width: 32, alignment: .trailing)
                }
                .opacity(appeared ? 1 : 0)
                .offset(x: appeared ? 0 : -20)
                .animation(.spring(duration: 0.5).delay(Double(idx) * 0.1 + 0.15), value: appeared)
            }
        }
    }
}

// MARK: - Vendor Comparison Card

private struct VendorComparisonCard: View {
    let vendor:   VendorComparison
    let isWinner: Bool
    let index:    Int
    let appeared: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        if isWinner {
                            Image(systemName: "crown.fill")
                                .font(.system(size: 13))
                                .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                        }
                        Text(vendor.vendorName)
                            .font(.system(size: 17, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    HStack(spacing: 12) {
                        ScorePill(label: "Risk",       value: vendor.overallRiskScore,  color: riskScoreColor(vendor.overallRiskScore))
                        ScorePill(label: "Resilience", value: vendor.resilienceScore, color: Color(hex: "00C9FF"))
                    }
                }
                Spacer()

                if isWinner {
                    Text("WINNER")
                        .font(.system(size: 10, weight: .black, design: .rounded))
                        .kerning(1.2)
                        .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color(hex: "00C9FF").opacity(0.12), in: Capsule())
                        .overlay(Capsule().stroke(Color(hex: "00C9FF").opacity(0.4), lineWidth: 1.5))
                }
            }

            Divider().background(Color.white.opacity(0.07))

            // Category scores spider/bar breakdown
            VStack(spacing: 8) {
                ForEach(Array(vendor.categoryScores.enumerated()), id: \.element.id) { idx, cs in
                    CategoryScoreBar(
                        score:    cs,
                        isWinner: isWinner,
                        index:    idx,
                        appeared: appeared
                    )
                }
            }
        }
        .padding(18)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(
                            isWinner
                                ? AnyShapeStyle(LinearGradient(colors: [Color(hex: "00C9FF").opacity(0.6), Color(hex: "92FE9D").opacity(0.3)], startPoint: .topLeading, endPoint: .bottomTrailing))
                                : AnyShapeStyle(Color.white.opacity(0.08)),
                            lineWidth: isWinner ? 1.5 : 1
                        )
                )
        )
        .shadow(color: isWinner ? Color(hex: "00C9FF").opacity(0.1) : .clear, radius: 20)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 30)
        .animation(.spring(duration: 0.6, bounce: 0.1).delay(Double(index) * 0.1 + 0.2), value: appeared)
    }

    private func riskScoreColor(_ score: Int) -> Color {
        if score < 40 { return Color(hex: "4ADE80") }
        if score < 60 { return Color(hex: "FACC15") }
        if score < 80 { return Color(hex: "FB923C") }
        return Color(hex: "F87171")
    }
}

private struct ScorePill: View {
    let label: String
    let value: Int
    let color: Color

    var body: some View {
        HStack(spacing: 5) {
            Text(label)
                .font(.system(size: 11, design: .rounded))
                .foregroundColor(.white.opacity(0.45))
            Text("\(value)")
                .font(.system(size: 13, weight: .black, design: .monospaced))
                .foregroundColor(color)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(color.opacity(0.1), in: Capsule())
        .overlay(Capsule().stroke(color.opacity(0.25), lineWidth: 1))
    }
}

private struct CategoryScoreBar: View {
    let score:    CategoryScore
    let isWinner: Bool
    let index:    Int
    let appeared: Bool

    private func color(_ s: Int) -> Color {
        if s < 40 { return Color(hex: "4ADE80") }
        if s < 60 { return Color(hex: "FACC15") }
        if s < 80 { return Color(hex: "FB923C") }
        return Color(hex: "F87171")
    }

    var body: some View {
        HStack(spacing: 10) {
            Text(String(score.category.prefix(5)))
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.45))
                .frame(width: 40, alignment: .leading)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.06))
                    Capsule()
                        .fill(color(score.riskScore))
                        .frame(width: appeared ? geo.size.width * CGFloat(score.riskScore) / 100 : 0)
                        .animation(.spring(duration: 0.7, bounce: 0.05).delay(Double(index) * 0.07 + 0.3), value: appeared)
                }
            }
            .frame(height: 8)

            Text("\(score.riskScore)")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(color(score.riskScore))
                .frame(width: 28, alignment: .trailing)
        }
    }
}

// MARK: - Reasons Panel

private struct ReasonsPanel: View {
    let recommendation: ComparisonRecommendation
    let appeared: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(recommendation.reasons.enumerated()), id: \.offset) { idx, reason in
                HStack(alignment: .top, spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(Color(hex: "00C9FF").opacity(0.15))
                            .frame(width: 28, height: 28)
                        Text("\(idx + 1)")
                            .font(.system(size: 12, weight: .black, design: .rounded))
                            .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                    }

                    Text(reason)
                        .font(.system(size: 14, design: .rounded))
                        .foregroundColor(.white.opacity(0.75))
                        .lineSpacing(3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .opacity(appeared ? 1 : 0)
                .offset(x: appeared ? 0 : -20)
                .animation(.spring(duration: 0.5).delay(Double(idx) * 0.1 + 0.3), value: appeared)

                if idx < recommendation.reasons.count - 1 {
                    Divider().background(Color.white.opacity(0.07))
                }
            }
        }
    }
}
