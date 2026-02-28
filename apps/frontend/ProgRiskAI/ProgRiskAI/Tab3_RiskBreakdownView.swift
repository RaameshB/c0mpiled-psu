import SwiftUI

// MARK: - Tab 3: Risk Breakdown

struct RiskBreakdownTabView: View {
    let data: RiskBreakdown
    @State private var appeared = false
    @State private var expandedCategory: String? = nil

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Overall score header card
                DashCard {
                    OverallRiskHeader(
                        riskScore:       data.overallRiskScore,
                        riskLevel:       data.overallRiskLevel,
                        resilienceScore: data.overallResilienceScore,
                        appeared:        appeared
                    )
                }

                // Category breakdown cards
                DashCard(title: "Category Breakdown", icon: "chart.bar.xaxis") {
                    VStack(spacing: 0) {
                        ForEach(Array(data.categories.enumerated()), id: \.element.id) { idx, category in
                            RiskCategoryRow(
                                category:   category,
                                index:      idx,
                                isExpanded: expandedCategory == category.id,
                                appeared:   appeared
                            ) {
                                withAnimation(.spring(duration: 0.4, bounce: 0.1)) {
                                    expandedCategory = expandedCategory == category.id ? nil : category.id
                                }
                            }

                            if idx < data.categories.count - 1 {
                                Divider()
                                    .background(Color.white.opacity(0.07))
                            }
                        }
                    }
                }

                // Dual-axis overview chart: risk vs resilience per category
                DashCard(title: "Risk vs Resilience by Category", icon: "arrow.left.arrow.right") {
                    DualAxisChart(categories: data.categories, appeared: appeared)
                        .frame(height: 220)
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

// MARK: - Overall Risk Header

private struct OverallRiskHeader: View {
    let riskScore:       Int
    let riskLevel:       RiskLevel
    let resilienceScore: Int
    let appeared:        Bool

    var riskColor: Color { riskLevelColor(.critical) }

    var body: some View {
        HStack(spacing: 0) {
            // Risk score
            VStack(spacing: 8) {
                    Text("Overall Risk")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.5))

                ZStack {
                    Circle()
                        .stroke(riskColor.opacity(0.15), lineWidth: 8)
                        .frame(width: 100, height: 100)
                    Circle()
                        .trim(from: 0, to: appeared ? CGFloat(riskScore) / 100 : 0)
                        .stroke(riskColor, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .frame(width: 100, height: 100)
                        .rotationEffect(.degrees(-90))
                        .shadow(color: riskColor.opacity(0.5), radius: 6)
                        .animation(.spring(duration: 1.2, bounce: 0.1).delay(0.15), value: appeared)

                    VStack(spacing: 0) {
                        Text("\(riskScore)")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundColor(riskColor)
                        Text("/ 100")
                            .font(.system(size: 11, design: .rounded))
                            .foregroundColor(.white.opacity(0.35))
                    }
                }

                RiskBadge(level: riskLevel)
            }
            .frame(maxWidth: .infinity)

            // Divider
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(width: 1, height: 100)

            // Resilience score
            VStack(spacing: 8) {
                    Text("Overall Resilience")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.5))

                ZStack {
                    Circle()
                        .stroke(Color(hex: "00C9FF").opacity(0.15), lineWidth: 8)
                        .frame(width: 100, height: 100)
                    Circle()
                        .trim(from: 0, to: appeared ? CGFloat(resilienceScore) / 100 : 0)
                        .stroke(
                            LinearGradient(
                                colors: [Color(hex: "00C9FF"), Color(hex: "92FE9D")],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            ),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .frame(width: 100, height: 100)
                        .rotationEffect(.degrees(-90))
                        .shadow(color: Color(hex: "00C9FF").opacity(0.4), radius: 6)
                        .animation(.spring(duration: 1.2, bounce: 0.1).delay(0.3), value: appeared)

                    VStack(spacing: 0) {
                        Text("\(resilienceScore)")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                        Text("/ 100")
                            .font(.system(size: 11, design: .rounded))
                            .foregroundColor(.white.opacity(0.35))
                    }
                }

                Text("Resilience Score")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(hex: "00C9FF").opacity(0.8))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color(hex: "00C9FF").opacity(0.12), in: Capsule())
                    .overlay(Capsule().stroke(Color(hex: "00C9FF").opacity(0.3), lineWidth: 1))
            }
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Risk Category Row

private struct RiskCategoryRow: View {
    let category:   RiskCategory
    let index:      Int
    let isExpanded: Bool
    let appeared:   Bool
    let onTap:      () -> Void

