import SwiftUI

struct FilterChipsView: View {
    let generos: [String]
    let tallas: [String]

    @Binding var activeGenero: String?
    @Binding var activeTalla: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                // Separador visual
                Divider().frame(height: 16)

                // Género
                ForEach(generos.filter { $0.lowercased() != "unisex" }, id: \.self) { g in
                    chip(label: g, isActive: activeGenero == g) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            activeGenero = activeGenero == g ? nil : g
                        }
                    }
                }

                // Divider
                if !generos.isEmpty && !tallas.isEmpty {
                    Rectangle()
                        .fill(Color(.separator))
                        .frame(width: 0.5, height: 16)
                }

                // Talla
                ForEach(tallas, id: \.self) { t in
                    chip(label: t, isActive: activeTalla == t) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            activeTalla = activeTalla == t ? nil : t
                        }
                    }
                }

                Divider().frame(height: 16)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    @ViewBuilder
    private func chip(label: String, isActive: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label.uppercased())
                .font(.system(size: 10, weight: isActive ? .medium : .light))
                .tracking(2)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isActive ? Color.primary : Color.clear)
                .foregroundStyle(isActive ? Color(.systemBackground) : Color.primary)
                .overlay(
                    Rectangle().stroke(Color.primary.opacity(0.3), lineWidth: 0.5)
                )
                .animation(.easeInOut(duration: 0.2), value: isActive)
        }
        .buttonStyle(.plain)
    }
}
