/**
 * Configuración global de Umai Sushi.
 *
 * NOTA SEGURIDAD: la `claveCocina` vive en frontend — solo oculta UI,
 * no protege Supabase. La seguridad real depende de RLS + Auth (ver
 * MIGRATIONS.md). Para MVP es aceptable.
 */
window.UMASUSHI_CONFIG = {
    // Clave para acceder al panel de cocina y confirmar acciones admin
    claveCocina: 'umai123',

    // WhatsApp del negocio (sin espacios ni +)
    whatsappNumero: '542604539727'

    // Mapas: OpenStreetMap + Leaflet + Nominatim (sin API key)
};
