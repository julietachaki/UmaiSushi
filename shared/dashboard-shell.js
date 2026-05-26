import { mountAuthGuard } from './auth-guard.js'
import { obtenerMiNegocio } from '../services/negocios.service.js'
import { signOut, getCurrentSession } from '../services/auth.service.js'

const DASH_NAV_ITEMS = [
    { key: 'inicio',        label: 'Inicio',         href: '/dashboard/' },
    { key: 'pedidos',       label: 'Pedidos',        href: '/dashboard/pedidos.html' },
    { key: 'menu',          label: 'Menú',           href: '/dashboard/menu.html' },
    { key: 'zonas',         label: 'Zonas',          href: '/dashboard/zonas.html' },
    { key: 'configuracion', label: 'Configuración',  href: '/dashboard/configuracion.html' }
]

function dashEscapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function dashToggleDrawer() {
    const sidebar = document.getElementById('dash-mobile-drawer')
    if (sidebar) sidebar.classList.toggle('active')
}

export function mountDashShell(opts = {}) {
    const headerMount = document.getElementById('dash-header-mount')
    const drawerMount = document.getElementById('dash-drawer-mount')
    if (!headerMount) {
        console.warn('[dashboard-shell] No hay #dash-header-mount')
        return
    }
    const active = opts.active || 'inicio'
    const email = opts.userEmail || ''
    const negocio = opts.negocio || null
    const brandLabel = negocio?.nombre_negocio || 'Umai Sushi'

    const navDesktopHtml = DASH_NAV_ITEMS.map(item => {
        const cls = item.key === active ? 'dash-active' : ''
        return `<a href="${item.href}" class="${cls}">${dashEscapeHtml(item.label)}</a>`
    }).join('')

    const navDrawerHtml = DASH_NAV_ITEMS.map(item => {
        const cls = item.key === active ? 'dash-active' : ''
        return `<a href="${item.href}" class="${cls}" onclick="dashToggleDrawer()">${dashEscapeHtml(item.label)}</a>`
    }).join('')

    headerMount.outerHTML = `
        <header class="main-header">
            <div class="dash-container">
                <div class="dash-logo">
                    <a href="/dashboard/">${dashEscapeHtml(brandLabel)}</a>
                </div>
                <nav class="dash-nav-desktop">${navDesktopHtml}</nav>
                <div class="dash-user-menu">
                    <span class="dash-user-email" title="${dashEscapeHtml(email)}">${dashEscapeHtml(email)}</span>
                    <button type="button" class="dash-logout-btn" id="dash-logout-btn">Salir</button>
                </div>
                <div class="dash-hamburger" onclick="dashToggleDrawer()" aria-label="Abrir menú">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </header>
    `

    if (drawerMount) {
        drawerMount.outerHTML = `
            <div class="dash-sidebar" id="dash-mobile-drawer">
                <div class="dash-sidebar-overlay" onclick="dashToggleDrawer()"></div>
                <div class="dash-sidebar-content">
                    ${navDrawerHtml}
                    <div class="dash-sidebar-user">
                        <p>${dashEscapeHtml(email)}</p>
                        <button type="button" class="dash-logout-btn" id="dash-logout-btn-mobile" style="width:100%; margin-top:8px;">Cerrar sesión</button>
                    </div>
                </div>
            </div>
        `
    }

    function doLogout() {
        if (typeof signOut === 'function') signOut()
        location.replace('/login/')
    }
    const btnDesk = document.getElementById('dash-logout-btn')
    const btnMob = document.getElementById('dash-logout-btn-mobile')
    if (btnDesk) btnDesk.addEventListener('click', doLogout)
    if (btnMob) btnMob.addEventListener('click', doLogout)
}

export async function bootstrapDashPage(activeKey) {
    if (typeof mountAuthGuard !== 'function') {
        console.error('[dashboard-shell] auth-guard.js no cargado')
        return null
    }
    const session = await mountAuthGuard()
    if (!session) return null

    const negocio = typeof obtenerMiNegocio === 'function' ? await obtenerMiNegocio() : null
    mountDashShell({ active: activeKey, userEmail: session.user.email, negocio })

    const loading = document.getElementById('dash-loading')
    if (loading) loading.style.display = 'none'
    const main = document.getElementById('dash-main-wrap')
    if (main) main.style.display = 'block'

    return { session, negocio }
}
