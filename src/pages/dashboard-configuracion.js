import { bootstrapDashPage, mountDashShell } from '../../shared/dashboard-shell.js'
import { actualizarNegocio } from '../../services/negocios.service.js'
import { parseGoogleSheetUrl, parseAppsScriptUrl } from '../../services/sheets.service.js'

const feedback = document.getElementById('cfg-feedback');
function showFeedback(msg, ok) {
    feedback.hidden = false;
    feedback.textContent = msg;
    feedback.className = 'dash-feedback ' + (ok ? 'ok' : 'error');
    setTimeout(() => { feedback.hidden = true; }, 5000);
}

function setBadge(status) {
    const badge = document.getElementById('sync-badge');
    const labels = {
        disconnected: 'desconectada',
        pending: 'configurando…',
        connected: 'conectada',
        error: 'error'
    };
    badge.textContent = labels[status] || labels.disconnected;
    badge.className = 'sync-badge ' + (status || 'disconnected');
}

function setLastSyncInfo(negocio) {
    const el = document.getElementById('last-sync-info');
    if (negocio.google_last_sync_at) {
        const d = new Date(negocio.google_last_sync_at);
        el.textContent = `Última sincronización: ${d.toLocaleString('es-AR')}`;
        el.style.color = 'var(--color-desc)';
    } else if (negocio.google_last_sync_error) {
        el.textContent = `Último error: ${negocio.google_last_sync_error}`;
        el.style.color = '#c0392b';
    } else {
        el.textContent = '';
    }
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
    document.getElementById('cfg-sheet-url').value = negocio.google_sheet_url || '';
    document.getElementById('cfg-script-url').value = negocio.google_apps_script_url || '';
    document.getElementById('cfg-script-secret').value = negocio.google_apps_script_secret || '';
    document.getElementById('cfg-sync-enabled').checked = !!negocio.google_sync_enabled;

    setBadge(negocio.google_sync_status || 'disconnected');
    setLastSyncInfo(negocio);

    document.getElementById('cfg-save').addEventListener('click', async () => {
        const nombre = document.getElementById('cfg-nombre').value.trim();
        const telefono = document.getElementById('cfg-telefono').value.trim();
        const sheetUrlInput = document.getElementById('cfg-sheet-url');
        const scriptUrlInput = document.getElementById('cfg-script-url');
        const sheetUrlRaw = sheetUrlInput.value.trim();
        const scriptUrlRaw = scriptUrlInput.value.trim();
        const scriptSecret = document.getElementById('cfg-script-secret').value.trim();
        const syncEnabled = document.getElementById('cfg-sync-enabled').checked;

        sheetUrlInput.classList.remove('input-error');
        scriptUrlInput.classList.remove('input-error');

        if (!nombre) {
            showFeedback('El nombre es obligatorio', false);
            return;
        }

        let parsedSheet = null;
        if (sheetUrlRaw) {
            parsedSheet = parseGoogleSheetUrl(sheetUrlRaw);
            if (!parsedSheet) {
                sheetUrlInput.classList.add('input-error');
                showFeedback('URL del Sheet inválida. Debe ser https://docs.google.com/spreadsheets/d/...', false);
                return;
            }
        }

        let parsedScript = null;
        if (scriptUrlRaw) {
            parsedScript = parseAppsScriptUrl(scriptUrlRaw);
            if (!parsedScript) {
                scriptUrlInput.classList.add('input-error');
                showFeedback('URL del Apps Script inválida. Debe ser https://script.google.com/macros/s/.../exec', false);
                return;
            }
        }

        if (syncEnabled && (!parsedSheet || !parsedScript || !scriptSecret)) {
            showFeedback('Para habilitar sync necesitás Sheet URL, Apps Script URL y token secreto.', false);
            return;
        }

        let syncStatus = 'disconnected';
        if (parsedSheet && parsedScript && scriptSecret) {
            syncStatus = syncEnabled ? 'connected' : 'pending';
        }

        const btn = document.getElementById('cfg-save');
        btn.disabled = true;
        btn.textContent = 'Guardando…';

        const updates = {
            nombre_negocio: nombre,
            telefono_negocio: telefono || null,
            google_sheet_url: parsedSheet ? parsedSheet.url : null,
            google_sheet_id: parsedSheet ? parsedSheet.id : null,
            google_apps_script_url: parsedScript ? parsedScript.url : null,
            google_apps_script_secret: scriptSecret || null,
            google_sync_enabled: syncEnabled,
            google_sync_status: syncStatus
        };

        const actualizado = await actualizarNegocio(negocio.id, updates);
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';

        if (!actualizado) {
            showFeedback('Error guardando. Revisá la consola.', false);
            return;
        }
        showFeedback('✓ Cambios guardados', true);
        setBadge(actualizado.google_sync_status || 'disconnected');
        setLastSyncInfo(actualizado);

        mountDashShell({
            active: 'configuracion',
            userEmail: ctx.session.user.email,
            negocio: actualizado
        });
    });
})();
