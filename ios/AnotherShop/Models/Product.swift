import Foundation

struct Product: Codable, Identifiable, Hashable {
    let id: String
    let nombre: String
    let precio: Double
    let imagen: String
    let descripcion: String
    let tallas: [String]
    let genero: String
    let disponible: Bool

    var fullImageURL: URL? {
        if imagen.hasPrefix("http") {
            return URL(string: imagen)
        }
        let prefix = imagen.hasPrefix("/") ? "" : "/"
        return URL(string: "\(Constants.imageBaseURL)\(prefix)\(imagen)")
    }

    /// Comprueba si una talla específica aparece en la descripción (indicador de stock).
    func isSizeInStock(_ size: String) -> Bool {
        guard disponible else { return false }
        let components = descripcion.uppercased().components(separatedBy: CharacterSet.alphanumerics.inverted)
        return components.contains(size.uppercased())
    }
}
