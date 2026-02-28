import SwiftUI

// MARK: - Tab 1: Vendor Overview

struct OverviewTabView: View {
    let overview: VendorOverview
    @State private var appeared = false

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Row 1: Risk distribution donut + resilience gauge side by side
                HStack(alignment: .top, spacing: 20) {
                    DashCard(title: "Risk Distribution", icon: "chart.pie.fill") {
                        RiskDonutChart(slices: overview.riskDistribution)
                            .frame(height: 220)
                    }
                    .frame(maxWidth: .infinity)

                    DashCard(title: "Risk Level & Resilience", icon: "shield.lefthalf.filled") {
                        ResilienceGaugeView(
                            riskLevel:       overview.riskLevel,
                            resilienceScore: overview.resilienceScore,
                            resilienceMax:   overview.resilienceScoreMax,
                            rating:          overview.resilienceRating,
                            factors:         overview.resilienceFactors
                        )
                    }
                    .frame(maxWidth: .infinity)
                }

                // Row 2: Industry info card
                DashCard(title: "Industry Profile", icon: "building.2.fill") {
                    IndustryProfileView(info: overview.industry)
                }

                // Row 3: 12-month risk trend line chart
                DashCard(title: "12-Month Risk Trend", icon: "chart.line.uptrend.xyaxis") {
                    RiskTrendChart(points: overview.riskTrend12m)
                        .frame(height: 180)
                }
            }
            .padding(24)
        }
        .scrollIndicators(.never)
    }
}

// MARK: - Risk Donut Chart

private struct RiskDonutChart: View {
    let slices: [RiskSlice]
    @State private var appeared = false
    @State private var hoveredIndex: Int? = nil

    private let colors: [Color] = [
        Color(hex: "00C9FF"),
        Color(hex: "4FACFE"),
        Color(hex: "667EEA"),
        Color(hex: "92FE9D"),
        Color(hex: "F87171"),
        Color(hex: "FACC15"),
        Color(hex: "FB923C")
    ]

    private var total: Double { slices.reduce(0) { $0 + $1.percentage } }

    var body: some View {
        HStack(spacing: 24) {
            // Donut
            ZStack {
                ForEach(Array(slices.enumerated()), id: \.element.id) { idx, slice in
                    DonutSlice(
                        startAngle: startAngle(for: idx),
                        endAngle:   endAngle(for: idx),
                        isHovered:  hoveredIndex == idx
                    )
                    .fill(colors[idx % colors.count])
                    .shadow(color: colors[idx % colors.count].opacity(hoveredIndex == idx ? 0.6 : 0),
                            radius: 8)
                    .scaleEffect(appeared ? 1 : 0.3)
                    .animation(.spring(duration: 0.7, bounce: 0.2).delay(Double(idx) * 0.08), value: appeared)
                    .onHover { isHovering in
                        withAnimation(.spring(duration: 0.2)) {
                            hoveredIndex = isHovering ? idx : nil
                        }
                    }
                }

                // Center label
                VStack(spacing: 2) {
                    if let hi = hoveredIndex {
                        Text("\(slices[hi].percentage, specifier: "%.1f")%")
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                            .foregroundStyle(
                                LinearGradient(colors: [colors[hi % colors.count], colors[hi % colors.count].opacity(0.7)],
                                               startPoint: .top, endPoint: .bottom)
                            )
                        Text(slices[hi].label)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.6))
                            .multilineTextAlignment(.center)
                    } else {
                        Text("Risk")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.4))
                        Text("Mix")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.4))
                    }
                }
                .animation(.spring(duration: 0.25), value: hoveredIndex)
            }
            .frame(width: 160, height: 160)

            // Legend
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(slices.enumerated()), id: \.element.id) { idx, slice in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(colors[idx % colors.count])
                            .frame(width: 8, height: 8)
                            .shadow(color: colors[idx % colors.count].opacity(0.6), radius: 3)
                        Text(slice.label)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.75))
                        Spacer()
                        Text("\(slice.percentage, specifier: "%.1f")%")
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                            .foregroundColor(.white.opacity(0.9))
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(x: appeared ? 0 : 20)
                    .animation(.spring(duration: 0.5).delay(Double(idx) * 0.07 + 0.3), value: appeared)
                }
            }
        }
        .onAppear { appeared = true }
    }

    private func startAngle(for index: Int) -> Angle {
        var total = 0.0
        for i in 0..<index { total += slices[i].percentage }
        return .degrees(total / self.total * 360 - 90)
    }

    private func endAngle(for index: Int) -> Angle {
        var total = 0.0
        for i in 0...index { total += slices[i].percentage }
        return .degrees(total / self.total * 360 - 90)
    }
}

private struct DonutSlice: Shape {
    let startAngle: Angle
    let endAngle: Angle
    var isHovered: Bool

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let outerRadius = min(rect.width, rect.height) / 2
        let innerRadius = outerRadius * (isHovered ? 0.44 : 0.48)

