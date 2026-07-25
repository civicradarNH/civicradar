/**
 * Thane locality areas for CivicRadar detection (not official TMC ward polygons).
 * Each entry uses a real approximate locality centroid + local bbox (~1–2 km half-width).
 * Boxes are locality-approximate pending real TMC ward / admin boundary GeoJSON.
 * Display names are resident-facing area labels (no "TMC Ward N" fiction).
 * Deduped from a padded list that had East/West/Naka suffix clones of the same places.
 */
(function (global) {
  'use strict';

  function area(name, lat, lng, halfLat, halfLng) {
    const dLat = halfLat == null ? 0.011 : halfLat;
    const dLng = halfLng == null ? 0.012 : halfLng;
    return {
      name: name,
      bbox: {
        minLat: +(lat - dLat).toFixed(4),
        maxLat: +(lat + dLat).toFixed(4),
        minLng: +(lng - dLng).toFixed(4),
        maxLng: +(lng + dLng).toFixed(4),
      },
      centroid: { lat: +lat.toFixed(4), lng: +lng.toFixed(4) },
    };
  }

  // 45 distinct places (was 66 with Kopri East, Vartak Nagar ×3, etc.).
  const WARDS = [
    area('Kopri', 19.1940, 72.9780, 0.010, 0.011),
    area('Naupada', 19.1880, 72.9720, 0.009, 0.010),
    area('Charai', 19.1980, 72.9720, 0.009, 0.010),
    area('Panchpakhadi', 19.2000, 72.9680, 0.009, 0.010),
    area('Vartak Nagar', 19.2100, 72.9750, 0.011, 0.012),
    area('Hiranandani Estate', 19.2550, 72.9790, 0.013, 0.014),
    area('Ghodbunder Road', 19.2400, 72.9800, 0.014, 0.015),
    area('Kasarvadavali', 19.2680, 72.9670, 0.012, 0.013),
    area('Waghbil', 19.2550, 72.9650, 0.011, 0.012),
    area('Manpada', 19.2320, 72.9780, 0.012, 0.013),
    area('Bhayandarpada', 19.2480, 72.9750, 0.011, 0.012),
    area('Majiwada', 19.2100, 72.9900, 0.011, 0.012),
    area('Kolshet', 19.2350, 72.9950, 0.013, 0.014),
    area('Balkum', 19.2250, 73.0050, 0.012, 0.013),
    area('Dhokali', 19.2180, 72.9980, 0.010, 0.011),
    area('Kalwa East', 19.1950, 73.0050, 0.011, 0.012),
    area('Kalwa West', 19.2000, 72.9980, 0.010, 0.011),
    area('Mumbra', 19.1750, 73.0220, 0.014, 0.015),
    area('Diva', 19.1550, 73.0400, 0.012, 0.013),
    area('Shil', 19.1600, 73.0350, 0.011, 0.012),
    area('Kausa', 19.1700, 73.0250, 0.011, 0.012),
    area('Rabodi', 19.1950, 72.9850, 0.009, 0.010),
    area('Jambli Naka', 19.1950, 72.9700, 0.008, 0.009),
    area('Temghar', 19.2050, 72.9850, 0.009, 0.010),
    area('Teen Hath Naka', 19.2050, 72.9780, 0.008, 0.009),
    area('Cadbury Junction', 19.2200, 72.9780, 0.009, 0.010),
    area('Wagle Estate', 19.2100, 73.0000, 0.012, 0.013),
    area('Louis Wadi', 19.2000, 72.9800, 0.009, 0.010),
    area('Hari Niwas', 19.2050, 72.9700, 0.008, 0.009),
    area('Upvan', 19.2200, 72.9600, 0.010, 0.011),
    area('Yeoor Hills', 19.2300, 72.9500, 0.013, 0.014),
    area('Patlipada', 19.2450, 72.9700, 0.011, 0.012),
    area('Hiranandani Meadows', 19.2500, 72.9850, 0.011, 0.012),
    area('Beverly Park', 19.2400, 72.9850, 0.010, 0.011),
    area('Oswal Park', 19.2150, 72.9800, 0.009, 0.010),
    area('Mhada Colony', 19.2000, 72.9900, 0.009, 0.010),
    area('Indira Nagar', 19.1900, 72.9850, 0.009, 0.010),
    area('Ram Maruti Road', 19.1920, 72.9680, 0.008, 0.009),
    area('Shree Nagar', 19.2050, 72.9850, 0.009, 0.010),
    area('Kisan Nagar', 19.2150, 72.9900, 0.009, 0.010),
    area('Talao Pali', 19.1980, 72.9650, 0.008, 0.009),
    area('Kharegaon', 19.2100, 73.0100, 0.011, 0.012),
    area('Dawodi', 19.2200, 73.0150, 0.010, 0.011),
    area('Kasheli', 19.2300, 73.0200, 0.011, 0.012),
    area('Bhiwandi Naka', 19.2400, 73.0250, 0.011, 0.012),
  ];

  global.CivicWardData = global.CivicWardData || {};
  global.CivicWardData.thane = WARDS;
})(typeof window !== 'undefined' ? window : globalThis);
