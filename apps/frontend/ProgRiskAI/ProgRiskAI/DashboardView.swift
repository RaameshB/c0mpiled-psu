import SwiftUI

// MARK: - DashboardView

struct DashboardView: View {
    let vendorName: String
    let onBack: () -> Void

    @State private var vm: DashboardViewModel
    @State private var appeared = false

    init(vendorName: String, onBack: @escaping () -> Void) {
        self.vendorName = vendorName
        self.onBack = onBack
        _vm = State(initialValue: DashboardViewModel(vendorName: vendorName))
    }

    private let tabs = ["Overview", "Dependencies", "Risk Breakdown", "Comparison"]
    private let tabIcons = ["chart.pie.fill", "square.3.layers.3d", "chart.bar.xaxis", "arrow.triangle.swap"]

    var body: some View {
        ZStack {
            // Background
            DesignSystem.Gradients.mainBackground
                .ignoresSafeArea()

            // Ambient glow orbs
            ambientBackground

            VStack(spacing: 0) {
                // Top header bar
                headerBar
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : -20)

                // Custom tab picker
                tabPicker
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : -10)

                Divider()
                    .background(Color.white.opacity(0.08))

                // Tab content
                tabContent
                    .opacity(appeared ? 1 : 0)
            }
        }
        .task { await vm.load() }
        .onAppear {
            withAnimation(.spring(duration: 0.7, bounce: 0.1).delay(0.1)) {
                appeared = true
            }
        }
        // Keyboard shortcuts: 1–4 for tabs, Cmd+W to go back
        .keyboardShortcut("1", modifiers: []) { vm.selectedTab = 0 }
        .keyboardShortcut("2", modifiers: []) { vm.selectedTab = 1 }
        .keyboardShortcut("3", modifiers: []) { vm.selectedTab = 2 }
        .keyboardShortcut("4", modifiers: []) { vm.selectedTab = 3 }
        .keyboardShortcut("[", modifiers: .command) {
            let prev = max(0, vm.selectedTab - 1)
            withAnimation(.spring(duration: 0.4, bounce: 0.1)) { vm.selectedTab = prev }
        }
        .keyboardShortcut("]", modifiers: .command) {
            let next = min(3, vm.selectedTab + 1)
            withAnimation(.spring(duration: 0.4, bounce: 0.1)) { vm.selectedTab = next }
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack(spacing: 16) {
            Button(action: onBack) {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                    Text("New Search")
                        .font(.system(size: 14, weight: .medium, design: .rounded))
                }
                .foregroundColor(.white.opacity(0.6))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.07), in: Capsule())
                .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 1))
            }
            .keyboardShortcut("w", modifiers: .command)
            .buttonStyle(.plain)

            Spacer()

            // Vendor name + badge
            VStack(alignment: .trailing, spacing: 2) {
                Text(vendorName)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundStyle(DesignSystem.Gradients.primaryAccent)

                if let ov = vm.overview {
                    RiskBadge(level: ov.riskLevel)
                }
            }

            // Shield logo
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 44, height: 44)
                ProgRiskAIShape()
                    .fill(DesignSystem.Gradients.primaryAccent)
                    .frame(width: 24, height: 24)
            }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
    }

    // MARK: - Tab Picker

    private var tabPicker: some View {
        HStack(spacing: 0) {
            ForEach(Array(tabs.enumerated()), id: \.offset) { index, title in
                TabButton(
                    title: title,
                    icon: tabIcons[index],
                    index: index,
                    isSelected: vm.selectedTab == index
                ) {
                    withAnimation(.spring(duration: 0.4, bounce: 0.1)) {
                        vm.selectedTab = index
                    }
                }
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 4)
        .padding(.bottom, 2)
    }

    // MARK: - Tab Content

    @ViewBuilder
    private var tabContent: some View {
        switch vm.loadState {
        case .loading:
            Spacer()
            DashboardSkeletonView()
            Spacer()

        case .loaded:
            tabPages

        case .failed(let msg):
            Spacer()
            ErrorView(message: msg, onRetry: { Task { await vm.load() } })
            Spacer()
        }
    }

    @ViewBuilder
    private var tabPages: some View {
        // Use a ZStack with opacity so transitions are smooth
        ZStack {
            if vm.selectedTab == 0, let ov = vm.overview {
                OverviewTabView(overview: ov)
                    .transition(.asymmetric(
                        insertion:  .opacity.combined(with: .offset(x: 30)),
                        removal:    .opacity.combined(with: .offset(x: -30))
                    ))
                    .id("tab0")
            }
            if vm.selectedTab == 1, let dep = vm.dependencies {
                DependenciesTabView(data: dep)
                    .transition(.asymmetric(
                        insertion:  .opacity.combined(with: .offset(x: 30)),
                        removal:    .opacity.combined(with: .offset(x: -30))
                    ))
                    .id("tab1")
            }
            if vm.selectedTab == 2, let brk = vm.breakdown {
                RiskBreakdownTabView(data: brk)
                    .transition(.asymmetric(
                        insertion:  .opacity.combined(with: .offset(x: 30)),
                        removal:    .opacity.combined(with: .offset(x: -30))
                    ))
                    .id("tab2")
            }
            if vm.selectedTab == 3, let cmp = vm.comparison {
                ComparisonTabView(data: cmp, primaryVendorName: vendorName)
                    .transition(.asymmetric(
                        insertion:  .opacity.combined(with: .offset(x: 30)),
                        removal:    .opacity.combined(with: .offset(x: -30))
                    ))
                    .id("tab3")
            }
        }
        .animation(.spring(duration: 0.4, bounce: 0.05), value: vm.selectedTab)
    }

    // MARK: - Ambient Background

    private var ambientBackground: some View {
        ZStack {
            Circle()
                .fill(DesignSystem.Colors.t1TopStart.opacity(0.06))
                .frame(width: 600, height: 600)
                .blur(radius: 100)
                .offset(x: -200, y: -200)
            Circle()
                .fill(DesignSystem.Colors.t1BRStart.opacity(0.06))
                .frame(width: 500, height: 500)
                .blur(radius: 100)
                .offset(x: 300, y: 400)
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Tab Button

private struct TabButton: View {
    let title: String
    let icon: String
    let index: Int
    let isSelected: Bool
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                HStack(spacing: 7) {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                    Text(title)
                        .font(.system(size: 16, weight: .semibold, design: .rounded))

                    // Keyboard shortcut hint
                    Text("\(index + 1)")
                        .font(.system(size: 10, weight: .bold, design: .monospaced))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.white.opacity(isSelected ? 0.15 : 0.06), in: RoundedRectangle(cornerRadius: 4))
                        .foregroundColor(.white.opacity(isSelected ? 0.9 : 0.3))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .foregroundStyle(isSelected
                    ? AnyShapeStyle(DesignSystem.Gradients.primaryAccent)
                    : AnyShapeStyle(Color.white.opacity(isHovered ? 0.7 : 0.45))
                )

                // Active indicator bar
                Rectangle()
                    .fill(isSelected
                        ? AnyShapeStyle(DesignSystem.Gradients.primaryAccent)
                        : AnyShapeStyle(Color.clear)
                    )
                    .frame(height: 2)
                    .clipShape(Capsule())
            }
        }
        .buttonStyle(.plain)
        .onHover { isHovered = $0 }
        .animation(.spring(duration: 0.3), value: isSelected)
    }
}

