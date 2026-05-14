/**
 * Cálculo de delivery por zonas circulares.
 * Zona: { id, nombre, envio, center:{lat,lng}, radiusM }
 */

function umasushiToNum(x) {
    var n = typeof x === 'number' ? x : Number(x);
    return isFinite(n) ? n : null;
}

function haversineDistanceMeters(a, b) {
    var lat1 = umasushiToNum(a && a.lat);
    var lon1 = umasushiToNum(a && a.lng);
    var lat2 = umasushiToNum(b && b.lat);
    var lon2 = umasushiToNum(b && b.lng);
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;

    var R = 6371000;
    var toRad = function (deg) {
        return (deg * Math.PI) / 180;
    };

    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var s1 = Math.sin(dLat / 2);
    var s2 = Math.sin(dLon / 2);
    var aa = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
    var c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
}

function zoneHasCircle(z) {
    return (
        z &&
        z.center &&
        typeof z.center === 'object' &&
        umasushiToNum(z.center.lat) != null &&
        umasushiToNum(z.center.lng) != null &&
        umasushiToNum(z.radiusM) != null
    );
}

function calculateDelivery(coords, zones) {
    var zs = Array.isArray(zones) ? zones : [];
    var c = coords && typeof coords === 'object' ? coords : null;
    if (!c || umasushiToNum(c.lat) == null || umasushiToNum(c.lng) == null) {
        console.log('[delivery] No coords válidas:', c);
        return { ok: false, zone: null, costoEnvio: 0, reason: 'no_coords', distanceM: null };
    }
    var candidates = [];
    for (var i = 0; i < zs.length; i++) {
        var z = zs[i];
        if (!zoneHasCircle(z)) continue;
        var d = haversineDistanceMeters(c, z.center);
        var r = Math.max(0, umasushiToNum(z.radiusM) || 0);
        if (d != null && d <= r) {
            candidates.push({ zone: z, distanceM: d, radiusM: r });
        }
    }
    if (candidates.length === 0) {
        console.log('[delivery] Coords fuera de todas las zonas:', c);
        return { ok: false, zone: null, costoEnvio: 0, reason: 'out_of_zones', distanceM: null };
    }
    // Elegir la zona más específica: menor radio
    candidates.sort(function (a, b) {
        return a.radiusM - b.radiusM;
    });
    var best = candidates[0];
    console.log('[delivery] Zona elegida:', best.zone.nombre, 'Distancia:', best.distanceM, 'Radio:', best.radiusM, 'Coords:', c);
    return {
        ok: true,
        zone: best.zone,
        costoEnvio: Math.max(0, Number(best.zone.envio) || 0),
        distanceM: best.distanceM
    };
}

