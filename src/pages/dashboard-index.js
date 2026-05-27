import { bootstrapDashPage } from '../../shared/dashboard-shell.js'

;(async () => {
    const ctx = await bootstrapDashPage('inicio');
    if (!ctx) return;

    const { negocio } = ctx;

    document.getElementById('dash-fecha').textContent = new Date().toLocaleDateString('es-AR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    if (!negocio) {
        document.getElementById('dash-error-container').innerHTML = `<div class="dash-error">
            No se encontró un negocio asociado a tu cuenta. Contactá al administrador.
        </div>`;
        return;
    }
    document.getElementById('negocio-nombre').textContent = negocio.nombre_negocio || '—';
    document.getElementById('negocio-slug').textContent = negocio.slug || '—';
    document.getElementById('negocio-telefono').textContent = negocio.telefono_negocio || '—';
    document.getElementById('link-catalogo').href = '/u/index.html';
})();
