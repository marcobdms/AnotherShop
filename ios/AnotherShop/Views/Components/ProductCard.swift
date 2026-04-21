import SwiftUI

struct ProductCard: View {
    let product: Product

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Imagen
            ZStack(alignment: .bottomLeading) {
                Color.clear
                    .aspectRatio(3/4, contentMode: .fit)
                    .overlay(
                        AsyncImage(url: product.fullImageURL) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .scaledToFill()
                                    .transition(.opacity.animation(.easeInOut(duration: 0.5)))
                            case .failure:
                                Rectangle()
                                    .fill(Color(.systemGray5))
                                    .overlay(
                                        Image(systemName: "photo")
                                            .foregroundStyle(.secondary)
                                    )
                            default:
                                Rectangle()
                                    .fill(Color(.systemGray6))
                                    .overlay(ProgressView())
                            }
                        }
                    )
                    .clipped()
                    .grayscale(product.disponible ? 0 : 0.5)

                // Badge "Agotado"
                if !product.disponible {
                    Text("AGOTADO")
                        .font(.system(size: 8, weight: .light))
                        .tracking(2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(.black.opacity(0.7))
                        .foregroundStyle(.white)
                        .padding(8)
                }
            }

            // Info
            VStack(alignment: .leading, spacing: 6) {
                Text(product.nombre)
                    .font(.system(size: 12, weight: .regular))
                    .tracking(1)
                    .textCase(.uppercase)
                    .lineLimit(2)

                Text(CatalogService.formatPrice(product.precio))
                    .font(.system(size: 12, weight: .light))
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 16)
        }
    }
}
