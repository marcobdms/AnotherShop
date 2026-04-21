import Foundation

struct CartItem: Identifiable, Hashable {
    let id = UUID()
    let product: Product
    let size: String
    var quantity: Int
}
