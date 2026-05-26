import { umasushiEscapeHtml } from './order-shared.js'
import L from 'leaflet'

function generateGoogleMapsUrl(coords) {
    if (!coords || typeof coords !== 'object') return '';
    const lat = Number(coords.lat);
    const lng = Number(coords.lng);
    if (!isFinite(lat) || !isFinite(lng)) return '';
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=19/${lat}/${lng}`;
}

function parseNumberFromText(text) {
    if (!text || typeof text !== 'string') return '';
    var match = text.match(/\b(\d+[A-Za-z0-9]*)\b/);
    return match ? match[1] : '';
}

function formatShortAddress(result, previousText) {
    var address = (result && result.address) ? result.address : {};
    var road = address.road || address.pedestrian || address.residential || address.street || address.footway || address.path || '';
    var number = address.house_number || address.building || '';
    var neighbourhood = address.neighbourhood || address.suburb || '';
    var city = address.city || address.town || address.village || '';

    if (!number && previousText) {
        number = parseNumberFromText(previousText);
    }

    var street = road ? (number ? `${road} ${number}` : road) : '';
    var place = neighbourhood || city || '';

    if (street && place) {
        return `${street}, ${place}`;
    }
    if (street) {
        return street;
    }
    if (place) {
        return place;
    }
    if (previousText && previousText.trim()) {
        return previousText.trim();
    }
    return '';
}

function searchAddressCoordinates(query) {
    if (!query || !query.trim()) return Promise.reject(new Error('Query vacía'));
    var searchQuery = `${query.trim()}, San Rafael, Mendoza, Argentina`;
    var url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=jsonv2&addressdetails=1&limit=1&countrycodes=ar`;

    return fetch(url, {
        headers: {
            'Accept-Language': 'es'
        }
    })
    .then(function (response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(function (results) {
        if (!Array.isArray(results) || !results.length) {
            throw new Error('No se encontraron resultados');
        }
        var first = results[0];
        var lat = parseFloat(first.lat);
        var lng = parseFloat(first.lon);
        if (!isFinite(lat) || !isFinite(lng)) {
            throw new Error('Coordenadas inválidas');
        }
        return {
            coords: { lat: lat, lng: lng },
            address_text: formatShortAddress(first, query)
        };
    });
}

function reverseGeocodeCoords(coords, previousText) {
    if (!coords || typeof coords !== 'object') return Promise.reject(new Error('Coords inválidas'));
    var lat = Number(coords.lat);
    var lng = Number(coords.lng);
    if (!isFinite(lat) || !isFinite(lng)) return Promise.reject(new Error('Coords inválidas'));

    var url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=18&accept-language=es`;
    return fetch(url, {
        headers: {
            'Accept-Language': 'es'
        }
    })
    .then(function (response) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(function (result) {
        if (!result) throw new Error('No se obtuvo respuesta del servidor');
        return {
            coords: { lat: lat, lng: lng },
            address_text: formatShortAddress(result, previousText)
        };
    });
}

function initNominatimAutocomplete(inputEl, listEl, onSelect) {
    console.log('[nominatim] Inicializando autocomplete');

    let currentRequest = null;
    let selectedIndex = -1;
    let suggestions = [];

    function showSuggestions(results) {
        suggestions = results || [];
        selectedIndex = -1;

        if (!suggestions.length) {
            listEl.innerHTML = '<div class="autocomplete-item muted">Sin resultados</div>';
            listEl.hidden = false;
            return;
        }

        const html = suggestions
            .map((res, idx) => {
                const displayName = res.display_name || res.name || '';
                return `<div class="autocomplete-item" data-idx="${idx}">${umasushiEscapeHtml(displayName)}</div>`;
            })
            .join('');

        listEl.innerHTML = html;
        listEl.hidden = false;

        listEl.querySelectorAll('.autocomplete-item').forEach((item) => {
            item.addEventListener('click', function () {
                const idx = parseInt(this.dataset.idx, 10);
                selectSuggestion(idx);
            });
            item.addEventListener('mouseenter', function () {
                selectedIndex = parseInt(this.dataset.idx, 10);
                updateHighlight();
            });
        });
    }

    function updateHighlight() {
        listEl.querySelectorAll('.autocomplete-item').forEach((item, idx) => {
            if (idx === selectedIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function selectSuggestion(idx) {
        if (idx < 0 || idx >= suggestions.length) return;

        const res = suggestions[idx];
        const lat = parseFloat(res.lat);
        const lng = parseFloat(res.lon);

        if (!isFinite(lat) || !isFinite(lng)) {
            console.log('[nominatim] Coords inválidas:', res);
            return;
        }

        const coords = { lat: lat, lng: lng };
        const displayName = res.display_name || res.name || inputEl.value.trim();

        console.log('[nominatim] Selección:', displayName, coords);

        if (typeof onSelect === 'function') {
            onSelect({
                display_name: displayName,
                coords: coords,
                osm_id: res.osm_id || null,
                osm_type: res.osm_type || null
            });
        }

        listEl.hidden = true;
    }

    function performSearch(query) {
        if (!query || query.trim().length < 2) {
            listEl.hidden = true;
            return;
        }

        if (currentRequest) {
            currentRequest.abort();
        }

        const searchQuery = `${query.trim()}, San Rafael, Mendoza, Argentina`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=jsonv2&limit=5&countrycodes=ar`;

        console.log('[nominatim] Buscando:', searchQuery);

        currentRequest = fetch(url)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then((results) => {
                console.log('[nominatim] Resultados:', results.length, results);
                showSuggestions(results);
            })
            .catch((err) => {
                if (err.name !== 'AbortError') {
                    console.error('[nominatim] Error buscando:', err);
                    listEl.innerHTML = '<div class="autocomplete-item muted">Error en búsqueda</div>';
                    listEl.hidden = false;
                }
            });
    }

    inputEl.addEventListener('input', function () {
        const query = this.value.trim();
        performSearch(query);
    });

    inputEl.addEventListener('keydown', function (e) {
        if (listEl.hidden || !suggestions.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            updateHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateHighlight();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0) {
                selectSuggestion(selectedIndex);
            }
        }
    });

    document.addEventListener('click', function (e) {
        if (e.target !== inputEl && e.target !== listEl && !listEl.contains(e.target)) {
            listEl.hidden = true;
        }
    });

    console.log('[nominatim] Autocomplete listo');
}

