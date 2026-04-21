import SwiftUI

struct AboutView: View {
    @EnvironmentObject var catalogVM: CatalogViewModel

    private let paragraphs = [
        "Somos Another NPC Shop.",
        "No tenemos historia de origen inspiradora. No había una necesidad insatisfecha. No empezamos en un garaje con un sueño.",
        "Hacemos ropa. La ropa existe. Tú puedes comprarla si quieres.",
        "Sin estilo de vida. Sin valores aspiracionales. Sin comunidad con la que identificarte. Solo prendas con un precio.",
        "Puedes contactar por WhatsApp desde cualquier ficha de producto."
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Sobre la tienda")
                    .font(.system(size: 13, weight: .ultraLight))
                    .tracking(4)
                    .textCase(.uppercase)
                    .padding(.bottom, 8)

                ForEach(paragraphs, id: \.self) { p in
                    Text(p)
                        .font(.system(size: 14, weight: .ultraLight))
                        .lineSpacing(6)
                        .foregroundStyle(.secondary)
                }

                Divider().padding(.top, 16)

                // Marca al pie
                Text(catalogVM.meta?.marca ?? "ANOTHER NPC SHOP")
                    .font(.system(size: 10, weight: .ultraLight))
                    .tracking(4)
                    .foregroundStyle(Color(.systemGray3))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.bottom, 16)
            }
            .padding(24)
        }
        .navigationTitle("Nosotros")
        .navigationBarTitleDisplayMode(.inline)
    }
}
