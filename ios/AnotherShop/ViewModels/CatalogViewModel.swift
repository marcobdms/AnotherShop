import Foundation

@MainActor
class CatalogViewModel: ObservableObject {

    @Published var products:  [Product]    = []
    @Published var filters:   Filters      = Filters(tallas: [], generos: [])
    @Published var meta:      CatalogMeta? = nil
    @Published var isLoading: Bool         = true
    @Published var error:     String?      = nil

    // Filtros activos
    @Published var activeGenero: String?   = nil
    @Published var activeTalla:  String?   = nil

    private var isFetched = false

    func loadIfNeeded() async {
        guard !isFetched else { return }
        isFetched = true
        do {
            let catalog  = try await CatalogService.fetchCatalog()
            products     = catalog.productos
            filters      = catalog.filtros
            meta         = catalog.meta
        } catch {
            self.error   = error.localizedDescription
        }
        isLoading = false
    }

    func clearFilters() {
        activeGenero = nil
        activeTalla  = nil
    }

    var filteredProducts: [Product] {
        var list = products
        if let g = activeGenero {
            list = list.filter { $0.genero == g || $0.genero == "unisex" }
        }
        if let t = activeTalla {
            list = list.filter { $0.isSizeInStock(t) }
        }
        return list.sorted { $0.disponible && !$1.disponible }
    }
}
