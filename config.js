/**
 * Configuración global del cliente público.
 *
 * IMPORTANTE: este archivo se sirve público. NO meter secretos.
 *
 * El acceso admin a /dashboard/* se autentica con Supabase Auth
 * (email + password). La clave hardcoded de cocina ya no existe.
 *
 * El número de WhatsApp por negocio vive en la tabla `negocios`
 * (columna `telefono_negocio`); este fallback solo sirve si script.js
 * no pudo resolver el negocio actual.
 */
window.UMASUSHI_CONFIG = {
    // Fallback WhatsApp (sin espacios ni +) si no se resolvió negocio
    whatsappNumero: '542604539727'

    // Mapas: OpenStreetMap + Leaflet + Nominatim (sin API key)
};
