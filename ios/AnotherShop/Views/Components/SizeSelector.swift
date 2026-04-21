import SwiftUI

struct SizeSelector: View {
    let product: Product
    @Binding var selectedSize: String?

    private let columns = [GridItem(.adaptive(minimum: 52), spacing: 8)]
    private let standardSizes = ["XS", "S", "M", "L", "XL", "XXL"]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("TALLAS")
                .font(.system(size: 10, weight: .light))
                .tracking(3)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                ForEach(standardSizes, id: \.self) { size in
                    let inStock = product.isSizeInStock(size)
                    let selected = selectedSize == size

                    Button {
                        guard inStock else { return }
                        withAnimation(.easeInOut(duration: 0.15)) {
                            selectedSize = selected ? nil : size
                        }
                    } label: {
                        Text(size)
                            .font(.system(size: 11, weight: selected ? .medium : .light))
                            .tracking(1)
                            .frame(minWidth: 44, minHeight: 36)
                            .background(selected ? Color.primary : Color.clear)
                            .foregroundStyle(
                                inStock
                                    ? (selected ? Color(.systemBackground) : Color.primary)
                                    : Color(.systemGray3)
                            )
                            .overlay(
                                ZStack {
                                    Rectangle().stroke(
                                        inStock ? Color.primary.opacity(0.4) : Color(.systemGray4),
                                        lineWidth: 0.5
                                    )
                                    // Línea diagonal para tallas sin stock
                                    if !inStock {
                                        Path { path in
                                            path.move(to: CGPoint(x: 0, y: 36))
                                            path.addLine(to: CGPoint(x: 44, y: 0))
                                        }
                                        .stroke(Color(.systemGray4), lineWidth: 0.5)
                                    }
                                }
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(!inStock)
                }
            }
        }
    }
}
