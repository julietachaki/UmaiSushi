import { bootstrapDashPage } from '../../shared/dashboard-shell.js'
import { obtenerZonas } from '../../services/zonas.service.js'
import { zonasTableHtmlCircle, configurarZonasCircleAdmin } from '../../zonas-leaflet.js'

;(async () => {
    const host = document.getElementById('zonas-host');
    function showError(msg) {
        if (host) host.innerHTML = `<div class="dash-error">${msg}</div>`;
        console.error('[zonas-page]', msg);
    }
    try {
        const ctx = await bootstrapDashPage('zonas');
        if (!ctx) return;
        const { negocio } = ctx;
        if (!negocio) {
            showError('No se encontró un negocio asociado a tu cuenta.');
            return;
        }
        window.CURRENT_NEGOCIO_ID = negocio.id;

        const zonas = await obtenerZonas({ negocioId: negocio.id });
        console.log('[zonas-page] cargadas', zonas.length, 'zonas');

        host.innerHTML = zonasTableHtmlCircle(zonas);
        configurarZonasCircleAdmin(host);
    } catch (e) {
        console.error('[zonas-page] error:', e);
        showError('Error inesperado: ' + (e?.message || e));
    }
})();
