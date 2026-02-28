import SwiftUI

// MARK: - Tab 2: Tier 2/3 Dependencies

struct DependenciesTabView: View {
    let data: DependencyResponse
    @State private var appeared = false
    @State private var expandedSupplier: String? = nil

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                // Summary stats strip
                DashCard(title: "Supply Chain Overview", icon: "square.3.layers.3d") {
                    DependencySummaryStrip(summary: data.summary, appeared: appeared)
                }

                // Concentration risks
                if !data.concentrationRisks.isEmpty {
                    DashCard(title: "Concentration Risks", icon: "exclamationmark.triangle.fill") {
                        VStack(spacing: 12) {
                            ForEach(Array(data.concentrationRisks.enumerated()), id: \.element.id) { idx, risk in
                                ConcentrationRiskCard(risk: risk, index: idx, appeared: appeared)
                            }
                        }
                    }
                }

                // Tier 2/3 supplier tree
                DashCard(title: "Supplier Tree", icon: "list.triangle") {
                    VStack(spacing: 0) {
                        ForEach(Array(data.tier2Suppliers.enumerated()), id: \.element.id) { idx, supplier in
                            Tier2SupplierRow(
                                supplier:         supplier,
                                index:            idx,
                                isExpanded:       expandedSupplier == supplier.id,
                                appeared:         appeared
                            ) {
                                withAnimation(.spring(duration: 0.4, bounce: 0.1)) {
                                    expandedSupplier = expandedSupplier == supplier.id ? nil : supplier.id
                                }
                            }

                            if idx < data.tier2Suppliers.count - 1 {
                                Divider()
                                    .background(Color.white.opacity(0.06))
                                    .padding(.leading, 52)
                            }
                        }
                    }
                }
            }
            .padding(24)
        }
        .scrollIndicators(.never)
        .onAppear {
            withAnimation(.spring(duration: 0.6).delay(0.15)) {
                appeared = true
            }
        }
    }
}

// MARK: - Summary Strip

private struct DependencySummaryStrip: View {
    let summary: DependencySummary
    let appeared: Bool

    var stats: [(String, String, String)] {
        [
            ("Tier 2", "\(summary.tier2Count)", "square.2.layers.3d.fill"),
            ("Tier 3", "\(summary.tier3Count)", "square.3.layers.3d.fill"),
            ("Countries", "\(summary.countriesRepresented)", "globe"),
            ("Sectors", "\(summary.sectorsRepresented)", "cpu"),
            ("Critical", "\(summary.criticalDependencyCount)", "exclamationmark.triangle.fill")
        ]
    }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(stats.enumerated()), id: \.offset) { idx, stat in
                VStack(spacing: 6) {
                    Image(systemName: stat.2)
                        .font(.system(size: 18))
                        .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                    Text(stat.1)
                        .font(.system(size: 26, weight: .black, design: .rounded))
                        .foregroundColor(.white)
                    Text(stat.0)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.45))
                }
                .frame(maxWidth: .infinity)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 16)
                .animation(.spring(duration: 0.5).delay(Double(idx) * 0.08), value: appeared)

                if idx < stats.count - 1 {
                    Divider()
                        .frame(height: 40)
                        .background(Color.white.opacity(0.1))
                }
            }
        }
    }
}

// MARK: - Concentration Risk Card

private struct ConcentrationRiskCard: View {
    let risk: ConcentrationRisk
    let index: Int
    let appeared: Bool
    @State private var isExpanded = false

    var severityColor: Color {
        switch risk.severity {
        case .low:      Color(hex: "4ADE80")
        case .moderate: Color(hex: "FACC15")
        case .high:     Color(hex: "FB923C")
        case .critical: Color(hex: "F87171")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { withAnimation(.spring(duration: 0.35)) { isExpanded.toggle() } }) {
                HStack(spacing: 12) {
                    // Severity indicator
                    RoundedRectangle(cornerRadius: 3)
                        .fill(severityColor)
                        .frame(width: 4, height: 36)
                        .shadow(color: severityColor.opacity(0.6), radius: 4)

                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 8) {
                            Text(risk.label)
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(.white.opacity(0.9))
                            Spacer()
                            RiskBadge(level: risk.severity)
                        }
                    }

                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.4))
                }
            }
            .buttonStyle(.plain)

            if isExpanded {
                    Text(risk.description)
                        .font(.system(size: 14, design: .rounded))
                    .foregroundColor(.white.opacity(0.6))
                    .lineSpacing(4)
                    .padding(.top, 12)
                    .padding(.leading, 16)
                    .transition(.opacity.combined(with: .offset(y: -8)))
            }
        }
        .padding(14)
        .glassEffect(in: .rect(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(severityColor.opacity(0.3), lineWidth: 1))
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 20)
        .animation(.spring(duration: 0.5).delay(Double(index) * 0.1), value: appeared)
    }
}

