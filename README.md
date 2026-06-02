# Umai Sushi 🍣
Plataforma web de pedidos de sushi con menú interactivo, gestión de pedidos en tiempo real y panel de administración multi-negocio.
## ✨ Funcionalidades
- **Menú público** — Visualización de productos por categoría con soporte para extras y etiquetas (veggi, gluten free)
- **Carrito de compras** — Sistema de pedidos con cálculo de delivery y envío por WhatsApp
- **Dashboard administrador** — Panel CRUD para gestionar productos, pedidos y zonas de delivery
- **Mapa interactivo** — Zonas de delivery dibujadas con Leaflet y OpenStreetMap
- **Tiempo real** — Actualización en vivo de pedidos entrantes vía Supabase Realtime
- **Multi-negocio** — Arquitectura multi-tenant, cada negocio con su propio menú y zonas
- **Autenticación** — Login por email/contraseña con Supabase Auth y RLS
## 🛠️ Stack
| Tecnología | Propósito |
|---|---|
| [Vite 8](https://vitejs.dev/) (MPA) | Build tool, múltiples páginas sin framework |
| [Supabase](https://supabase.com/) | Base de datos PostgreSQL, Auth, Realtime, Storage |
| [Leaflet](https://leafletjs.com/) + OSM | Mapas de zonas de delivery |
| [Vercel](https://vercel.com/) | Despliegue y hosting |
## 🚀 Primeros pasos
### Prerrequisitos
- Node.js 18+
- npm