        path.addArc(center: center, radius: outerRadius, startAngle: startAngle, endAngle: endAngle, clockwise: false)
        path.addArc(center: center, radius: innerRadius, startAngle: endAngle, endAngle: startAngle, clockwise: true)
        path.closeSubpath()
        return path
    }

    var animatableData: Double { isHovered ? 1 : 0 }
}

// MARK: - Resilience Gauge

private struct ResilienceGaugeView: View {
    let riskLevel:       RiskLevel
    let resilienceScore: Int
    let resilienceMax:   Int
    let rating:          ResilienceRating
    let factors:         [ResilienceFactor]
    @State private var appeared = false

    var riskColor: Color {
        switch riskLevel {
        case .low:      Color(hex: "4ADE80")
        case .moderate: Color(hex: "FACC15")
        case .high:     Color(hex: "FB923C")
        case .critical: Color(hex: "F87171")
        }
    }

    var body: some View {
        VStack(spacing: 16) {
            // Big gauge arc
            ZStack {
                // Background arc
                CircularArc(startAngle: .degrees(150), endAngle: .degrees(390))
                    .stroke(Color.white.opacity(0.07), style: StrokeStyle(lineWidth: 14, lineCap: .round))

                // Filled arc
                CircularArc(startAngle: .degrees(150), endAngle: .degrees(150 + 240 * Double(resilienceScore) / Double(resilienceMax)))
                    .trim(from: 0, to: appeared ? 1 : 0)
                    .stroke(
                        LinearGradient(
                            colors: [Color(hex: "00C9FF"), Color(hex: "92FE9D")],
                            startPoint: .leading, endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: 14, lineCap: .round)
                    )
                    .animation(.spring(duration: 1.2, bounce: 0.1).delay(0.2), value: appeared)

                // Center score
                VStack(spacing: 2) {
                    Text("\(resilienceScore)")
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                    Text("/ \(resilienceMax)")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.4))
                }
            }
            .frame(width: 140, height: 100)

            // Risk level badge + resilience rating
            HStack(spacing: 10) {
                RiskBadge(level: riskLevel)
                Text("·")
                    .foregroundColor(.white.opacity(0.3))
                Text(rating.rawValue)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.6))
            }

            Divider().background(Color.white.opacity(0.08))

            // Factor bars
            VStack(spacing: 10) {
                ForEach(Array(factors.enumerated()), id: \.element.id) { idx, factor in
                    ResilienceFactorBar(factor: factor, index: idx, appeared: appeared)
                }
            }
        }
        .onAppear { appeared = true }
    }
}

private struct CircularArc: Shape {
    var startAngle: Angle
    var endAngle: Angle

    func path(in rect: CGRect) -> Path {
        Path { p in
            p.addArc(
                center: CGPoint(x: rect.midX, y: rect.midY),
                radius: min(rect.width, rect.height) / 2,
                startAngle: startAngle,
                endAngle: endAngle,
                clockwise: false
            )
        }
    }
}

private struct ResilienceFactorBar: View {
    let factor: ResilienceFactor
    let index: Int
    let appeared: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(factor.label)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.65))
                Spacer()
                Text("\(factor.score)")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(.white.opacity(0.9))
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.07))
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [Color(hex: "00C9FF"), Color(hex: "92FE9D")],
                                startPoint: .leading, endPoint: .trailing
                            )
                        )
                        .frame(width: appeared ? geo.size.width * CGFloat(factor.score) / 100 : 0)
                        .animation(.spring(duration: 0.8, bounce: 0.05).delay(Double(index) * 0.1 + 0.4), value: appeared)
                }
            }
            .frame(height: 5)
        }
    }
}

// MARK: - Industry Profile

private struct IndustryProfileView: View {
    let info: IndustryInfo
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 16) {
            // Description
            Text(info.description)
                .font(.system(size: 14, design: .rounded))
                .foregroundColor(.white.opacity(0.7))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            Divider().background(Color.white.opacity(0.08))

            // Stats grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                IndustryStat(label: "Sector",     value: info.sector,             icon: "cpu")
                IndustryStat(label: "Sub-Sector", value: info.subSector,          icon: "puzzlepiece.fill")
                IndustryStat(label: "HQ Country", value: info.hqCountry,          icon: "globe")
                IndustryStat(label: "Employees",  value: info.employeeCountRange,  icon: "person.3.fill")
                IndustryStat(label: "Revenue",    value: info.revenueRangeUsd,     icon: "dollarsign.circle.fill")
                IndustryStat(label: "Founded",    value: "\(info.foundedYear)",    icon: "calendar")
            }
        }
        .onAppear { appeared = true }
    }
}

private struct IndustryStat: View {
    let label: String
    let value: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 11))
                    .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                Text(label)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.45))
            }
            Text(value)
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundColor(.white.opacity(0.9))
                .lineLimit(2)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.white.opacity(0.07), lineWidth: 1))
    }
}

