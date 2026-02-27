# AGENTS.md — ProgRiskAI

## Project Overview

ProgRiskAI is a native iPadOS app that aggregates and help companies track and analyze the suppliers of their direct (Tier 1) and Tier 2 suppliers
- **Language:** Swift 6.2 (strict concurrency enforced), minimal Objective-C
- **UI Framework:** SwiftUI (primary) + UIKit (via `UIViewControllerRepresentable` / `UIViewRepresentable`)
- **Deployment:** Designed for iPadOS and Mac Catalyst

### Observable vs ObservableObject

Prefer `@Observable` (`Observation` framework) for new ViewModels. However, when a
ViewModel has a **heavy initializer** — because SwiftUI recreates the value every time
it is passed around — use `ObservableObject` with `@StateObject` / `@ObservedObject`
instead to avoid repeated init overhead.

When a property on an `@Observable` class must not trigger view updates (e.g. a cache,
a task handle, or a helper object), annotate it with `@ObservationIgnored`.

```swift
// Lightweight ViewModel — use @Observable
@Observable @MainActor
final class ChatViewModel {
    var messages: [Message] = []
    @ObservationIgnored private var listenerTask: Task<Void, Never>?
}

// Heavy-init ViewModel — use ObservableObject to avoid repeated init cost
@MainActor
final class SwipeViewModel: ObservableObject {
    @Published var cards: ContiguousArray<SwipeCardView> = []
}
```

### Concurrency & Swift 6 Strict Concurrency

- Mark all UI-touching code with `@MainActor`.
- Mark functions that run off the main thread with `@concurrent` (project convention).
- Use `async`/`await` and structured concurrency (`withTaskGroup`, `withThrowingTaskGroup`)
  for parallelism — avoid `DispatchQueue` in new Swift code.
- Never introduce data races; the compiler will reject them, but also reason carefully
  about `Sendable` conformance when creating new types that cross actor boundaries.
- Use `actor` types for mutable shared state rather than locking primitives.
- For fire-and-forget network calls where the result is intentionally discarded (e.g.,
  reporting a user), using a completion-based `URLSession.dataTask.resume()` is
  acceptable and avoids the overhead of creating a `Task` whose result is never used.

### Swift Patterns
- Prefer `if`/`switch` as expressions (Swift 5.9+) over ternary chains when
  assigning a value based on a condition.
- Use typed throws (e.g., `throws(URLError)`) when the error domain is known
- `unsafelyUnwrapped` is acceptable **only** for values that are guaranteed non-nil by
  construction (e.g., hard-coded URL literals). Avoid it for runtime-computed values.
- Do not add new `NavigationView` usage; use `NavigationStack`.

**Performance is preferred over readability** when the trade-off is clear and the
hot path is well-understood. Specific patterns used throughout the codebase