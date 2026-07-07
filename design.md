# Another Shop — Design System

> Documento de referencia de identidad visual y sistema de diseño para agentes IA y colaboradores.
> Úsalo como punto de partida al rediseñar o crear nuevas páginas. **No alteres otras rutas sin instrucción explícita.**

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

## 4. Escala de espaciado

```css
--gap:       2rem      /* gap estándar entre elementos */
--gap-lg:    4rem      /* gap grande entre secciones */
--max-width: 1200px    /* máx. ancho del contenido */
```

- Padding lateral de páginas: `var(--gap)` (2rem)
- Separación de secciones: `var(--gap-lg)` (4rem)
- Máximo ancho centrado: `max-width: var(--max-width); margin: 0 auto;`

---

## 5. Transiciones y animaciones

```css
--transition: 200ms ease   /* transición estándar para hover */
```

| Uso | Valor |
|---|---|
| Hover de links, botones, colores | `200ms ease` |
| Hover de imágenes (scale/filter) | `350–600ms ease` |
| Fade-in al cargar una página | `0.5–0.6s ease` (keyframe `heroFadeIn`) |
| Fade-out al navegar | `0.5s ease` (keyframe `homeHeroFadeOut`) |
| Carrusel de imágenes | `400ms ease` (opacity) |

**Principio:** Cada página nueva debe tener un `fade-in` al montar y un `fade-out` antes de navegar.

```css
@keyframes heroFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes homeHeroFadeOut {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-8px); }
}
```

---

## 6. Componentes clave

### Nav (`Nav.jsx`)
- **Desktop:** Logo izquierda + links (Catálogo, Nosotros) + icono de usuario a la derecha.
- **Mobile:** Logo + botón hamburguesa → menú desplegable vertical.
- La marca (`nav__brand`) usa `font-size: 0.75rem`, `letter-spacing: 0.15em`, `text-transform: uppercase`, `white-space: nowrap`.
- El Nav aparece en **todas las rutas** excepto `/admin` y `/login`.
- La cinta de métodos de pago (`TopBanner`) **solo aparece en `/catalogo`**.
- No crear headers propios en las páginas interiores — usar el Nav global.

### ProductCard (`ProductCard.jsx`)
- Grid de tarjetas con `aspect-ratio: 3/4`.
- Carrusel de imágenes con transición `opacity: 400ms ease` si `producto.imagenes` tiene múltiples fotos.
- Flechas circulares (`30px`) con `backdrop-filter: blur` visibles on-hover.
- Dots de navegación en la parte inferior de la imagen.
- Botón de favorito (corazón) visible on-hover en la esquina inferior derecha.

### Carousel — Producto (`Product.jsx`)
- Carrusel con soporte de swipe táctil (touch events).
- Flechas con `position: absolute`, visibles on-hover, `border-radius: 50%`.
- Dots con tamaño activo ligeramente mayor (`scale(1.35)`).

### Botones

```css
/* Primario — fondo negro */
.btn-primary {
  background: var(--black);
  color: var(--white);
  border: 1px solid var(--black);
  padding: 1rem 2rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Outline — borde negro */
.btn-outline {
  background: transparent;
  color: var(--black);
  border: 1px solid var(--black);
  /* on-hover: invierte a fondo negro */
}
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
- **Tono:** Minimalista, editorial, monocromático. Sin colores vivos ni decoraciones recargadas.
- **Estética:** Inspirada en marcas de moda de nicho independiente. Mucho espacio en blanco, tipografía de alta jerarquía, imágenes en escala de grises que revelan color al hover.
- **Voz:** Concisa, directa. Títulos en todo-caps o minúsculas. Sin puntos al final de títulos.
- **Imágenes:** Fotografía editorial de grupo o de producto. Preferir blanco/negro con `filter: grayscale(15%)` y `grayscale(0%)` on-hover.

---

## 9. Datos de producto

Los productos tienen la siguiente estructura en el JSON:

```json
{
  "id": "001",
  "nombre": "Nombre del producto",
  "precio": 49.99,
  "color": "#ffffff",
  "tallas": ["S", "M", "L"],
  "imagen": "https://...",
  "imagenes": ["https://img1", "https://img2"],
  "disponible": true,
  "drop": 1
}
```

- `imagenes` es el array completo para el carrusel. `imagen` es la primera por compatibilidad.
- `drop` puede ser `1` o `2`. En `/admin/import` se filtran por drop activo.

---

## 10. Reglas para agentes al rediseñar

1. **No cambiar rutas ni lógica de negocio** — solo la capa visual y de presentación.
2. **Usar siempre las variables CSS** (`var(--black)`, `var(--grey-600)`, etc.) — no hardcodear colores.
3. **Mantener nomenclatura BEM** para clases CSS: `.bloque__elemento--modificador`.
4. **Añadir estilos a `index.css`** — no crear archivos CSS adicionales.
5. **No introducir Tailwind** ni librerías de CSS externas sin aprobación explícita del usuario.
6. **Respetar el Nav global** — no reemplazarlo por un header propio salvo en la ruta `/`.
7. **Implementar animaciones** de entrada (fade-in) y salida (fade-out) en páginas nuevas.
8. **No modificar `catalog.json` directamente** — el backend lo gestiona vía `/admin`.
9. **No mostrar menú hamburguesa en desktop** — el Nav global ya lo controla con media queries.
10. **Revisar `design.md`** antes de proponer cualquier cambio de paleta, fuente o componente.
