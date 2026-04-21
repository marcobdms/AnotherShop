import SwiftUI

class AppState: ObservableObject {
    @Published var selectedTab: Int = 0
}
