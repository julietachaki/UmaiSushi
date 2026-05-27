import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  appType: 'mpa',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'u-index': resolve(__dirname, 'u/index.html'),
        'u-pedido': resolve(__dirname, 'u/pedido.html'),
        'u-orden': resolve(__dirname, 'u/orden.html'),
        'dashboard-index': resolve(__dirname, 'dashboard/index.html'),
        'dashboard-menu': resolve(__dirname, 'dashboard/menu.html'),
        'dashboard-pedidos': resolve(__dirname, 'dashboard/pedidos.html'),
        'dashboard-zonas': resolve(__dirname, 'dashboard/zonas.html'),
        'dashboard-config': resolve(__dirname, 'dashboard/configuracion.html'),
        login: resolve(__dirname, 'login/index.html')
      }
    }
  }
})
