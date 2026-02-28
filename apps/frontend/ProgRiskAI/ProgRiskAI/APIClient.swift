import Foundation

// MARK: - APIClient

actor APIClient {

    static let shared = APIClient()

    // swiftlint:disable:next force_unwrapping
    private let baseURL = URL(string: "https://api.progrisk.ai/v1")!
    private let session: URLSession
    private let decoder: JSONDecoder

    private var bearerToken: String = ""

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
    }

    func setToken(_ token: String) {
        bearerToken = token
    }

    // MARK: - Analysis

    func analyzeVendor(name: String) async throws(APIError) -> AnalyzeResponse {
        let body = AnalyzeRequest(vendorName: name)
        return try await post(path: "vendors/analyze", body: body)
    }

    func pollStatus(vendorId: String) async throws(APIError) -> StatusResponse {
        try await get(path: "vendors/\(vendorId)/status")
    }

    // MARK: - Tabs

    func fetchOverview(vendorId: String) async throws(APIError) -> VendorOverview {
        try await get(path: "vendors/\(vendorId)/overview")
    }

    func fetchDependencies(vendorId: String) async throws(APIError) -> DependencyResponse {
        try await get(path: "vendors/\(vendorId)/dependencies")
    }

    func fetchRiskBreakdown(vendorId: String) async throws(APIError) -> RiskBreakdown {
        try await get(path: "vendors/\(vendorId)/risk-breakdown")
    }

    func fetchComparison(vendorIds: [String]) async throws(APIError) -> ComparisonResponse {
        let joined = vendorIds.joined(separator: ",")
        return try await get(path: "vendors/compare", queryItems: [
            URLQueryItem(name: "ids", value: joined)
        ])
    }

    // MARK: - Polling Helper

    /// Polls `pollStatus` every `interval` seconds until status is `.complete` or `.failed`.
    /// Throws if the analysis fails or the timeout is reached.
    func waitForCompletion(
        vendorId: String,
        interval: TimeInterval = 2,
        timeout:  TimeInterval = 120
    ) async throws(APIError) -> Void {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            let status = try await pollStatus(vendorId: vendorId)
            switch status.status {
            case .complete:
                return
            case .failed:
                throw APIError(error: APIErrorBody(
                    code: "ANALYSIS_FAILED",
                    message: "The backend could not analyze this vendor.",
                    status: 422
                ))
            case .processing:
                try? await Task.sleep(for: .seconds(interval))
            }
        }
        throw APIError(error: APIErrorBody(
            code: "TIMEOUT",
            message: "Analysis did not complete within the expected time.",
            status: 408
        ))
    }

    // MARK: - Private HTTP Primitives

    private func get<T: Decodable>(
        path:       String,
        queryItems: [URLQueryItem] = []
    ) async throws(APIError) -> T {
        var components        = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        if !queryItems.isEmpty { components.queryItems = queryItems }
        let url               = components.url!
        var request           = URLRequest(url: url)
        request.httpMethod    = "GET"
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json",      forHTTPHeaderField: "Accept")
        return try await execute(request)
    }

    private func post<Body: Encodable, T: Decodable>(
        path: String,
        body: Body
    ) async throws(APIError) -> T {
        var request        = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = "POST"
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json",      forHTTPHeaderField: "Content-Type")
        request.setValue("application/json",      forHTTPHeaderField: "Accept")
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            throw APIError(error: APIErrorBody(code: "ENCODE_FAILED", message: error.localizedDescription, status: 0))
        }
        return try await execute(request)
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws(APIError) -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError(error: APIErrorBody(code: "NETWORK_ERROR", message: error.localizedDescription, status: 0))
        }

        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(statusCode) else {
            if let apiError = try? decoder.decode(APIError.self, from: data) {
                throw apiError
            }
            throw APIError(error: APIErrorBody(
                code:    "HTTP_\(statusCode)",
                message: HTTPURLResponse.localizedString(forStatusCode: statusCode),
                status:  statusCode
            ))
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError(error: APIErrorBody(
                code:    "DECODE_FAILED",
                message: error.localizedDescription,
                status:  statusCode
            ))
        }
    }
}
