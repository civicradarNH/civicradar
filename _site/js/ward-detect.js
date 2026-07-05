/**
 * Multi-city ward lookup from GPS coordinates.
 * Boundaries are community-tool estimates — not legal survey data.
 * Ward modules: js/wards/mumbai.js, pune.js, thane.js
 */
(function (global) {
  'use strict';

  const CITY_IDS = ['mumbai', 'pune', 'thane'];
  /** Max distance (km) from nearest centroid when point falls outside all boxes. */
  const MAX_FALLBACK_KM = 8;

  /** Metro service area — union of Mumbai, Pune, Thane bounds (from config or defaults). */
  const SERVICE_BOUNDS = {
    minLat: 18.44,
    maxLat: 19.3,
    minLng: 72.78,
    maxLng: 73.95,
  };

  const DEFAULT_CITY_BOUNDS = {
    mumbai: { minLat: 18.88, maxLat: 19.28, minLng: 72.78, maxLng: 73.0 },
    pune: { minLat: 18.44, maxLat: 18.58, minLng: 73.78, maxLng: 73.95 },
    thane: { minLat: 19.15, maxLat: 19.28, minLng: 72.92, maxLng: 73.05 },
  };

  function getRegistry() {
    return global.CivicWardData || {};
  }

  function getCityBounds(cityId) {
    const cfg = (global.CIVICRADAR_CONFIG || {}).cities || {};
    const c = cfg[cityId];
    if (c && c.bounds) return c.bounds;
    return DEFAULT_CITY_BOUNDS[cityId] || null;
  }

  function getWards(cityId) {
    if (!cityId) return [];
    const reg = getRegistry();
    return reg[cityId] || [];
  }

  function inBBox(lat, lng, w) {
    const b = w.bbox || w;
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
  }

  function wardCentroid(w) {
    if (w.centroid) return w.centroid;
    return { lat: w.lat, lng: w.lng };
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function inCityBounds(lat, lng, cityId) {
    const b = getCityBounds(cityId);
    if (!b) return false;
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
  }

  function inServiceArea(lat, lng) {
    return (
      lat >= SERVICE_BOUNDS.minLat &&
      lat <= SERVICE_BOUNDS.maxLat &&
      lng >= SERVICE_BOUNDS.minLng &&
      lng <= SERVICE_BOUNDS.maxLng
    );
  }

  /**
   * @param {number} lat
   * @param {number} lng
   * @param {string} cityId - mumbai | pune | thane
   * @returns {string|null} Ward name matching datalist, or null if outside city.
   */
  function detectWard(lat, lng, cityId) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    if (!cityId || !inCityBounds(lat, lng, cityId)) return null;

    const WARDS = getWards(cityId);
    if (!WARDS.length) return null;

    const matches = WARDS.filter((w) => inBBox(lat, lng, w));
    if (matches.length === 1) return matches[0].name;

    const candidates = matches.length ? matches : WARDS;
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const w = candidates[i];
      const c = wardCentroid(w);
      const d = haversineKm(lat, lng, c.lat, c.lng);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }

    if (!best) return null;
    const radiusKm = ((global.CIVICRADAR_CONFIG || {}).cities || {})[cityId]?.detectRadiusKm || MAX_FALLBACK_KM;
    if (!matches.length && bestDist > radiusKm) return null;
    return best.name;
  }

  /**
   * Detect which supported city a coordinate falls in (first match in registry order).
   * @returns {string|null} cityId
   */
  function detectCity(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    if (!inServiceArea(lat, lng)) return null;
    for (let i = 0; i < CITY_IDS.length; i++) {
      const id = CITY_IDS[i];
      if (inCityBounds(lat, lng, id)) return id;
    }
    return null;
  }

  function getWardNames(cityId) {
    return getWards(cityId).map((w) => w.name);
  }

  function isKnownWard(ward, cityId) {
    if (!ward) return false;
    const names = getWardNames(cityId);
    return names.includes(ward);
  }

  /** @deprecated use detectWard(lat, lng, 'mumbai') */
  function detectWardLegacy(lat, lng) {
    return detectWard(lat, lng, 'mumbai');
  }

  global.CivicWardDetect = {
    detectWard,
    detectCity,
    getWardNames,
    isKnownWard,
    getWards,
    getCityBounds,
    inServiceArea,
    inCityBounds,
    CITY_IDS,
    SERVICE_BOUNDS,
    /** Legacy Mumbai-only API */
    WARDS: getWards('mumbai'),
  };
})(typeof window !== 'undefined' ? window : globalThis);
