import SwiftUI

struct HomeView: View {
    @EnvironmentObject var catalogVM: CatalogViewModel
    @State private var appeared = false

    var body: some View {
        
        Spacer()
        Spacer()
        ZStack {
            Color(.systemBackground).ignoresSafeArea()

            VStack(spacing: 0) {
                
                VStack {                    
                    Text("ANOTHER NPC SHOP")
                        .font(.system(size: 10, weight: .regular))
                        .tracking(5)
                        .foregroundStyle(Color.primary)
                    
                    Divider().padding(.top, 5)
                }
                .padding(.bottom, 0)

                Spacer()
                
                Image("npc")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 280, height: 280)
                    .padding(.top, 0)
                    .padding(.bottom, 0)

                // Marca
                Text(catalogVM.meta?.marca ?? "ANOTHER NPC SHOP")
                    .font(.system(size: 25, weight: .light))
                    .tracking(5)
                    .textCase(.uppercase)

                // Tagline
                Text("Just Clothes and Good Styles")
                    .font(.system(size: 14, weight: .ultraLight))
                    .tracking(2)
                    .foregroundStyle(Color.primary)
                    .padding(.top, 8)

                Spacer()

                // Botón "Entrar" — NavigationLink nativo
                NavigationLink(value: "catalog") {
                    Text("ENTRAR")
                        .font(.system(size: 14, weight: .medium))
                        .tracking(3)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.primary)
                        .foregroundStyle(Color(.systemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 56)
            }
        }
        .navigationDestination(for: String.self) { _ in
            CatalogView()
        }
        .navigationDestination(for: Product.self) { product in
            ProductDetailView(product: product)
        }
        .toolbar(.hidden, for: .navigationBar)
        .opacity(appeared ? 1 : 0)
        .onAppear {
            withAnimation(.easeIn(duration: 0.8)) { appeared = true }
        }
        .task { await catalogVM.loadIfNeeded() }
    }
}
