//
//  ContentView.swift
//  ProgRiskAI
//
//  Created by Ryan Nair on 2/27/26.
//

import SwiftUI

struct ContentView: View {
    @State private var showSplashScreen = true
    @State private var submittedVendor: String? = nil
    @State private var dashboardReady  = false

    var body: some View {
        ZStack {
            DesignSystem.Gradients.mainBackground
                .ignoresSafeArea()

            if showSplashScreen {
                SplashScreen(showSplashScreen: $showSplashScreen)
                    .transition(.opacity)

            } else if dashboardReady, let vendor = submittedVendor {
                DashboardView(vendorName: vendor) {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        dashboardReady  = false
                        submittedVendor = nil
                    }
                }
                .transition(.opacity.combined(with: .scale(scale: 0.96)))

            } else if let vendor = submittedVendor {
                VendorLoadingView(vendorName: vendor) {
                    withAnimation(.spring(duration: 0.7, bounce: 0.15)) {
                        dashboardReady = true
                    }
                }
                .transition(.opacity.combined(with: .scale(scale: 0.9)))

            } else {
                VendorEntryView { vendorName in
                    withAnimation(.easeInOut(duration: 0.6)) {
                        submittedVendor = vendorName
                    }
                }
                .transition(.opacity.combined(with: .scale(scale: 1.1)))
            }
        }
        .animation(.easeInOut(duration: 0.6), value: showSplashScreen)
        .animation(.easeInOut(duration: 0.6), value: submittedVendor)
        .animation(.spring(duration: 0.7, bounce: 0.15), value: dashboardReady)
    }
}

#Preview {
    ContentView()
}
