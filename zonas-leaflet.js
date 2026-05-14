/**
 * Admin Zonas de Entrega (Leaflet + OpenStreetMap)
 * - Mapa interactivo para seleccionar centros
 * - Radio dinámico
 * - Guardar en localStorage
 * NO depende de Google Maps
 */

function zonasNormalize(zonas) {
    var zs = Array.isArray(zonas) ? zonas : [];
    return zs.map(function (z) {
        var id = z && z.id ? String(z.id) : 'z-' + Math.random().toString(36).slice(2, 11);
        var nombre = z && z.nombre != null ? String(z.nombre) : '';
        var envio = Number(z && z.envio) || 0;
        var center = z && z.center && typeof z.center === 'object' ? z.center : null;
        var radiusM = z && z.radiusM != null ? Number(z.radiusM) : null;
        if (center && (isNaN(Number(center.lat)) || isNaN(Number(center.lng)))) center = null;
        if (radiusM != null && !isFinite(radiusM)) radiusM = null;
        return { id: id, nombre: nombre, envio: envio, center: center, radiusM: radiusM };
    });
}

function zonasRowHtmlCircle(z) {
    var idAttr = umasushiEscapeHtml(z.id);
    var nombre = umasushiEscapeHtml(z.nombre || '');
    var envio = Number(z.envio) || 0;
    var radiusM = z.radiusM != null ? Number(z.radiusM) : 1500;
    var radiusKm = (radiusM / 1000).toFixed(1);
    var centerTxt =
        z.center && z.center.lat != null && z.center.lng != null
            ? Number(z.center.lat).toFixed(5) + ', ' + Number(z.center.lng).toFixed(5)
            : '—';
    return `<tr data-zone-id="${idAttr}">
      <td><input class="inp-modern zona-nombre" type="text" value="${nombre}"></td>
      <td><input class="inp-modern zona-envio" type="number" min="0" step="50" value="${envio}"></td>
      <td>
        <div class="zona-map-row">
          <input class="inp-modern zona-center" type="text" placeholder="Centro (lat,lng)" value="${umasushiEscapeHtml(centerTxt)}" readonly>
          <button type="button" class="btn-secondary zona-map-edit">Mapa</button>
        </div>
        <div class="zona-radius-row">
          <label class="muted small">Radio (km)</label>
          <input class="inp-modern zona-radius" type="number" min="0.1" step="0.1" value="${radiusKm}">
        </div>
      </td>
      <td><button type="button" class="btn-ghost zona-eliminar" title="Quitar">✕</button></td>
    </tr>`;
}

function zonasTableHtmlCircle(zonas) {
    var zs = zonasNormalize(zonas);
    var body = zs.map(zonasRowHtmlCircle).join('');
    if (!body) body = '<tr class="muted"><td colspan="4">Sin zonas. Agregá al menos una.</td></tr>';
    return `
    <section class="zonas-admin-card pedido-card-shell">
      <div class="zonas-admin-head">
        <h3>Zonas de envío (OpenStreetMap)</h3>
        <p class="muted small">Definí zonas exclusivamente por círculo (centro + radio). El sistema calcula delivery por coordenadas geográficas. 100% gratis, sin APIs pagas.</p>
      </div>
      <div class="table-wrap">
      <table class="zonas-table">
        <thead><tr><th>Nombre zona</th><th>Costo envío ($)</th><th>Cobertura (círculo)</th><th></th></tr></thead>
        <tbody id="zonas-tbody">${body}</tbody>
      </table>
      </div>
      <div class="zonas-admin-actions">
        <button type="button" id="zona-agregar" class="btn-secondary">Agregar zona</button>
        <button type="button" id="zona-guardar" class="btn-primary">Guardar zonas</button>
        <button type="button" id="zona-ejemplo" class="btn-secondary">Restaurar ejemplo</button>
      </div>
      <p id="zonas-feedback" class="muted small zonas-feedback" hidden></p>
      <div id="zonas-modal" class="umai-modal" hidden>
        <div class="umai-modal-overlay" data-close="1"></div>
        <div class="umai-modal-card">
          <div class="umai-modal-head">
            <strong>Seleccionar zona (Leaflet Map)</strong>
            <button type="button" class="btn-ghost" data-close="1">✕</button>
          </div>
          <div class="form-row">
            <label for="zonas-search">Buscar ubicación (Nominatim)</label>
            <input id="zonas-search" class="inp-modern" type="text" placeholder="Escribí la dirección o barrio">
            <div id="zonas-search-results" class="direccion-sugerencias-dropdown" hidden></div>
          </div>
          <div id="zonas-map" class="umai-map" style="height: 400px; border-radius: 4px;"></div>
          <div class="umai-modal-foot">
            <p class="muted small">Tocá el mapa para elegir el centro. Ajustá el radio desde la tabla.</p>
            <button type="button" class="btn-primary" id="zonas-modal-ok">Listo</button>
          </div>
        </div>
      </div>
    </section>`;
}

