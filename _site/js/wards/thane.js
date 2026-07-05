/**
 * Thane Municipal Corporation (TMC) electoral wards — ~65 wards.
 * Boundaries are approximate community grid estimates, NOT official survey data.
 * Ref: TMC ward list (thanecity.gov.in), OpenStreetMap Thane bounds.
 */
(function (global) {
  'use strict';

  const AREAS = [
    'Kopri', 'Naupada', 'Charai', 'Panchpakhadi', 'Vartak Nagar', 'Hiranandani Estate',
    'Ghodbunder Road', 'Kasarvadavali', 'Waghbil', 'Manpada', 'Bhayandarpada',
    'Majiwada', 'Kolshet', 'Balkum', 'Dhokali', 'Kalwa East', 'Kalwa West',
    'Mumbra', 'Diva', 'Shil',
    'Kausa', 'Rabodi', 'Jambli Naka', 'Temghar', 'Teen Hath Naka', 'Cadbury Junction',
    'Wagle Estate', 'Louis Wadi', 'Hari Niwas', 'Upvan', 'Yeoor Hills',
    'Patlipada', 'Hiranandani Meadows', 'Beverly Park', 'Vartak Nagar East', 'Oswal Park',
    'Kolshet Road', 'Mhada Colony', 'Indira Nagar', 'Ram Maruti Road', 'Shree Nagar',
    'Kisan Nagar', 'Naupada East', 'Talao Pali', 'Jambli Naka West', 'Kharegaon',
    'Kolshet Industrial', 'Balkum Naka', 'Dawodi', 'Kausa East', 'Mumbra Devi',
    'Diva East', 'Shil Phata', 'Kasheli', 'Bhiwandi Naka', 'Majiwada East',
    'Hiranandani Estate West', 'Manpada Hills', 'Bhayandarpada East', 'Waghbil Naka',
    'Ghodbunder Village', 'Kopri East', 'Charai West', 'Panchpakhadi North', 'Vartak Nagar West',
    'Kolshet West',
  ];
  const BOUNDS = { minLat: 19.15, maxLat: 19.28, minLng: 72.92, maxLng: 73.05 };
  const COLS = 9;

  function buildGridWards(prefix, areas, bounds, cols) {
    const rows = Math.ceil(areas.length / cols);
    const latStep = (bounds.maxLat - bounds.minLat) / rows;
    const lngStep = (bounds.maxLng - bounds.minLng) / cols;
    return areas.map((area, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const minLat = bounds.minLat + row * latStep;
      const maxLat = bounds.minLat + (row + 1) * latStep;
      const minLng = bounds.minLng + col * lngStep;
      const maxLng = bounds.minLng + (col + 1) * lngStep;
      return {
        name: `${prefix}${i + 1} — ${area}`,
        bbox: { minLat: +minLat.toFixed(4), maxLat: +maxLat.toFixed(4), minLng: +minLng.toFixed(4), maxLng: +maxLng.toFixed(4) },
        centroid: { lat: +((minLat + maxLat) / 2).toFixed(4), lng: +((minLng + maxLng) / 2).toFixed(4) },
      };
    });
  }

  const WARDS = buildGridWards('TMC Ward ', AREAS, BOUNDS, COLS);

  global.CivicWardData = global.CivicWardData || {};
  global.CivicWardData.thane = WARDS;
})(typeof window !== 'undefined' ? window : globalThis);
