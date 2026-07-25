/**
 * Pune locality areas for CivicRadar detection (not official PMC prabhag polygons).
 * Each entry uses a real approximate locality centroid + local bbox (~1–2 km half-width).
 * Boxes are locality-approximate pending real PMC prabhag / admin boundary GeoJSON.
 * Display names are resident-facing locality labels (Kothrud, Baner, …).
 */
(function (global) {
  'use strict';

  /** ~half-width in degrees: 0.012 ≈ 1.3 km lat; lng scaled at ~18.5°N. */
  function area(name, lat, lng, halfLat, halfLng) {
    const dLat = halfLat == null ? 0.012 : halfLat;
    const dLng = halfLng == null ? 0.013 : halfLng;
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

  // Centroids: public OSM / map knowledge of named Pune localities (not survey markers).
  // Dense old-city peths use tighter boxes; sprawling suburbs use wider ones.
  const WARDS = [
    area('Kasba Vishrambag', 18.5195, 73.8555, 0.008, 0.009),
    area('Bhavani Peth', 18.5070, 73.8620, 0.008, 0.009),
    area('Swargate', 18.5015, 73.8585, 0.009, 0.010),
    area('Shaniwar Peth', 18.5190, 73.8535, 0.007, 0.008),
    area('Sadashiv Peth', 18.5120, 73.8470, 0.008, 0.009),
    area('Kasba Peth', 18.5205, 73.8580, 0.007, 0.008),
    area('Narayan Peth', 18.5160, 73.8500, 0.007, 0.008),
    area('Raviwar Peth', 18.5180, 73.8605, 0.007, 0.008),
    area('Shukrawar Peth', 18.5100, 73.8550, 0.008, 0.009),
    area('Ganesh Peth', 18.5140, 73.8625, 0.007, 0.008),
    area('Somwar Peth', 18.5220, 73.8680, 0.007, 0.008),
    area('Mangalwar Peth', 18.5250, 73.8700, 0.007, 0.008),
    area('Budhwar Peth', 18.5165, 73.8565, 0.007, 0.008),
    area('Shivajinagar', 18.5310, 73.8470, 0.010, 0.011),
    area('Model Colony', 18.5330, 73.8370, 0.008, 0.009),
    area('Aundh', 18.5580, 73.8080, 0.014, 0.015),
    area('Baner', 18.5590, 73.7870, 0.015, 0.016),
    area('Balewadi', 18.5770, 73.7720, 0.014, 0.015),
    area('Pashan', 18.5380, 73.7880, 0.014, 0.015),
    area('Sus', 18.5520, 73.7550, 0.014, 0.015),
    area('Kothrud', 18.5074, 73.8077, 0.013, 0.014),
    area('Karve Nagar', 18.4920, 73.8220, 0.011, 0.012),
    area('Warje', 18.4820, 73.8050, 0.013, 0.014),
    area('Dahanukar Colony', 18.5010, 73.8100, 0.009, 0.010),
    area('Bavdhan', 18.5150, 73.7760, 0.014, 0.015),
    area('Erandwane', 18.5120, 73.8270, 0.010, 0.011),
    area('Deccan', 18.5160, 73.8410, 0.009, 0.010),
    area('Parvati', 18.4920, 73.8520, 0.011, 0.012),
    area('Dhankawadi', 18.4630, 73.8560, 0.012, 0.013),
    area('Bibwewadi', 18.4730, 73.8650, 0.012, 0.013),
    area('Hadapsar', 18.5080, 73.9260, 0.015, 0.016),
    area('Magarpatta', 18.5160, 73.9320, 0.012, 0.013),
    area('Kondhwa', 18.4640, 73.8890, 0.014, 0.015),
    area('Mohammedwadi', 18.4750, 73.9100, 0.012, 0.013),
    area('Undri', 18.4560, 73.9120, 0.013, 0.014),
    area('Wanowrie', 18.4940, 73.9010, 0.011, 0.012),
    area('Fatima Nagar', 18.5040, 73.9010, 0.010, 0.011),
    area('Koregaon Park', 18.5360, 73.8930, 0.011, 0.012),
    area('Kalyani Nagar', 18.5480, 73.9020, 0.011, 0.012),
    area('Yerwada', 18.5520, 73.8790, 0.013, 0.014),
    area('Dhanori', 18.5950, 73.8910, 0.014, 0.015),
  ];

  global.CivicWardData = global.CivicWardData || {};
  global.CivicWardData.pune = WARDS;
})(typeof window !== 'undefined' ? window : globalThis);
