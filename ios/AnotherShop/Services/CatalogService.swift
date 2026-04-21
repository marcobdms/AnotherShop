import Foundation

struct CatalogService {

    private static let base = Constants.apiBaseURL

    // MARK: - Fetch

    static func fetchCatalog() async throws -> CatalogResponse {
        guard let url = URL(string: "\(base)/api/catalog") else { throw URLError(.badURL) }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(CatalogResponse.self, from: data)
    }

    static func fetchProduct(id: String) async throws -> Product {
        guard let url = URL(string: "\(base)/api/products/\(id)") else { throw URLError(.badURL) }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(Product.self, from: data)
    }

    // MARK: - Formatters

    static func formatPrice(_ price: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "EUR"
        f.locale = Locale(identifier: "es_ES")
        return f.string(from: NSNumber(value: price)) ?? "\(price) €"
    }

    // MARK: - External URLs

    static func whatsAppURL(meta: CatalogMeta, product: Product, size: String?) -> URL? {
        let sizeText = size.map { " | Talla: \($0)" } ?? ""
        let msg = "\(meta.whatsappMensaje)\n\n*\(product.nombre)*\(sizeText)\nPrecio: \(formatPrice(product.precio))"
        guard let encoded = msg.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return nil }
        return URL(string: "https://wa.me/\(meta.whatsapp)?text=\(encoded)")
    }

    static func whatsAppURLForCart(meta: CatalogMeta, items: [CartItem], total: Double) -> URL? {
        var msg = "\(meta.whatsappMensaje)\n\n"
        for item in items {
            msg += "- \(item.quantity)x \(item.product.nombre) (Talla: \(item.size))\n"
        }
        msg += "\nTotal: \(formatPrice(total))"
        guard let encoded = msg.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return nil }
        return URL(string: "https://wa.me/\(meta.whatsapp)?text=\(encoded)")
    }

    static func payPalURL(meta: CatalogMeta, product: Product) -> URL? {
        URL(string: "https://paypal.me/\(meta.paypal)/\(String(format: "%.2f", product.precio))EUR")
    }
}