// MARK: - Risk Badge

struct RiskBadge: View {
    let level: RiskLevel

    var color: Color {
        switch level {
        case .low:      Color(hex: "4ADE80")
        case .moderate: Color(hex: "FACC15")
        case .high:     Color(hex: "FB923C")
        case .critical: Color(hex: "F87171")
        }
    }

    var body: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
                .shadow(color: color.opacity(0.8), radius: 4)
            Text(level.rawValue.uppercased())
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(color)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(color.opacity(0.12), in: Capsule())
        .overlay(Capsule().stroke(color.opacity(0.3), lineWidth: 1))
    }
}

// MARK: - Skeleton Loading

private struct DashboardSkeletonView: View {
    @State private var shimmer = false

    var body: some View {
        VStack(spacing: 20) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white.opacity(shimmer ? 0.07 : 0.03))
                    .frame(maxWidth: .infinity)
                    .frame(height: 120)
                    .padding(.horizontal, 24)
            }
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                shimmer = true
            }
        }
    }
}

// MARK: - Error View

private struct ErrorView: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 40))
                .foregroundStyle(DesignSystem.Gradients.tertiaryAccent)
            Text("Something went wrong")
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(.white)
            Text(message)
                .font(.system(size: 14))
                .foregroundColor(.white.opacity(0.5))
                .multilineTextAlignment(.center)
            Button("Try Again", action: onRetry)
                .buttonStyle(.plain)
                .padding(.horizontal, 24)
                .padding(.vertical, 10)
                .background(DesignSystem.Gradients.primaryAccent, in: Capsule())
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundColor(.black)
        }
        .padding(40)
    }
}

// MARK: - Shared Card Style

struct DashCard<Content: View>: View {
    var title: String? = nil
    var icon: String? = nil
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let title {
                HStack(spacing: 8) {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                    }
                    Text(title)
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundColor(.white.opacity(0.9))
                    Spacer()
                }
            }
            content
        }
        .padding(20)
        .glassEffect(in: .rect(cornerRadius: 20))
    }
}

// MARK: - View Extension: Keyboard Shortcut with Closure

extension View {
    func keyboardShortcut(_ key: KeyEquivalent, modifiers: EventModifiers = .command, action: @escaping () -> Void) -> some View {
        self.background(
            Button("") { action() }
                .keyboardShortcut(key, modifiers: modifiers)
                .opacity(0)
                .allowsHitTesting(false)
        )
    }
}

#Preview {
    DashboardView(vendorName: "Acme Corp", onBack: {})
}
