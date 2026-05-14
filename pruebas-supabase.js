/**
 * PRUEBAS RÁPIDAS - UmaiSushi Supabase Migration
 * 
 * Archivo para testing desde la consola del navegador
 * Copiar y pegar en Consola (F12) de:
 * - index.html (para productos)
 * - pedido.html (para pedidos y zonas)
 */

// ============================================
// 1. PRUEBAS DE SUPABASE CLIENT
// ============================================
console.group('🧪 PRUEBA 1: Supabase Client');
console.log('Supabase listo:', isSupabaseReady());
console.log('Error (si existe):', getSupabaseError());
console.groupEnd();

// ============================================
// 2. PRUEBAS DE PRODUCTOS
// ============================================
console.group('🧪 PRUEBA 2: Productos');

async function testProductos() {
    console.log('▶ Obteniendo productos...');
    const productos = await obtenerProductos();
    console.log('✓ Productos cargados:', productos.length);
    console.table(productos.slice(0, 3)); // Mostrar primeros 3
    
    console.log('▶ Guardando producto de prueba...');
    const nuevoProd = await guardarProducto({
        nombre: 'TEST PROD',
        descripcion: 'Producto de prueba',
        precio: 9999,
        categoria: 'Productos',
        imagen: '/static/producto.jpeg'
    });
    console.log('✓ Producto guardado:', nuevoProd?.id);
    
    if (nuevoProd?.id) {
        console.log('▶ Actualizando producto...');
        const actualizado = await actualizarProducto(nuevoProd.id, { precio: 8888 });
        console.log('✓ Actualizado:', actualizado?.precio === 8888 ? 'OK' : 'ERROR');
        
        console.log('▶ Eliminando producto...');
        const eliminado = await eliminarProductoDeSupabase(nuevoProd.id);
        console.log('✓ Eliminado:', eliminado ? 'OK' : 'ERROR');
    }
}

testProductos();
console.groupEnd();

// ============================================
// 3. PRUEBAS DE PEDIDOS
// ============================================
console.group('🧪 PRUEBA 3: Pedidos');

async function testPedidos() {
    console.log('▶ Creando pedido de prueba...');
    const pedido = await crearPedido({
        cliente: 'Cliente Test',
        telefono: '2604539727',
        direccion_texto: 'Test Street 123',
        coords: { lat: -34.518, lng: -68.405 },
        maps_url: 'https://maps.example.com',
        productos: [
            { nombre: 'Clásico', cantidad: 2, precio: 7500 }
        ],
        total: 15000
    });
    console.log('✓ Pedido creado:', pedido?.id);
    console.log('Estado:', pedido?.estado);
    
    console.log('▶ Obteniendo pedidos...');
    const pedidos = await obtenerPedidos({ limite: 10 });
    console.log('✓ Pedidos cargados:', pedidos.length);
    console.table(pedidos.slice(0, 3)); // Primeros 3
    
    if (pedido?.id) {
        console.log('▶ Actualizando estado a "preparando"...');
        const actualizado = await actualizarEstadoPedido(pedido.id, 'preparando');
        console.log('✓ Estado actualizado:', actualizado?.estado);
        
        console.log('▶ Generando URL WhatsApp...');
        const urlWA = abrirWhatsAppConPedido(pedido, '542604539727');
        console.log('✓ URL generada:', urlWA?.substring(0, 50) + '...');
    }
}

testPedidos();
console.groupEnd();

// ============================================
// 4. PRUEBAS DE ZONAS
// ============================================
console.group('🧪 PRUEBA 4: Zonas de Delivery');

async function testZonas() {
    console.log('▶ Obteniendo zonas...');
    const zonas = await obtenerZonas();
    console.log('✓ Zonas cargadas:', zonas.length);
    console.table(zonas);
    
    console.log('▶ Creando zona de prueba...');
    const newZona = await crearZona({
        nombre: 'Zona Test',
        envio: 1000,
        center: { lat: -34.518, lng: -68.405 },
        radiusM: 2000
    });
    console.log('✓ Zona creada:', newZona?.nombre);
    
    console.log('▶ Calculando delivery...');
    const delivery = await calcularDeliveryAsync(
        { lat: -34.518, lng: -68.405 },
        zonas
    );
    console.log('✓ Dentro de zona:', delivery.ok);
    if (delivery.ok) {
        console.log('  Zona:', delivery.zone?.nombre);
        console.log('  Costo envío:', delivery.costoEnvio);
    }
}

testZonas();
console.groupEnd();

// ============================================
// 5. VERIFICAR SINCRONIZACIÓN LOCAL/SUPABASE
// ============================================
console.group('🧪 PRUEBA 5: Sincronización');

async function testSync() {
    console.log('▶ Sincronizando productos...');
    const syncProd = await sincronizarProductos();
    console.log('✓ Productos sincronizados:', syncProd);
    
    console.log('▶ Sincronizando pedidos...');
    const syncPed = await sincronizarPedidos();
    console.log('✓ Pedidos sincronizados:', syncPed);
    
    console.log('▶ Sincronizando zonas...');
    const syncZonas = await sincronizarZonas();
    console.log('✓ Zonas sincronizadas:', syncZonas);
}

testSync();
console.groupEnd();

// ============================================
// RESUMEN
// ============================================
console.group('📊 RESUMEN');
console.log(`
✅ Pruebas completadas
✅ Si todos los logs muestran ✓, la migración funciona correctamente
✅ Revisa los logs [supabase], [productos], [pedidos], [zonas]
❓ Si hay errores, verifica:
  - Credenciales en services/supabase.js
  - Tablas creadas en Supabase
  - Políticas RLS configuradas (si aplica)
`);
console.groupEnd();

// ============================================
// UTILIDADES ADICIONALES
// ============================================

/**
 * Limpiar localStorage (CUIDADO - destructivo)
 * Usar solo si algo está inconsistente
 */
function limpiarLocalStorage() {
    console.warn('⚠️ Limpiando localStorage...');
    localStorage.removeItem('umasushiMenu');
    localStorage.removeItem('menuProductos');
    localStorage.removeItem('umasushiZonas');
    localStorage.removeItem('ultimoPedido');
    console.log('✓ Limpieza completada');
}

/**
 * Ver todo lo que hay en localStorage
 */
function verLocalStorage() {
    console.group('📦 localStorage content');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
            const val = localStorage.getItem(key);
            const parsed = JSON.parse(val);
            console.log(`${key}:`, parsed);
        } catch (e) {
            console.log(`${key}:`, val);
        }
    }
    console.groupEnd();
}

/**
 * Ver estado general del sistema
 */
function verEstadoSistema() {
    console.group('⚙️ Estado del Sistema');
    console.log('Supabase inicializado:', isSupabaseReady());
    console.log('Productos en caché (Supabase):', typeof obtenerMenu === 'function' ? obtenerMenu().length : 0);
    console.log('Carrito actual:', obtenerPedido()?.length || 0, 'items');
    console.log('Zonas en localStorage:', obtenerZonas?.length || 0);
    console.groupEnd();
}

console.log(`
📝 FUNCIONES DE UTILIDAD DISPONIBLES:
- limpiarLocalStorage() - Limpiar localStorage (⚠️ destructivo)
- verLocalStorage() - Ver contenido de localStorage
- verEstadoSistema() - Ver estado actual del sistema
- testProductos() - Volver a correr prueba de productos
- testPedidos() - Volver a correr prueba de pedidos
- testZonas() - Volver a correr prueba de zonas
- testSync() - Volver a correr prueba de sincronización
`);
