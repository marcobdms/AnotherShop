import SwiftUI

struct CartView: View {
    @EnvironmentObject var cartVM: CartViewModel
    @EnvironmentObject var catalogVM: CatalogViewModel
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if cartVM.items.isEmpty {
                VStack(spacing: 20) {
                    Image(systemName: "bag")
                        .font(.system(size: 40, weight: .ultraLight))
                    Text("Tu bolsa está vacía")
                        .font(.system(size: 13, weight: .light))
                        .tracking(2)
                    
                    Button {
                        appState.selectedTab = 0
                    } label: {
                        Text("IR DE COMPRAS")
                            .font(.system(size: 10, weight: .light))
                            .tracking(3)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                            .overlay(Rectangle().stroke(Color.primary.opacity(0.4), lineWidth: 0.5))
                    }
                    .foregroundStyle(.primary)
                    .padding(.top, 20)
                }
                .foregroundStyle(.secondary)
            } else {
                cartContent
            }
        }
        .navigationTitle("BOLSA")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var cartContent: some View {
        VStack(spacing: 0) {
            List {
                ForEach(cartVM.items) { item in
                    HStack(spacing: 16) {
                        AsyncImage(url: item.product.fullImageURL) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                Color(.systemGray6)
                            }
                        }
                        .frame(width: 60, height: 80)
                        .clipped()

                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.product.nombre)
                                .font(.system(size: 12, weight: .light))
                                .lineLimit(2)
                            Text("Talla: \(item.size)")
                                .font(.system(size: 11, weight: .ultraLight))
                                .foregroundStyle(.secondary)
                            Text(CatalogService.formatPrice(item.product.precio * Double(item.quantity)))
                                .font(.system(size: 12, weight: .medium))
                        }

                        Spacer()

                        HStack(spacing: 8) {
                            Button {
                                withAnimation { cartVM.decrement(item: item) }
                            } label: {
                                Image(systemName: "minus")
                                    .font(.system(size: 10, weight: .bold))
                                    .frame(width: 24, height: 24)
                                    .background(Color(.systemGray6))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)

                            Text("\(item.quantity)")
                                .font(.system(size: 12, weight: .medium))
                                .frame(minWidth: 16, alignment: .center)

                            Button {
                                withAnimation { cartVM.increment(item: item) }
                            } label: {
                                Image(systemName: "plus")
                                    .font(.system(size: 10, weight: .bold))
                                    .frame(width: 24, height: 24)
                                    .background(Color(.systemGray6))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .onDelete { indexSet in
                    for index in indexSet {
                        cartVM.items.remove(at: index)
                    }
                }
            }
            .listStyle(.plain)

            VStack(spacing: 16) {
                HStack {
                    Text("TOTAL")
                        .font(.system(size: 12, weight: .light))
                        .tracking(2)
                    Spacer()
                    Text(CatalogService.formatPrice(cartVM.total))
                        .font(.system(size: 16, weight: .medium))
                }
                
                if let meta = catalogVM.meta, let url = CatalogService.whatsAppURLForCart(meta: meta, items: cartVM.items, total: cartVM.total) {
                    Link(destination: url) {
                        Label("Pedir por WhatsApp", systemImage: "bubble.right")
                            .font(.system(size: 13, weight: .light))
                            .tracking(1)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.primary)
                            .foregroundStyle(Color(.systemBackground))
                    }
                }
            }
            .padding(24)
            .background(Color(.systemBackground).shadow(radius: 10, y: -5))
        }
    }
}
