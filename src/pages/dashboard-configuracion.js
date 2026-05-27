import { bootstrapDashPage, mountDashShell } from '../../shared/dashboard-shell.js'
import { actualizarNegocio } from '../../services/negocios.service.js'

const feedback = document.getElementById('cfg-feedback');
function showFeedback(msg, ok) {
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.className = 'dash-feedback ' + (ok ? 'ok' : 'error');
    setTimeout(() => { feedback.hidden = true; }, 5000);
}

;(async () => {
    const ctx = await bootstrapDashPage('configuracion');
    if (!ctx) return;
    const { negocio } = ctx;
    if (!negocio) {
        document.querySelector('.dash-form-card').innerHTML =
            '<div class="dash-error">No se encontró tu negocio.</div>';
        return;
    }
    document.getElementById('cfg-slug').value = negocio.slug || '';
    document.getElementById('cfg-nombre').value = negocio.nombre_negocio || '';
    document.getElementById('cfg-telefono').value = negocio.telefono_negocio || '';

    document.getElementById('cfg-save').addEventListener('click', async () => {
        const nombre = document.getElementById('cfg-nombre').value.trim();
        const telefono = document.getElementById('cfg-telefono').value.trim();

        if (!nombre) {
            showFeedback('El nombre es obligatorio', false);
            return;
        }

        const btn = document.getElementById('cfg-save');
        btn.disabled = true;
        btn.textContent = 'Guardando…';

        const updates = {
            nombre_negocio: nombre,
            telefono_negocio: telefono || null
        };

        const actualizado = await actualizarNegocio(negocio.id, updates);
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';

        if (!actualizado) {
            showFeedback('Error guardando. Revisá la consola.', false);
            return;
        }
        showFeedback('✓ Cambios guardados', true);

        mountDashShell({
            active: 'configuracion',
            userEmail: ctx.session.user.email,
            negocio: actualizado
        });
    });
})();
