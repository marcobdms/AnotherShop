import Foundation

struct CatalogMeta: Codable {
    let marca: String
    let whatsapp: String
    let whatsappMensaje: String
    let paypal: String
    let recargoPaypal: String

    enum CodingKeys: String, CodingKey {
        case marca, whatsapp, paypal
        case whatsappMensaje = "whatsapp_mensaje"
        case recargoPaypal   = "recargo_paypal"
    }
}
