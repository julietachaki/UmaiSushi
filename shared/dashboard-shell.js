/**
 * DASHBOARD SHELL — UmaiSushi
 *
 * Helpers para montar el chrome común del dashboard (sidebar, header,
 * logout). Las páginas privadas /dashboard/* lo invocan después de
 * pasar el auth-guard.
 *
 * Uso:
 *   <div id="dash-sidebar-mount"></div>
 *   ...
 *   mountDashSidebar({ active: 'pedidos', userEmail, negocio });
 */

const DASH_NAV_ITEMS = [
    { key: 'inicio', label: 'Inicio', href: '/dashboard/' },
    { key: 'pedidos', label: 'Pedidos', href: '/dashboard/pedidos.html' },
    { key: 'menu', label: 'Menú', href: '/dashboard/menu.html' },
    { key: 'zonas', label: 'Zonas', href: '/dashboard/zonas.html' },
    { key: 'configuracion', label: 'Configuración', href: '/dashboard/configuracion.html' }
];

function dashEscapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Inyectar el sidebar en el contenedor #dash-sidebar-mount.
 * @param {{ active: string, userEmail?: string, negocio?: object }} opts
 */
function mountDashSidebar(opts = {}) {
    const mount = document.getElementById('dash-sidebar-mount');
    if (!mount) {
        console.warn('[dashboard-shell] No hay #dash-sidebar-mount, salteo');
        return;
    }
    const active = opts.active || 'inicio';
    const email = opts.userEmail || '';
    const negocio = opts.negocio || null;

    const navHtml = DASH_NAV_ITEMS.map(item => {
        const cls = item.key === active ? 'active' : '';
        return `<a href="${item.href}" class="${cls}">${dashEscapeHtml(item.label)}</a>`;
    }).join('');

    mount.innerHTML = `
        <aside class="dash-sidebar">
            <h1>${dashEscapeHtml(negocio?.nombre_negocio || 'Umai Sushi')}</h1>
            <p class="dash-sub">Panel admin</p>
            <nav>${navHtml}</nav>
            <div class="dash-sidebar-footer">
                <div class="dash-user-email">${dashEscapeHtml(email)}</div>
                <button class="dash-logout-btn" id="dash-logout-btn">Cerrar sesión</button>
            </div>
        </aside>
    `;

    // Wire logout
    const logoutBtn = document.getElementById('dash-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            logoutBtn.disabled = true;
            logoutBtn.textContent = 'Cerrando…';
            if (typeof signOut === 'function') await signOut();
            location.replace('/login/');
        });
    }
}

/**
 * Helper: bootstrap completo. Hace auth-guard, obtiene negocio, monta
 * sidebar. Devuelve { session, negocio } o null si falla.
 * @param {string} activeKey - key del item activo en el sidebar
 */
async function bootstrapDashPage(activeKey) {
    if (typeof mountAuthGuard !== 'function') {
        console.error('[dashboard-shell] auth-guard.js no cargado');
        return null;
    }
    const session = await mountAuthGuard();
    if (!session) return null;

    const negocio = typeof obtenerMiNegocio === 'function' ? await obtenerMiNegocio() : null;
    mountDashSidebar({ active: activeKey, userEmail: session.user.email, negocio });

    // Mostrar layout
    const loading = document.getElementById('dash-loading');
    if (loading) loading.style.display = 'none';
    const layout = document.getElementById('dash-layout');
    if (layout) layout.style.display = 'grid';

    return { session, negocio };
}
