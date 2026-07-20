# Another NPC Shop — Design System

> Referencia de identidad visual para agentes y colaboradores.
> Cubre todas las rutas **excepto `/` (Home/Landing)** — el Home está en proceso de rediseño.
> La fuente única del CSS real es `frontend/src/index.css`.

---


## 1. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React (Vite) |
| Estilos | Vanilla CSS — `frontend/src/index.css` |
| Fuentes | Inter (Google Fonts) — 300 · 400 · 500 |
| Routing | React Router DOM |
| Backend | FastAPI (Python) |
| DB / Auth | Supabase |

**No usar Tailwind CSS** salvo instrucción explícita. Todos los estilos van en `index.css` siguiendo nomenclatura BEM.

---

## 2. Paleta de color

```css
--white:    #ffffff
--black:    #0a0a0a
--grey-100: #f5f5f5   /* fondos de tarjetas / imagen placeholder */
--grey-200: #e8e8e8   /* bordes y separadores */
--grey-400: #999999   /* texto secundario muted */
--grey-600: #555555   /* texto de párrafo */
```

- **Fondo de página:** `--white`
- **Texto principal:** `--black`
- **Texto secundario / subtítulos:** `--grey-600`
- **Bordes y divisores:** `--grey-200`
- **Sin colores de acento vivos** — la marca es monocromática en blanco y negro.

---

## 3. Tipografía

**Fuente única:** `Inter` (sans-serif)

| Rol | Tamaño | Weight | Tracking | Transform |
|---|---|---|---|---|
| Títulos H1 hero | `clamp(2.5rem, 6vw, 4.5rem)` | 700 | `-0.02em` | `uppercase` |
| Títulos de sección | `--size-xl` (1.6rem) | 300–400 | `0.2em` | `uppercase` |
| Subtítulos | `--size-lg` (1.1rem) | 400 | `0.08em` | — |
| Cuerpo de párrafo | `--size-base` (0.9rem) | 300–400 | `0.05em` | — |
| Etiquetas / botones | `--size-xs` (0.65rem) | 500–600 | `0.15–0.2em` | `uppercase` |
| Precio de producto | `--size-sm` (0.8rem) | 300 | — | — |

**Regla:** Los títulos grandes (H1, hero) son **bold + sin tracking** para impacto editorial.
Los elementos de UI (etiquetas, nav, botones) son **light + mucho tracking** para elegancia minimalista.

---

## 4. Espaciado

- Padding lateral: `var(--gap)` = 2rem
- Entre secciones: `var(--gap-lg)` = 4rem
- Ancho máximo: `max-width: var(--max-width); margin: 0 auto;`

---

## 5. Animaciones

```css
/* Páginas interiores (producto, nosotros) */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Catálogo */
@keyframes slowFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

- `.product-page`, `.about-page` → `animation: fadeIn 0.4s ease`
- `.catalog-page` → `animation: slowFadeIn 1.2s ease-in-out`
- `--transition: 200ms ease` para hovers

---

## 6. Componentes clave

### Nav (`Nav.jsx`)
- **Desktop:** Logo izquierda + links (Catálogo, Nosotros) + icono usuario derecha.
- **Mobile (`max-width: 640px`):** Logo + hamburguesa → dropdown con `box-shadow: 0 4px 16px rgba(0,0,0,0.06)`.
- Marca: `0.75rem`, weight 500, `letter-spacing: 0.15em`, uppercase, `white-space: nowrap`.
- Links: `--size-xs`, `letter-spacing: 0.15em`, uppercase, `--grey-600` → `--black` en hover/active.
- Nav presente en **todas las rutas** excepto `/admin` y `/login`.
- **TopBanner** (cinta de métodos de pago): solo en `/catalogo`.

### ProductCard (`ProductCard.jsx`)
- `aspect-ratio: 3/4`, `background: var(--grey-100)`.
- **Sin flechas.** Interacción implícita:
  - **Desktop hover** → muestra imagen 2 (`opacity 450ms ease, scale 500ms ease`)
  - **Mobile swipe** → cambia `displayIndex` (umbral 40px)
- **Dots:** visibles solo con `@media (hover: none)`. Círculos 5px, blancos, activo `scale(1.4)`.
- **Favorito:** circular 32px, `backdrop-filter: blur(4px)`, visible al hover.
- **Agotado:** `grayscale(100%) opacity(70%)` + overlay "Agotado".

### Carrusel de producto (`Product.jsx`)
- Slide horizontal, `transition: transform 350ms ease`.
- **Flechas:** 36×36px, `opacity: 0 → 1` on-hover, `backdrop-filter: blur(4px)`.
- **Dots:** cuadrados (`border-radius: 0`), 6px. Activo → `var(--black)`.

### Botones CTA (producto)

```css
.btn-whatsapp { background: var(--black); color: var(--white); }
.btn-whatsapp:hover { opacity: 0.75; }

