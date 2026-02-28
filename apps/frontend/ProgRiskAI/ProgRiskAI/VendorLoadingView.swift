//
//  VendorLoadingView.swift
//  ProgRiskAI
//
//  Created by Ryan Nair on 2/27/26.
//

import SwiftUI
internal import Combine

struct VendorLoadingView: View {
    let vendorName: String
    var onComplete: (() -> Void)? = nil

    @State private var innerRingRotation: Double = 0
    @State private var middleRingRotation: Double = 0
    @State private var outerRingRotation: Double = 0
    @State private var coreScale: CGFloat = 0.8
    @State private var coreOpacity: Double = 0.5
    @State private var dotsCount = 0

    // Timer for animating the "..." text
    let dotsTimer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            DesignSystem.Gradients.mainBackground
                .ignoresSafeArea()

            VStack(spacing: 60) {
                // Animated Rings and Central Core
                ZStack {
                    // Outer Ring (Slower, counter-clockwise)
                    Circle()
                        .stroke(DesignSystem.Gradients.tertiaryAccent, lineWidth: 2)
                        .frame(width: 220, height: 220)
                        .rotationEffect(.degrees(outerRingRotation))
                        .onAppear {
                            withAnimation(.linear(duration: 8).repeatForever(autoreverses: false)) {
                                outerRingRotation = -360
                            }
                        }

                    // Outer Ring Nodes
                    Circle()
                        .trim(from: 0.1, to: 0.15)
                        .stroke(DesignSystem.Colors.t1BRStart, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .frame(width: 220, height: 220)
                        .rotationEffect(.degrees(outerRingRotation))

                    Circle()
                        .trim(from: 0.6, to: 0.65)
                        .stroke(DesignSystem.Colors.t1BREnd, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .frame(width: 220, height: 220)
                        .rotationEffect(.degrees(outerRingRotation))

                    // Middle Ring (Medium speed, clockwise)
                    Circle()
                        .stroke(DesignSystem.Gradients.secondaryAccent, lineWidth: 3)
                        .frame(width: 160, height: 160)
                        .rotationEffect(.degrees(middleRingRotation))
                        .onAppear {
                            withAnimation(.linear(duration: 4).repeatForever(autoreverses: false)) {
                                middleRingRotation = 360
                            }
                        }

                    // Middle Ring Nodes
                    Circle()
                        .trim(from: 0.3, to: 0.4)
                        .stroke(DesignSystem.Colors.t1BLStart, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .frame(width: 160, height: 160)
                        .rotationEffect(.degrees(middleRingRotation))

                    // Inner Ring (Fastest, counter-clockwise)
                    Circle()
                        .stroke(DesignSystem.Gradients.primaryAccent, style: StrokeStyle(lineWidth: 4, dash: [10, 15]))
                        .frame(width: 100, height: 100)
                        .rotationEffect(.degrees(innerRingRotation))
                        .onAppear {
                            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                                innerRingRotation = -360
                            }
                        }

                    // Pulsating central core
                    Circle()
                        .fill(DesignSystem.Colors.coreStart)
                        .frame(width: 40, height: 40)
                        .shadow(color: DesignSystem.Colors.coreAccent.opacity(0.8), radius: 15)
                        .scaleEffect(coreScale)
                        .opacity(coreOpacity)
                        .onAppear {
                            withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) {
                                coreScale = 1.2
                                coreOpacity = 1.0
                            }
                        }
                }

                // Loading Text
                VStack(spacing: 10) {
                    Text("Analyzing")
                        .font(.system(size: 20, weight: .medium, design: .rounded))
                        .foregroundColor(.gray)

                    Text("\(vendorName)\(String(repeating: ".", count: dotsCount))")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                        .frame(width: 300, alignment: .center)
                        .onReceive(dotsTimer) { _ in
                            dotsCount = (dotsCount + 1) % 4
                        }
                }
            }
        }
        .task {
            // Simulate the 2-second backend round-trip via MockDataService
            _ = await MockDataService.shared.analyzeVendor(name: vendorName)
            onComplete?()
        }
    }
}

#Preview {
    VendorLoadingView(vendorName: "Acme Corp")
}
