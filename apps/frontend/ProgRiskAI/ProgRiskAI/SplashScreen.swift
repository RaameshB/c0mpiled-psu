//
//  SplashScreen.swift
//  ProgRiskAI
//
//  Created by Ryan Nair on 2/27/26.
//


import SwiftUI

struct SplashScreen: View {
    @Binding var showSplashScreen: Bool

    @State private var progress: CGFloat = 0
    @State private var strokeOpacity: Double = 1
    @State private var glowRadius: CGFloat = 0
    @State private var exitScale: CGFloat = 1
    @State private var exitOpacity: Double = 1

    // TIMING CONFIGURATION
    let drawDuration: Double = 1.5 // Slightly longer to appreciate the complex shape
    let exitDuration: Double = 0.5
    let pauseBeforeExit: Double = 0.3

    var body: some View {
        ZStack {
            DesignSystem.Gradients.mainBackground
                .ignoresSafeArea()

            ZStack {
                // 1. Fill Layer
                ProgRiskAIShape()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [DesignSystem.Colors.shieldStart, DesignSystem.Colors.shieldEnd]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        .opacity(0.8)
                    )
                    .opacity(progress)

                // 2. Stroke Layer
                ProgRiskAIShape()
                    .trim(from: 0, to: progress)
                    .stroke(
                        LinearGradient(
                            gradient: Gradient(colors: [DesignSystem.Colors.shieldStrokeStart, DesignSystem.Colors.shieldStrokeEnd]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round)
                    )
                    .opacity(strokeOpacity)
            }
            .frame(width: 250, height: 250) // Reduced slightly so the complex shape isn't too overwhelming
            .shadow(color: Color(hex: "00C9FF").opacity(0.6), radius: glowRadius)
            .scaleEffect(exitScale)
            .opacity(exitOpacity)
        }
        .onAppear {
            runAnimationSequence()
        }
    }
   
    func runAnimationSequence() {
        // 1. Draw & Fill
        withAnimation(.easeInOut(duration: drawDuration)) {
            progress = 1.0
        }
       
        // 2. Fade out Stroke
        DispatchQueue.main.asyncAfter(deadline: .now() + (drawDuration - 0.3)) {
            withAnimation(.easeOut(duration: 0.3)) {
                strokeOpacity = 0
            }
        }

        // 3. Glow
        withAnimation(.easeIn(duration: 0.5).delay(drawDuration * 0.4)) {
            glowRadius = 25
        }

        // 4. Exit Sequence
        let exitStartTime = drawDuration + pauseBeforeExit
       
        DispatchQueue.main.asyncAfter(deadline: .now() + exitStartTime) {
            withAnimation(.linear(duration: 0.3)) {
                glowRadius = 0
            }

            withAnimation(.easeIn(duration: exitDuration)) {
                exitScale = 30
                exitOpacity = 0
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + exitDuration) {
                showSplashScreen = false
            }
        }
    }
}

// Custom Shape based on the ProgRiskAI design
struct ProgRiskAIShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.size.width
        let height = rect.size.height
        
        // Helper function for relative coordinates
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            return CGPoint(x: x * width, y: y * height)
        }
        
        // 1. Outer Shield
        path.move(to: p(0.5, 0.1367))
        path.addCurve(to: p(0.8398, 0.4882), control1: p(0.7031, 0.1367), control2: p(0.8398, 0.2929))
        path.addCurve(to: p(0.5, 0.9375), control1: p(0.8398, 0.7421), control2: p(0.5, 0.9375))
        path.addCurve(to: p(0.1601, 0.4882), control1: p(0.5, 0.9375), control2: p(0.1601, 0.7421))
        path.addCurve(to: p(0.5, 0.1367), control1: p(0.1601, 0.2929), control2: p(0.2968, 0.1367))
        
        // 2. Network Connections
        // T1 to T2 connections
        path.move(to: p(0.5, 0.3613)); path.addLine(to: p(0.3642, 0.2636))
        path.move(to: p(0.5, 0.3613)); path.addLine(to: p(0.6357, 0.2636))
        path.move(to: p(0.3906, 0.5517)); path.addLine(to: p(0.2148, 0.5078))
        path.move(to: p(0.3906, 0.5517)); path.addLine(to: p(0.3222, 0.7226))
        path.move(to: p(0.6093, 0.5517)); path.addLine(to: p(0.7851, 0.5078))
        path.move(to: p(0.6093, 0.5517)); path.addLine(to: p(0.6777, 0.7226))
        
        // Core to T1 connections
        path.move(to: p(0.5, 0.4882)); path.addLine(to: p(0.5, 0.3613))
        path.move(to: p(0.5, 0.4882)); path.addLine(to: p(0.3906, 0.5517))
        path.move(to: p(0.5, 0.4882)); path.addLine(to: p(0.6093, 0.5517))

        // 3. Tier 1 Master Nodes (Circles)
        let r: CGFloat = 0.1367 // relative radius
        path.addEllipse(in: CGRect(x: (0.5 - r) * width, y: (0.3613 - r) * height, width: 2*r * width, height: 2*r * height))
        path.addEllipse(in: CGRect(x: (0.3906 - r) * width, y: (0.5517 - r) * height, width: 2*r * width, height: 2*r * height))
        path.addEllipse(in: CGRect(x: (0.6093 - r) * width, y: (0.5517 - r) * height, width: 2*r * width, height: 2*r * height))

        // 4. Central Core Hub (Hexagon)
        path.move(to: p(0.5, 0.4150))
        path.addLine(to: p(0.5634, 0.4516))
        path.addLine(to: p(0.5634, 0.5249))
        path.addLine(to: p(0.5, 0.5615))
        path.addLine(to: p(0.4365, 0.5249))
        path.addLine(to: p(0.4365, 0.4516))
        path.closeSubpath()
        
        return path
    }
}

// Helper extension to make hex colors easy in SwiftUI
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

#Preview {
    SplashScreen(showSplashScreen: .constant(true))
}