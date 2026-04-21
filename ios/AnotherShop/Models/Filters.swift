import Foundation

struct Filters: Codable {
    let tallas: [String]
    let generos: [String]
}

struct CatalogResponse: Codable {
    let meta: CatalogMeta
    let filtros: Filters
    let productos: [Product]
}
