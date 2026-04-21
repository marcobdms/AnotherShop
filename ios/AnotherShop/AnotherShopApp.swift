import SwiftUI

@main
struct AnotherShopApp: App {
    @StateObject private var catalogVM = CatalogViewModel()
    @StateObject private var cartVM = CartViewModel()
    @StateObject private var appState = AppState()

    init() {
        // Caché para imágenes: 50MB RAM + 200MB disco
        URLCache.shared = URLCache(
            memoryCapacity: 50 * 1024 * 1024,
            diskCapacity: 200 * 1024 * 1024
        )

        // Navigation bar — minimalista
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = .white
        nav.shadowColor = .clear
        nav.titleTextAttributes = [
            .font: UIFont.systemFont(ofSize: 12, weight: .light),
            .kern: 3.0
        ]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav

        // Tab bar — limpio
        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = .white
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(catalogVM)
                .environmentObject(cartVM)
                .environmentObject(appState)
                .preferredColorScheme(.light)
        }
    }
}