    var riskColor: Color { riskLevelColor(.moderate) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Main row
            Button(action: onTap) {
                HStack(spacing: 14) {
                    // Category icon circle
                    ZStack {
                        Circle()
                            .fill(riskColor.opacity(0.1))
                            .frame(width: 40, height: 40)
                        Image(systemName: categoryIcon(category.id))
                            .font(.system(size: 16))
                            .foregroundColor(riskColor)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                    Text(category.label)
                        .font(.system(size: 16, weight: .semibold, design: .rounded))
                                .foregroundColor(.white.opacity(0.95))
                            Spacer()
                            RiskBadge(level: category.riskLevel)
                        }

                        // Dual mini-bars
                        VStack(spacing: 4) {
                            MiniBar(label: "Risk",       value: category.riskScore,       color: riskColor,              appeared: appeared, delay: Double(index) * 0.08)
                            MiniBar(label: "Resilience", value: category.resilienceScore, color: Color(hex: "00C9FF"),    appeared: appeared, delay: Double(index) * 0.08 + 0.1)
                        }
                    }

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.3))
                        .frame(width: 20)
                }
                .padding(.vertical, 16)
                .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)

            // Expanded: description + sub-categories
            if isExpanded {
                VStack(alignment: .leading, spacing: 14) {
                    Text(category.description)
                        .font(.system(size: 14, design: .rounded))
                        .foregroundColor(.white.opacity(0.6))
                        .lineSpacing(4)
                        .padding(.leading, 54)

                    if !category.subCategories.isEmpty {
                        VStack(spacing: 10) {
                            ForEach(Array(category.subCategories.enumerated()), id: \.element.id) { idx, sub in
                                SubCategoryCard(sub: sub, riskColor: riskColor, index: idx)
                            }
                        }
                        .padding(.leading, 54)
                    }
                }
                .padding(.bottom, 16)
                .transition(.opacity.combined(with: .offset(y: -12)))
            }
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 20)
        .animation(.spring(duration: 0.5).delay(Double(index) * 0.08 + 0.1), value: appeared)
    }

    private func categoryIcon(_ id: String) -> String {
        switch id {
        case "geopolitical": return "globe.europe.africa.fill"
        case "financial":    return "chart.line.downtrend.xyaxis"
        case "operational":  return "gearshape.2.fill"
        case "cybersecurity":return "lock.shield.fill"
        case "regulatory":   return "doc.text.fill"
        default:             return "circle.fill"
        }
    }
}

private struct MiniBar: View {
    let label: String
    let value: Int
    let color: Color
    let appeared: Bool
    let delay: Double

    var body: some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 10, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.4))
                .frame(width: 58, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.07))
                    Capsule()
                        .fill(color)
                        .frame(width: appeared ? geo.size.width * CGFloat(value) / 100 : 0)
                        .animation(.spring(duration: 0.8, bounce: 0.05).delay(delay), value: appeared)
                }
            }
            .frame(height: 5)
            Text("\(value)")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundColor(.white.opacity(0.75))
                .frame(width: 24, alignment: .trailing)
        }
    }
}

// MARK: - Sub-category Card

private struct SubCategoryCard: View {
    let sub: RiskSubCategory
    let riskColor: Color
    let index: Int
    @State private var appeared = false

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(riskColor)
                .frame(width: 3, height: 36)
                .shadow(color: riskColor.opacity(0.5), radius: 3)

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(sub.label)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundColor(.white.opacity(0.85))
                    Spacer()
                    Text("\(sub.riskScore)")
                        .font(.system(size: 14, weight: .black, design: .monospaced))
                        .foregroundColor(riskColor)
                }
                Text(sub.description)
                    .font(.system(size: 13, design: .rounded))
                    .foregroundColor(.white.opacity(0.5))
                    .lineSpacing(3)
                    .lineLimit(3)
            }
        }
        .padding(12)
        .glassEffect(in: .rect(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(riskColor.opacity(0.2), lineWidth: 1)
        )
        .opacity(appeared ? 1 : 0)
        .offset(x: appeared ? 0 : -16)
        .animation(.spring(duration: 0.4).delay(Double(index) * 0.07), value: appeared)
        .onAppear { appeared = true }
    }
}

// MARK: - Dual Axis Chart

private struct DualAxisChart: View {
    let categories: [RiskCategory]
    let appeared: Bool

    private let riskGrad = LinearGradient(colors: [Color(hex: "FB923C"), Color(hex: "F87171")], startPoint: .bottom, endPoint: .top)
    private let resilGrad = LinearGradient(colors: [Color(hex: "4FACFE"), Color(hex: "00C9FF")], startPoint: .bottom, endPoint: .top)

    var body: some View {
        VStack(spacing: 12) {
            GeometryReader { geo in
                let barWidth = (geo.size.width - CGFloat(categories.count + 1) * 16) / CGFloat(categories.count * 2)
                let h = geo.size.height

                HStack(alignment: .bottom, spacing: 16) {
                    ForEach(Array(categories.enumerated()), id: \.element.id) { idx, cat in
                        HStack(alignment: .bottom, spacing: 4) {
                            // Risk bar
                            VStack(spacing: 0) {
                                Spacer()
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(riskGrad)
                                    .frame(width: barWidth, height: appeared ? h * CGFloat(cat.riskScore) / 100 : 0)
                                    .shadow(color: Color(hex: "FB923C").opacity(0.4), radius: 6)
                                    .animation(.spring(duration: 0.8, bounce: 0.1).delay(Double(idx) * 0.1), value: appeared)
                            }
                            .frame(height: h)

                            // Resilience bar
                            VStack(spacing: 0) {
                                Spacer()
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(resilGrad)
                                    .frame(width: barWidth, height: appeared ? h * CGFloat(cat.resilienceScore) / 100 : 0)
                                    .shadow(color: Color(hex: "00C9FF").opacity(0.4), radius: 6)
                                    .animation(.spring(duration: 0.8, bounce: 0.1).delay(Double(idx) * 0.1 + 0.05), value: appeared)
                            }
                            .frame(height: h)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }

            // X-axis labels
            HStack {
                ForEach(categories, id: \.id) { cat in
                    Text(String(cat.label.prefix(4)))
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.4))
                        .frame(maxWidth: .infinity)
                }
            }

            // Legend
            HStack(spacing: 20) {
                LegendDot(color: Color(hex: "FB923C"), label: "Risk Score")
                LegendDot(color: Color(hex: "00C9FF"), label: "Resilience Score")
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
    }
}

private struct LegendDot: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 2)
                .fill(color)
                .frame(width: 12, height: 5)
            Text(label)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(.white.opacity(0.5))
        }
    }
}