function configurarZonasCircleAdmin(container) {
    console.log('[leaflet-admin] configurarZonasCircleAdmin iniciado');
    var tbody = container.querySelector('#zonas-tbody');
    var modal = container.querySelector('#zonas-modal');
    var mapEl = container.querySelector('#zonas-map');
    var searchInput = container.querySelector('#zonas-search');
    var searchResults = container.querySelector('#zonas-search-results');
    var modalOk = container.querySelector('#zonas-modal-ok');

    if (!container || !tbody) {
        console.error('[leaflet-admin] contenedor o tbody no encontrado.');
        return;
    }

    function showFb(msg, ok) {
        var fb = container.querySelector('#zonas-feedback');
        if (!fb) return;
        fb.hidden = false;
        fb.textContent = msg;
        fb.style.color = ok ? '#0f490f' : '#c0392b';
        setTimeout(function () {
            fb.hidden = true;
        }, 4000);
    }

    function openModal() {
        if (!modal) return;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = '';
    }

    modal.addEventListener('click', function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-close') === '1') closeModal();
    });

    var editingTr = null;
    var leafletMap = null;
    var marker = null;
    var circle = null;

    function ensureMap() {
        if (leafletMap) return Promise.resolve(leafletMap);

        if (!window.L) {
            return Promise.reject(new Error('Leaflet.js no cargado'));
        }

        // Inicializar mapa Leaflet
        try {
            leafletMap = L.map(mapEl).setView([-34.6177, -68.3301], 13);

            // OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(leafletMap);

            marker = L.marker([-34.6177, -68.3301]);
            marker.addTo(leafletMap);

            // Click en mapa para seleccionar centro
            leafletMap.on('click', function (e) {
                if (!editingTr) return;
                var lat = e.latlng.lat;
                var lng = e.latlng.lng;
                marker.setLatLng([lat, lng]);
                leafletMap.setView([lat, lng], leafletMap.getZoom());

                // Actualizar circle
                if (circle) {
                    leafletMap.removeLayer(circle);
                }
                var radiusKm = Number(editingTr.querySelector('.zona-radius')?.value) || 1.5;
                var radiusM = radiusKm * 1000;
                circle = L.circle([lat, lng], {
                    radius: radiusM,
                    color: '#3388ff',
                    fillColor: '#3388ff',
                    fillOpacity: 0.2,
                    weight: 2
                }).addTo(leafletMap);

                var centerInp = editingTr.querySelector('.zona-center');
                if (centerInp) centerInp.value = lat.toFixed(5) + ', ' + lng.toFixed(5);
                editingTr.dataset.centerLat = String(lat);
                editingTr.dataset.centerLng = String(lng);

                console.log('[leaflet-admin] Centro actualizado:', lat, lng);
            });

            // Search con Nominatim
            if (searchInput && typeof initNominatimAutocomplete === 'function') {
                initNominatimAutocomplete(searchInput, searchResults, function (sel) {
                    if (!sel || !sel.coords) return;
                    var lat = sel.coords.lat;
                    var lng = sel.coords.lng;
                    marker.setLatLng([lat, lng]);
                    leafletMap.setView([lat, lng], leafletMap.getZoom());

                    if (editingTr) {
                        editingTr.dataset.centerLat = String(lat);
                        editingTr.dataset.centerLng = String(lng);
                        var centerInp = editingTr.querySelector('.zona-center');
                        if (centerInp) centerInp.value = lat.toFixed(5) + ', ' + lng.toFixed(5);
                    }

                    console.log('[leaflet-admin] Ubicación de Nominatim:', lat, lng);
                });
            }

            console.log('[leaflet-admin] Mapa Leaflet inicializado');
            return Promise.resolve(leafletMap);
        } catch (err) {
            console.error('[leaflet-admin] Error inicializando Leaflet:', err);
            return Promise.reject(err);
        }
    }

    tbody.addEventListener('click', function (e) {
        var del = e.target.closest('.zona-eliminar');
        if (del) {
            var tr = del.closest('tr');
            if (tr) tr.remove();
            return;
        }

        var edit = e.target.closest('.zona-map-edit');
        if (edit) {
            editingTr = edit.closest('tr');
            openModal();
            ensureMap()
                .then(function () {
                    var lat = Number(editingTr.dataset.centerLat);
                    var lng = Number(editingTr.dataset.centerLng);

                    if (isFinite(lat) && isFinite(lng)) {
                        leafletMap.setView([lat, lng], leafletMap.getZoom());
                        marker.setLatLng([lat, lng]);

                        // Mostrar circle
                        var radiusKm = Number(editingTr.querySelector('.zona-radius')?.value) || 1.5;
                        var radiusM = radiusKm * 1000;
                        if (circle) leafletMap.removeLayer(circle);
                        circle = L.circle([lat, lng], {
                            radius: radiusM,
                            color: '#3388ff',
                            fillColor: '#3388ff',
                            fillOpacity: 0.2
                        }).addTo(leafletMap);
                    } else {
                        leafletMap.setView([-34.6177, -68.3301], 13);
                        marker.setLatLng([-34.6177, -68.3301]);
                    }

                    // Redibujar mapa
                    setTimeout(function () {
                        leafletMap.invalidateSize();
                    }, 100);
                })
                .catch(function (err) {
                    showFb('Error cargando mapa: ' + err.message, false);
                    closeModal();
                });
        }
    });

    // Listener para cambios en radio
    tbody.addEventListener('change', function (e) {
        if (e.target.classList.contains('zona-radius') && editingTr && leafletMap && typeof L !== 'undefined') {
            var lat = Number(editingTr.dataset.centerLat);
            var lng = Number(editingTr.dataset.centerLng);
            if (isFinite(lat) && isFinite(lng)) {
                var radiusKm = Number(e.target.value) || 1.5;
                var radiusM = radiusKm * 1000;
                if (circle) leafletMap.removeLayer(circle);
                circle = L.circle([lat, lng], {
                    radius: radiusM,
                    color: '#3388ff',
                    fillColor: '#3388ff',
                    fillOpacity: 0.2
                }).addTo(leafletMap);
                console.log('[leaflet-admin] Radio actualizado:', radiusM, 'm');
            }
        }
    });

    if (modalOk) {
        modalOk.addEventListener('click', closeModal);
    }

    container.querySelector('#zona-agregar').addEventListener('click', function () {
        tbody.querySelectorAll('tr.muted').forEach(function (r) {
            r.remove();
        });
        tbody.insertAdjacentHTML(
            'beforeend',
            zonasRowHtmlCircle({
                id: 'z-' + Math.random().toString(36).slice(2, 11),
                nombre: 'Nueva zona',
                envio: 1500,
                center: null,
                radiusM: 1500
            })
        );
    });

    container.querySelector('#zona-guardar').addEventListener('click', async function () {
        var btn = this;
        var filas = Array.from(tbody.querySelectorAll('tr'));
        var zonas = [];
        for (var i = 0; i < filas.length; i++) {
            var tr = filas[i];
            if (tr.classList.contains('muted')) continue;
            var nombre = tr.querySelector('.zona-nombre')?.value?.trim();
            var envStr = tr.querySelector('.zona-envio')?.value;
            var radiusStr = tr.querySelector('.zona-radius')?.value;
            if (!nombre) continue;

            var id = tr.getAttribute('data-zone-id') || '';
            var envio = parseInt(envStr, 10) >= 0 ? parseInt(envStr, 10) : 0;
            var radiusKm = parseFloat(radiusStr);
            var radiusM = !isNaN(radiusKm) && radiusKm >= 0 ? Math.round(radiusKm * 1000) : 0;

            var lat = Number(tr.dataset.centerLat);
            var lng = Number(tr.dataset.centerLng);
            var center = isFinite(lat) && isFinite(lng) ? { lat: lat, lng: lng } : null;

            if (!center) {
                showFb('La zona ' + nombre + ' necesita un centro.', false);
                return;
            }

            zonas.push({
                id: id || null,
                nombre: nombre,
                envio: envio,
                radiusM: radiusM,
                center: center
            });
        }

        if (!zonas.length) {
            showFb('Agregá al menos una zona con centro.', false);
            return;
        }

        if (typeof guardarZonas !== 'function') {
            showFb('Servicio Supabase no disponible.', false);
            return;
        }

        btn.disabled = true;
        var labelOriginal = btn.textContent;
        btn.textContent = 'Guardando…';
        try {
            var resultado = await guardarZonas(zonas);
            if (!resultado) {
                showFb('No se pudo guardar (Supabase). Revisá la consola.', false);
                return;
            }
            console.log('[leaflet-admin] ✓ Zonas guardadas en Supabase:', resultado);
            showFb('Zonas guardadas (' + resultado.length + ').', true);
            // Re-pintar tabla con los IDs UUID asignados por Postgres
            tbody.innerHTML = resultado.map(zonasRowHtmlCircle).join('');
            tbody.querySelectorAll('tr').forEach(function (tr, idx) {
                var z = resultado[idx];
                if (z && z.center) {
                    tr.dataset.centerLat = String(z.center.lat);
                    tr.dataset.centerLng = String(z.center.lng);
                }
            });
        } catch (err) {
            console.error('[leaflet-admin] Error guardando:', err);
            showFb('Error guardando zonas.', false);
        } finally {
            btn.disabled = false;
            btn.textContent = labelOriginal;
        }
    });

    container.querySelector('#zona-ejemplo').addEventListener('click', async function () {
        var ejemplo = [
            {
                // Sin id → Postgres genera UUID
                nombre: 'Centro',
                envio: 1500,
                center: { lat: -34.6177, lng: -68.3301 },
                radiusM: 1800
            }
        ];
        if (typeof guardarZonas !== 'function') {
            showFb('Servicio Supabase no disponible.', false);
            return;
        }
        try {
            var resultado = await guardarZonas(ejemplo);
            if (!resultado) {
                showFb('No se pudo cargar el ejemplo.', false);
                return;
            }
            tbody.innerHTML = resultado.map(zonasRowHtmlCircle).join('');
            tbody.querySelectorAll('tr').forEach(function (tr, idx) {
                var z = resultado[idx];
                if (z && z.center) {
                    tr.dataset.centerLat = String(z.center.lat);
                    tr.dataset.centerLng = String(z.center.lng);
                }
            });
            showFb('Cargamos un ejemplo: Centro con radio 1.8 km.', true);
        } catch (err) {
            console.error('[leaflet-admin] Error en ejemplo:', err);
            showFb('Error cargando ejemplo.', false);
        }
    });

    // Bootstrap datasets
    tbody.querySelectorAll('tr[data-zone-id]').forEach(function (tr) {
        var centerTxt = tr.querySelector('.zona-center')?.value || '';
        var parts = centerTxt.split(',').map(function (x) {
            return Number(String(x).trim());
        });
        if (parts.length === 2 && isFinite(parts[0]) && isFinite(parts[1])) {
            tr.dataset.centerLat = String(parts[0]);
            tr.dataset.centerLng = String(parts[1]);
        }
    });

    console.log('[leaflet-admin] UI Configurada');
}

console.log('[zonas-leaflet] Zonas admin con Leaflet módulo cargado');
