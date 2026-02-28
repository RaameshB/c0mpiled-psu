//
//  VendorEntryView.swift
//  ProgRiskAI
//
//  Created by Ryan Nair on 2/27/26.
//

import SwiftUI

struct VendorEntryView: View {
    var onSubmit: (String) -> Void
    
    @State private var vendorName = ""
    @State private var isFocused = false
    @State private var isAnimating = false
    @FocusState private var fieldIsFocused: Bool

    var body: some View {
        ZStack {
            // Background matching the enterprise slate vibe
            DesignSystem.Gradients.mainBackground
                .ignoresSafeArea()

            // Animated abstract background elements
            ZStack {
                Circle()
                    .fill(DesignSystem.Colors.t1TopStart.opacity(0.15))
                    .frame(width: 300, height: 300)
                    .blur(radius: 60)
                    .offset(x: isAnimating ? 100 : -100, y: isAnimating ? -100 : 100)

                Circle()
                    .fill(DesignSystem.Colors.t1BLStart.opacity(0.15))
                    .frame(width: 300, height: 300)
                    .blur(radius: 60)
                    .offset(x: isAnimating ? -100 : 100, y: isAnimating ? 100 : -100)
            }
            .animation(.easeInOut(duration: 8).repeatForever(autoreverses: true), value: isAnimating)

            VStack(spacing: 40) {
                Spacer()
                
                // Title
                Text("Enter your vendor")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                    .opacity(isAnimating ? 1 : 0)
                    .offset(y: isAnimating ? 0 : 30)
                    .animation(.easeOut(duration: 0.8).delay(0.2), value: isAnimating)

                // Animated Textbox
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .fill(Color.white.opacity(0.05))
                        .background(
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(
                                    LinearGradient(
                                        colors: isFocused ? [DesignSystem.Colors.t1TopStart, DesignSystem.Colors.t1TopEnd] : [Color.white.opacity(0.3), Color.clear],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: isFocused ? 2 : 1
                                )
                                .shadow(color: isFocused ? DesignSystem.Colors.t1TopStart.opacity(0.3) : .clear, radius: 15)
                                .animation(.easeInOut(duration: 0.4), value: isFocused)
                        )

                    HStack(spacing: 15) {
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 20))
                            .foregroundColor(isFocused ? DesignSystem.Colors.t1TopStart : .gray)
                            .animation(.easeInOut(duration: 0.4), value: isFocused)

                        TextField("Vendor Name", text: $vendorName)
                            .focused($fieldIsFocused)
                            .font(.system(size: 20, weight: .medium, design: .rounded))
                            .foregroundColor(.white)
                            .padding(.vertical, 20)
                            .onChange(of: fieldIsFocused) {
                                isFocused = fieldIsFocused
                            }
                            .onSubmit {
                                if !vendorName.isEmpty {
                                    let impact = UIImpactFeedbackGenerator(style: .medium)
                                    impact.impactOccurred()
                                    onSubmit(vendorName)
                                }
                            }
                            .submitLabel(.go)
                        
                        if !vendorName.isEmpty {
                            Button(action: {
                                let impact = UIImpactFeedbackGenerator(style: .medium)
                                impact.impactOccurred()
                                onSubmit(vendorName)
                            }) {
                                Image(systemName: "arrow.right.circle.fill")
                                    .font(.system(size: 28))
                                    .foregroundStyle(DesignSystem.Gradients.primaryAccent)
                                    .transition(.scale.combined(with: .opacity))
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                }
                .frame(height: 70)
                .padding(.horizontal, 30)
                .opacity(isAnimating ? 1 : 0)
                .offset(y: isAnimating ? 0 : 30)
                .animation(.easeOut(duration: 0.8).delay(0.4), value: isAnimating)
                
                Spacer()
                Spacer()
            }
        }
        .onAppear {
            isAnimating = true
        }
    }
}

#Preview {
    VendorEntryView(onSubmit: { _ in })
}