// MARK: - Tier 2 Supplier Row

private struct Tier2SupplierRow: View {
    let supplier: Tier2Supplier
    let index: Int
    let isExpanded: Bool
    let appeared: Bool
    let onTap: () -> Void

    var riskColor: Color { riskLevelColor(supplier.riskLevel) }

    var body: some View {
        VStack(spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: 14) {
                    // Risk dot
                    ZStack {
                        Circle()
                            .fill(riskColor.opacity(0.15))
                            .frame(width: 36, height: 36)
                        Circle()
                            .fill(riskColor)
                            .frame(width: 10, height: 10)
                            .shadow(color: riskColor.opacity(0.8), radius: 4)
                    }

                    VStack(alignment: .leading, spacing: 3) {
                        Text(supplier.name)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(.white.opacity(0.95))
                        HStack(spacing: 8) {
                            Label(supplier.country, systemImage: "globe")
                            Text("·")
                            Label(supplier.sector, systemImage: "cpu")
                            Text("·")
                            Label(supplier.dependencyType, systemImage: "link")
                        }
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.45))
                        .lineLimit(1)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        RiskBadge(level: supplier.criticality)

                        if !supplier.tier3Suppliers.isEmpty {
                            HStack(spacing: 3) {
                    Text("\(supplier.tier3Suppliers.count) Tier 3")
                                .font(.system(size: 11, weight: .medium, design: .rounded))
                                    .foregroundColor(.white.opacity(0.35))
                                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                                    .font(.system(size: 9))
                                    .foregroundColor(.white.opacity(0.35))
                            }
                        }
                    }
                }
                .padding(.vertical, 14)
                .padding(.horizontal, 4)
            }
            .buttonStyle(.plain)

            // Tier 3 suppliers (expanded)
            if isExpanded && !supplier.tier3Suppliers.isEmpty {
                VStack(spacing: 0) {
                    ForEach(Array(supplier.tier3Suppliers.enumerated()), id: \.element.id) { idx, t3 in
                        HStack(spacing: 0) {
                            // Tree line
                            VStack {
                                Rectangle()
                                    .fill(Color.white.opacity(0.1))
                                    .frame(width: 1)
                                    .frame(maxHeight: .infinity)
                            }
                            .frame(width: 18)
                            Rectangle()
                                .fill(Color.white.opacity(0.1))
                                .frame(width: 12, height: 1)
                                .offset(y: 0)

                            Tier3SupplierRow(supplier: t3, index: idx)
                                .frame(maxWidth: .infinity)
                        }
                        .padding(.leading, 34)

                        if idx < supplier.tier3Suppliers.count - 1 {
                            Divider()
                                .background(Color.white.opacity(0.04))
                                .padding(.leading, 64)
                        }
                    }
                }
                .background(Color.white.opacity(0.025), in: RoundedRectangle(cornerRadius: 12))
                .padding(.bottom, 8)
                .transition(.opacity.combined(with: .offset(y: -10)))
            }
        }
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 20)
        .animation(.spring(duration: 0.5).delay(Double(index) * 0.07 + 0.2), value: appeared)
    }
}

// MARK: - Tier 3 Row

private struct Tier3SupplierRow: View {
    let supplier: Tier3Supplier
    let index: Int

    var riskColor: Color { riskLevelColor(supplier.riskLevel) }

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(riskColor)
                .frame(width: 7, height: 7)
                .shadow(color: riskColor.opacity(0.6), radius: 3)

            VStack(alignment: .leading, spacing: 2) {
                Text(supplier.name)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.8))
                HStack(spacing: 6) {
                    Text(supplier.country)
                    Text("·")
                    Text(supplier.sector)
                }
                .font(.system(size: 12, design: .rounded))
                .foregroundColor(.white.opacity(0.4))
            }

            Spacer()

            RiskBadge(level: supplier.riskLevel)
                .scaleEffect(0.85)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 8)
    }
}

// MARK: - Helpers

func riskLevelColor(_ level: RiskLevel) -> Color {
    switch level {
    case .low:      Color(hex: "4ADE80")
    case .moderate: Color(hex: "FACC15")
    case .high:     Color(hex: "FB923C")
    case .critical: Color(hex: "F87171")
    }
}
