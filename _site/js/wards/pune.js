/**
 * Pune Municipal Corporation (PMC) electoral wards — ~41 wards.
 * Boundaries are approximate community grid estimates, NOT official survey data.
 * Ref: PMC ward list (pmc.gov.in), OpenStreetMap Pune city bounds.
 */
(function (global) {
  'use strict';

  const AREAS = [
    'Kasba Vishrambag', 'Bhavani Peth', 'Swargate', 'Shaniwar Peth', 'Sadashiv Peth',
    'Kasba Peth', 'Narayan Peth', 'Raviwar Peth', 'Shukrawar Peth', 'Ganesh Peth',
    'Somwar Peth', 'Mangalwar Peth', 'Budhwar Peth', 'Shivajinagar', 'Model Colony',
    'Aundh', 'Baner', 'Balewadi', 'Pashan', 'Sus',
    'Kothrud', 'Karve Nagar', 'Warje', 'Dahanukar Colony', 'Bavdhan',
    'Erandwane', 'Deccan', 'Parvati', 'Dhankawadi', 'Bibwewadi',
    'Hadapsar', 'Magarpatta', 'Kondhwa', 'Mohammedwadi', 'Undri',
    'Wanowrie', 'Fatima Nagar', 'Koregaon Park', 'Kalyani Nagar', 'Yerwada',
    'Dhanori',
  ];
  const BOUNDS = { minLat: 18.44, maxLat: 18.58, minLng: 73.78, maxLng: 73.95 };
  const COLS = 7;

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

  const WARDS = buildGridWards('Ward ', AREAS, BOUNDS, COLS);

  global.CivicWardData = global.CivicWardData || {};
  global.CivicWardData.pune = WARDS;
})(typeof window !== 'undefined' ? window : globalThis);
