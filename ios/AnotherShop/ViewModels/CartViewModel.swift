import SwiftUI

@MainActor
class CartViewModel: ObservableObject {
    @Published var items: [CartItem] = []

    var total: Double {
        items.reduce(0) { $0 + ($1.product.precio * Double($1.quantity)) }
    }

    func add(product: Product, size: String) {
        if let index = items.firstIndex(where: { $0.product.id == product.id && $0.size == size }) {
            items[index].quantity += 1
        } else {
            items.append(CartItem(product: product, size: size, quantity: 1))
        }
    }

    func remove(id: UUID) {
        items.removeAll { $0.id == id }
    }

    func increment(item: CartItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            items[index].quantity += 1
        }
    }

    func decrement(item: CartItem) {
        if let index = items.firstIndex(where: { $0.id == item.id }) {
            if items[index].quantity > 1 {
                items[index].quantity -= 1
            } else {
                items.remove(at: index)
            }
        }
    }
}
