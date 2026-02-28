//
//  DesignSystem.swift
//  ProgRiskAI
//
//  Created by Ryan Nair on 2/27/26.
//

import SwiftUI

struct DesignSystem {
    struct Colors {
        // Background Gradients
        static let backgroundStart = Color(hex: "090E17")
        static let backgroundEnd = Color(hex: "162238")
        
        // Shield Gradients
        static let shieldStart = Color(hex: "213966")
        static let shieldEnd = Color(hex: "0A152B")
        static let shieldStrokeStart = Color(hex: "3A60A6")
        static let shieldStrokeEnd = Color(hex: "1A2D54")
        
        // Tier 1 Node Gradients (Accents)
        static let t1TopStart = Color(hex: "00C9FF")
        static let t1TopEnd = Color(hex: "92FE9D")
        
        static let t1BLStart = Color(hex: "4FACFE")
        static let t1BLEnd = Color(hex: "00F2FE")
        
        static let t1BRStart = Color(hex: "667EEA")
        static let t1BREnd = Color(hex: "764BA2")
        
        // Core and Node Gradients
        static let nodeStart = Color(hex: "FFFFFF")
        static let nodeEnd = Color(hex: "D0E4F7")
        
        static let coreStart = Color(hex: "FFFFFF")
        static let coreEnd = Color(hex: "E0EAFC")
        
        static let coreCenter = Color(hex: "162238")
        static let coreAccent = Color(hex: "00F2FE")
    }
    
    struct Gradients {
        static let mainBackground = LinearGradient(
            colors: [Colors.backgroundStart, Colors.backgroundEnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        
        static let primaryAccent = LinearGradient(
            colors: [Colors.t1TopStart, Colors.t1TopEnd],
            startPoint: .leading,
            endPoint: .trailing
        )
        
        static let secondaryAccent = LinearGradient(
            colors: [Colors.t1BLStart, Colors.t1BLEnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        
        static let tertiaryAccent = LinearGradient(
            colors: [Colors.t1BRStart, Colors.t1BREnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