.btn-paypal { border: 1px solid var(--grey-200); color: var(--grey-600); }
.btn-paypal:hover { border-color: var(--black); color: var(--black); }

/* Ambos: font-size --size-xs; letter-spacing 0.18em; uppercase; weight 500 */
```

---

## 7. Estructura de archivos relevantes

```
anothershop/
  design.md                    ← este archivo
  frontend/
    index.html
    src/
      index.css                ← ÚNICO archivo de estilos globales
      App.jsx                  ← Routing principal
      pages/
        Home.jsx               ← Landing (hero + footer inline)
        Catalog.jsx            ← Listado con filtros y buscador
        Product.jsx            ← Detalle con carrusel de imágenes
        About.jsx
        Login.jsx
        Account.jsx
        Admin.jsx              ← Panel admin (ruta /admin)
        AdminImport.jsx        ← Importación de drops
        AdminCambios.jsx
      components/
        Nav.jsx                ← Navegación global
        ProductCard.jsx        ← Tarjeta con carrusel integrado
        TopBanner.jsx          ← Cinta de métodos de pago (solo /catalogo)
        InventoryModal.jsx
    public/
      npc.png                  ← Logo NPC original
      pexels-michael-obstoj-1772571864-33549631.jpg  ← Foto hero de la landing
  backend/
    app/
      main.py
      admin_router.py
    data/
      catalog.json             ← Fuente de verdad del catálogo (no editar desde frontend)
```

---

## 8. Identidad de marca

- **Nombre:** `ANOTHER NPC SHOP` (dinámico desde `catalog.meta.marca`)
- **Tono:** Minimalista, editorial, monocromático.
- **Estética:** Moda de nicho independiente. Espacio en blanco, tipografía de alta jerarquía, fotografía editorial.
- **Voz:** Concisa, todo-caps. Sin puntos al final de títulos.

---

## 9. Datos de producto

```json
{
  "id": "001",
  "nombre": "Nombre del producto",
  "precio": 49.99,
  "tallas": ["S", "M", "L"],
  "imagen": "https://...",
  "imagenes": ["https://img1", "https://img2"],
  "disponible": true,
  "drop": "Drop 1"
}
```

- `imagenes` → carrusel completo. `imagen` → primera imagen (compatibilidad).
- `disponible` → controlado por toggle manual en admin (no por stock).

---

## 10. Reglas para agentes

1. **Un único CSS:** todo va en `frontend/src/index.css`.
2. **Variables siempre:** `var(--black)`, no `#0a0a0a`.
3. **BEM:** `.bloque__elemento--modificador`.
4. **Sin Tailwind** salvo instrucción explícita.
5. **Nav global:** no reemplazarlo en páginas interiores.
6. **Fade de entrada:** todas las páginas interiores usan `fadeIn` o `slowFadeIn`.
7. **Imágenes:** `aspect-ratio: 3/4`, `object-fit: cover`, `background: var(--grey-100)`.
8. **Botones primarios:** fondo `--black`, texto `--white`, sin border-radius, uppercase.
9. **`/` (Home/Landing) está excluido** — se rediseñará por separado; no tomar su CSS como referencia.
10. **No modificar `catalog.json`** directamente — el backend lo gestiona vía `/admin`.