// MARK: - Risk Trend Line Chart

private struct RiskTrendChart: View {
    let points: [RiskTrendPoint]
    @State private var appeared = false
    @State private var hoveredIndex: Int? = nil

    private var minScore: Double { Double(points.map(\.riskScore).min() ?? 0) }
    private var maxScore: Double { Double(points.map(\.riskScore).max() ?? 100) }

    private func normalised(_ score: Int, in height: CGFloat) -> CGFloat {
        let range = maxScore - minScore
        guard range > 0 else { return height / 2 }
        return height - (CGFloat(score) - CGFloat(minScore)) / CGFloat(range) * height * 0.85 - height * 0.075
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let step = w / CGFloat(max(points.count - 1, 1))

            ZStack(alignment: .topLeading) {
                // Grid lines
                ForEach([25, 50, 75], id: \.self) { val in
                    let y = normalised(val, in: h)
                    Path { p in
                        p.move(to: CGPoint(x: 0, y: y))
                        p.addLine(to: CGPoint(x: w, y: y))
                    }
                    .stroke(Color.white.opacity(0.05), style: StrokeStyle(lineWidth: 1, dash: [4]))
                }

                // Gradient fill area
                Path { p in
                    guard points.count > 1 else { return }
                    p.move(to: CGPoint(x: 0, y: h))
                    for (i, pt) in points.enumerated() {
                        let x = CGFloat(i) * step
                        let y = normalised(pt.riskScore, in: h)
                        if i == 0 { p.addLine(to: CGPoint(x: x, y: y)) }
                        else { p.addLine(to: CGPoint(x: x, y: y)) }
                    }
                    p.addLine(to: CGPoint(x: CGFloat(points.count - 1) * step, y: h))
                    p.closeSubpath()
                }
                .fill(
                    LinearGradient(
                        colors: [Color(hex: "00C9FF").opacity(0.25), Color.clear],
                        startPoint: .top, endPoint: .bottom
                    )
                )

                // Line
                Path { p in
                    guard points.count > 1 else { return }
                    for (i, pt) in points.enumerated() {
                        let x = CGFloat(i) * step
                        let y = normalised(pt.riskScore, in: h)
                        if i == 0 { p.move(to: CGPoint(x: x, y: y)) }
                        else { p.addLine(to: CGPoint(x: x, y: y)) }
                    }
                }
                .trim(from: 0, to: appeared ? 1 : 0)
                .stroke(
                    LinearGradient(
                        colors: [Color(hex: "00C9FF"), Color(hex: "92FE9D")],
                        startPoint: .leading, endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
                )
                .animation(.easeInOut(duration: 1.2).delay(0.1), value: appeared)

                // Data points + hover
                ForEach(Array(points.enumerated()), id: \.element.id) { i, pt in
                    let x = CGFloat(i) * step
                    let y = normalised(pt.riskScore, in: h)

                    ZStack {
                        if hoveredIndex == i {
                            // Tooltip
                            VStack(spacing: 2) {
                                Text("\(pt.riskScore)")
                                    .font(.system(size: 14, weight: .bold, design: .monospaced))
                                    .foregroundColor(.white)
                                Text(formatMonth(pt.month))
                                    .font(.system(size: 10, weight: .medium, design: .rounded))
                                    .foregroundColor(.white.opacity(0.55))
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.15), lineWidth: 1))
                            .offset(y: y < 60 ? 30 : -52)
                            .transition(.opacity.combined(with: .scale(scale: 0.85)))
                        }

                        Circle()
                            .fill(Color(hex: "00C9FF"))
                            .frame(width: hoveredIndex == i ? 10 : 6,
                                   height: hoveredIndex == i ? 10 : 6)
                            .shadow(color: Color(hex: "00C9FF").opacity(0.8), radius: hoveredIndex == i ? 6 : 3)
                            .onHover { isHovering in
                                withAnimation(.spring(duration: 0.2)) {
                                    hoveredIndex = isHovering ? i : nil
                                }
                            }
                    }
                    .position(x: x, y: y)
                    .opacity(appeared ? 1 : 0)
                    .animation(.spring(duration: 0.4).delay(Double(i) * 0.06 + 0.8), value: appeared)
                }

                // X-axis month labels (every 3 months)
                ForEach(Array(points.enumerated()), id: \.element.id) { i, pt in
                    if i % 3 == 0 {
                        Text(formatMonth(pt.month))
                            .font(.system(size: 10, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.35))
                            .position(x: CGFloat(i) * step, y: h + 12)
                    }
                }
            }
            .padding(.bottom, 24)
        }
        .onAppear { appeared = true }
    }

    private func formatMonth(_ month: String) -> String {
        let parts = month.split(separator: "-")
        guard parts.count == 2, let m = Int(parts[1]) else { return month }
        let names = ["", "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        return m < names.count ? names[m] : month
    }
}