function initLeafletMap(mapElementId, initialCenter = { lat: -34.6177, lng: -68.3301 }, zoom = 13) {
    const mapEl = document.getElementById(mapElementId);
    if (!mapEl) {
        console.error('[leaflet] Elemento del mapa no encontrado:', mapElementId);
        return null;
    }

    const map = L.map(mapEl).setView([initialCenter.lat, initialCenter.lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    console.log('[leaflet] Mapa inicializado');
    return map;
}

function createLeafletMarker(map, coords, label = '') {
    if (!map || !coords) return null;

    const marker = L.marker([coords.lat, coords.lng], {
        title: label
    }).addTo(map);

    if (label) {
        marker.bindPopup(umasushiEscapeHtml(label));
    }

    return marker;
}

function createLeafletCircle(map, center, radiusMeters, options = {}) {
    if (!map || !center) return null;

    const defaultOptions = {
        color: options.color || '#3388ff',
        fillColor: options.fillColor || '#3388ff',
        fillOpacity: options.fillOpacity !== undefined ? options.fillOpacity : 0.2,
        weight: options.weight || 2,
        opacity: options.opacity !== undefined ? options.opacity : 0.8
    };

    const circle = L.circle([center.lat, center.lng], {
        radius: radiusMeters,
        ...defaultOptions
    }).addTo(map);

    return circle;
}

function haversineDistance(coord1, coord2) {
    const lat1 = parseFloat(coord1.lat);
    const lon1 = parseFloat(coord1.lng);
    const lat2 = parseFloat(coord2.lat);
    const lon2 = parseFloat(coord2.lng);

    if (!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) {
        return null;
    }

    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export {
    generateGoogleMapsUrl,
    searchAddressCoordinates,
    reverseGeocodeCoords,
    initNominatimAutocomplete,
    initLeafletMap,
    createLeafletMarker,
    createLeafletCircle,
    haversineDistance
}
