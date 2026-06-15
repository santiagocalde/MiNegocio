# NovaStock Design System (Ocean Dark)

## 🎨 Paleta de Colores Principal
El rediseño "Ocean Dark" reemplaza la antigua temática violeta por una paleta marina nocturna que evoca profesionalismo, calma y alta legibilidad técnica.

- **Fondo Global (Ocean Dark):** `#0B132B` (Azul Noche profundo, casi negro). Se utiliza como canvas para toda la página.
- **Backgrounds Secundarios (Tarjetas/Secciones):** Variaciones translúcidas como `rgba(30,58,95,0.8)` o fondos sólidos `#121E36` para componentes elevados.
- **Acento Primario (Turquesa):** `#14BBA6`. Se utiliza para botones de acción principal, iconos destacados y glows sutiles.
- **Acento Secundario (Verde Agua Profundo):** `#0F8A7D`. Complementa al turquesa en gradientes.
- **Highlight (Cian Neón):** `#00E5FF`. Exclusivo para detalles de altísima jerarquía (Ej: Checkmarks de "MiNegocio", insignias).
- **Textos:**
  - Principal: `#ffffff` o `#f8fafc`.
  - Secundario (Muted): `#E6FFFB` (opacidades del 40% al 70%).

## 🔲 Botones
- **Primario (`.lp-btn--primary`):** 
  - Base: Gradiente `linear-gradient(135deg, #14BBA6, #0F8A7D)`.
  - Hover: Gradiente más brillante `linear-gradient(135deg, #1ae2cd, #14BBA6)` con `scale(1.02)`.
- **Secundario (`.lp-btn--ghost`):** Fondo transparente con borde `rgba(255,255,255,0.12)`. En hover se ilumina ligeramente el fondo con blanco translúcido.

## 📐 Efectos Globales
- **Glassmorphism:** Las tarjetas utilizan `background: rgba(255,255,255,0.015)` con `backdrop-filter: blur(10px)` para integrarse orgánicamente al fondo.
- **Pop-Out Effect:** Los elementos que queremos destacar fuertemente (como la columna MiNegocio) deben usar un `position: absolute` con márgenes negativos (ej: `top: -16px, bottom: -16px`) y `z-index` superior para sobresalir del contenedor padre.
- **Glows:** Usados moderadamente con `radial-gradient` en `position: absolute` por detrás de los contenedores importantes para emular luz ambiental.

*Este documento refleja las reglas unificadas tras la optimización visual de la Landing Page.*
