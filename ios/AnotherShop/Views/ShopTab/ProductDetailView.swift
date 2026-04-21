import SwiftUI

struct ProductDetailView: View {
    let product: Product
    @EnvironmentObject var catalogVM: CatalogViewModel
    @EnvironmentObject var cartVM: CartViewModel
    @EnvironmentObject var appState: AppState
    @State private var selectedSize: String? = nil
    @State private var imageLoaded = false
    @State private var showAddedToast = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // MARK: Imagen
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
                                        .opacity(imageLoaded ? 1 : 0)
                                        .onAppear {
                                            withAnimation(.easeIn(duration: 0.4)) { imageLoaded = true }
                                        }
                                case .failure:
                                    Rectangle().fill(Color(.systemGray5))
                                default:
                                    Rectangle().fill(Color(.systemGray6))
                                        .overlay(ProgressView())
                                }
                            }
                        )
                        .clipped()
                        .grayscale(product.disponible ? 0 : 0.8)

                    if !product.disponible {
                        Text("AGOTADO")
                            .font(.system(size: 10, weight: .light))
                            .tracking(3)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(.black.opacity(0.75))
                            .foregroundStyle(.white)
                            .padding(16)
                    }
                }

                // MARK: Info
                VStack(alignment: .leading, spacing: 16) {

                    VStack(alignment: .leading, spacing: 6) {
                        Text(product.nombre)
                            .font(.system(size: 16, weight: .light))
                            .tracking(2)
                            .textCase(.uppercase)

                        Text(CatalogService.formatPrice(product.precio))
                            .font(.system(size: 14, weight: .light))
                            .foregroundStyle(.secondary)
                    }

                    Divider()

                    Text(product.descripcion)
                        .font(.system(size: 13, weight: .light))
                        .lineSpacing(5)
                        .foregroundStyle(.secondary)

                    Divider()

                    // MARK: Tallas
                    SizeSelector(product: product, selectedSize: $selectedSize)

                    // MARK: Acciones
                    if product.disponible {
                        VStack(spacing: 12) {
                            Button {
                                if let size = selectedSize {
                                    withAnimation {
                                        cartVM.add(product: product, size: size)
                                        showAddedToast = true
                                    }
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                                        withAnimation {
                                            showAddedToast = false
                                            selectedSize = nil
                                        }
                                    }
                                }
                            } label: {
                                Text(selectedSize == nil ? "SELECCIONA TALLA" : (showAddedToast ? "AÑADIDO A LA BOLSA" : "AÑADIR A LA BOLSA"))
                                    .font(.system(size: 13, weight: .light))
                                    .tracking(1)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(selectedSize == nil ? Color(.systemGray4) : (showAddedToast ? Color.green : Color.primary))
                                    .foregroundStyle(selectedSize == nil ? Color(.systemGray) : Color(.systemBackground))
                            }
                            .disabled(selectedSize == nil || showAddedToast)
                        }
                        .padding(.top, 8)
                    } else {
                        Text("No disponible")
                            .font(.system(size: 12, weight: .ultraLight))
                            .tracking(2)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 8)
                    }
                }
                .padding(20)
            }
        }
        .navigationTitle(product.nombre)
        .navigationBarTitleDisplayMode(.inline)
    }
}
