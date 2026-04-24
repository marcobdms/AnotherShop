import SwiftUI

struct AboutView: View {
    @EnvironmentObject var catalogVM: CatalogViewModel

    private let paragraphs = [
        "Somos Another NPC Shop.",
        "Esto es simplemente otra tienda npc que intenta verder ropa de calidad a sus clientes.",
        "No tenemos algo especial que nos diferencie del resto, tampoco tenemos un objetivo claro.",
        "Estamos interesados en ayudarte a mejorar tu estilo si nos lo pides.",
        "Puedes contactar por WhatsApp desde cualquier ficha de producto."
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Sobre la tienda")
                    .font(.system(size: 13, weight: .bold))
                    .tracking(4)
                    .textCase(.uppercase)
                    .padding(.bottom, 8)

                ForEach(paragraphs, id: \.self) { p in
                    Text(p)
                        .font(.system(size: 14, weight: .light))
                        .lineSpacing(6)
                        .foregroundStyle(.black)
                }
                
                Image("npc")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 200, height: 200)
                    .padding(.top, 0)
                    .padding(.bottom, 0)
                    .frame(maxWidth: .infinity, alignment: .center)

                Divider().padding(.top, 16)

                // Marca al pie
                Text(catalogVM.meta?.marca ?? "ANOTHER NPC SHOP")
                    .font(.system(size: 10, weight: .ultraLight))
                    .tracking(4)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.bottom, 16)
                
                
            }
            .padding(24)
        }
        .navigationTitle("Nosotros")
        .navigationBarTitleDisplayMode(.inline)
    }
}
