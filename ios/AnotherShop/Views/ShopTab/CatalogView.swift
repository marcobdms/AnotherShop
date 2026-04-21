import SwiftUI

// MARK: - Scroll offset tracking (iOS 16 compatible)
private struct ScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

struct CatalogView: View {
    @EnvironmentObject var catalogVM: CatalogViewModel
    @EnvironmentObject var cartVM: CartViewModel
    @EnvironmentObject var appState: AppState
    @State private var showScrollTop = false

    // 1 columna flexible para que ocupe todo el ancho de la pantalla
    private let columns = [GridItem(.flexible(), spacing: 1)]

    var body: some View {
        Group {
            if catalogVM.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let err = catalogVM.error {
                errorView(message: err)
            } else {
                catalogContent
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 16) {
                    Button {
                        appState.selectedTab = 1
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "bag")
                                .font(.system(size: 14, weight: .light))
                            if cartVM.items.count > 0 {
                                Circle()
                                    .fill(Color.red)
                                    .frame(width: 8, height: 8)
                                    .offset(x: 4, y: -4)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
        }
    }

    // MARK: - Catalog content

    private var catalogContent: some View {
        ScrollViewReader { proxy in
            ZStack(alignment: .bottomTrailing) {
                ScrollView {
                    Color.clear.frame(height: 0)
                        .background(
                            GeometryReader { geo in
                                Color.clear.preference(
                                    key: ScrollOffsetKey.self,
                                    value: geo.frame(in: .named("catalogScroll")).minY
                                )
                            }
                        )
                    // Ancla para scroll-to-top
                    Color.clear.frame(height: 0).id("top")

                    // Filtros
                    FilterChipsView(
                        generos: catalogVM.filters.generos,
                        tallas: catalogVM.filters.tallas,
                        activeGenero: $catalogVM.activeGenero,
                        activeTalla: $catalogVM.activeTalla
                    )

                    let lista = catalogVM.filteredProducts

                    if lista.isEmpty {
                        emptyView
                    } else {
                        LazyVGrid(columns: columns, spacing: 60) {
                            ForEach(lista) { product in
                                NavigationLink(value: product) {
                                    ProductCard(product: product)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 16)
                        .padding(.bottom, 80)
                        .animation(.easeInOut(duration: 0.3), value: lista)
                    }
                }
                .coordinateSpace(name: "catalogScroll")
                .onPreferenceChange(ScrollOffsetKey.self) { value in
                    let scrolled = value < -300
                    if scrolled != showScrollTop {
                        withAnimation(.easeInOut(duration: 0.2)) { showScrollTop = scrolled }
                    }
                }

                // Botón scroll-to-top
                if showScrollTop {
                    Button {
                        withAnimation { proxy.scrollTo("top", anchor: .top) }
                    } label: {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 14, weight: .light))
                            .frame(width: 44, height: 44)
                            .background(.regularMaterial)
                            .clipShape(Circle())
                            .shadow(radius: 4)
                    }
                    .padding(20)
                    .transition(.scale.combined(with: .opacity))
                }
            }
        }
    }

    // MARK: - Estado vacío

    private var emptyView: some View {
        VStack(spacing: 20) {
            Text("Sin resultados")
                .font(.system(size: 13, weight: .light))
                .tracking(2)
                .foregroundStyle(.secondary)
                .padding(.top, 80)

            Button {
                withAnimation { catalogVM.clearFilters() }
            } label: {
                Text("LIMPIAR FILTROS")
                    .font(.system(size: 10, weight: .light))
                    .tracking(3)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .overlay(Rectangle().stroke(Color.primary.opacity(0.4), lineWidth: 0.5))
            }
            .foregroundStyle(.primary)
            .buttonStyle(.plain)
        }
    }

    // MARK: - Error

    private func errorView(message: String) -> some View {
        VStack(spacing: 16) {
            Text("Error al cargar")
                .font(.system(size: 13, weight: .light))
                .tracking(2)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
