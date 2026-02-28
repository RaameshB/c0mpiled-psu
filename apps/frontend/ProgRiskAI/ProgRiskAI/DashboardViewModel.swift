import SwiftUI

// MARK: - DashboardViewModel

@Observable @MainActor
final class DashboardViewModel {

    enum LoadState {
        case loading
        case loaded
        case failed(String)
    }

    // MARK: State

    var loadState: LoadState = .loading
    var selectedTab: Int = 0

    var overview:     VendorOverview?
    var dependencies: DependencyResponse?
    var breakdown:    RiskBreakdown?
    var comparison:   ComparisonResponse?

    let vendorName: String
    private let vendorId = "vnd_mock001"

    // MARK: Init

    init(vendorName: String) {
        self.vendorName = vendorName
    }

    // MARK: Load

    func load() async {
        loadState = .loading

        // Fetch all four tabs in parallel — simulated 2s delay comes from MockDataService
        async let overviewTask     = MockDataService.shared.fetchOverview(vendorId: vendorId, vendorName: vendorName)
        async let dependenciesTask = MockDataService.shared.fetchDependencies(vendorId: vendorId)
        async let breakdownTask    = MockDataService.shared.fetchRiskBreakdown(vendorId: vendorId)
        async let comparisonTask   = MockDataService.shared.fetchComparison(primaryVendor: vendorName)

        let (ov, dep, brk, cmp) = await (overviewTask, dependenciesTask, breakdownTask, comparisonTask)

        self.overview     = ov
        self.dependencies = dep
        self.breakdown    = brk
        self.comparison   = cmp

        withAnimation(.spring(duration: 0.6)) {
            loadState = .loaded
        }
    }
}
