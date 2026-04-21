import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            NavigationStack {
                HomeView()
            }
            .tabItem { Label("Tienda", systemImage: "tshirt") }
            .tag(0)

            NavigationStack {
                CartView()
            }
            .tabItem { Label("Bolsa", systemImage: "bag") }
            .tag(1)

            NavigationStack {
                AboutView()
            }
            .tabItem { Label("Nosotros", systemImage: "info.circle") }
            .tag(2)
        }
        .tint(.primary)
    }
}
