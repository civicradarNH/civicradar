/**
 * Mumbai BMC wards — approximate community-tool bounding boxes.
 * NOT legal survey data. Names match CivicRadar datalist exactly.
 * Ref: MCGM ward map (mcgm.gov.in), OpenStreetMap Mumbai bounds.
 */
(function (global) {
  'use strict';

  const WARDS = [
    { name: 'A Ward — Colaba, Fort', bbox: { minLat: 18.895, maxLat: 19.02, minLng: 72.81, maxLng: 72.84 }, centroid: { lat: 18.91, lng: 72.825 } },
    { name: 'B Ward — Dongri, Umarkhadi', bbox: { minLat: 18.955, maxLat: 19.035, minLng: 72.83, maxLng: 72.855 }, centroid: { lat: 18.97, lng: 72.842 } },
    { name: 'C Ward — Bhuleshwar, Kalbadevi', bbox: { minLat: 18.94, maxLat: 19.05, minLng: 72.84, maxLng: 72.87 }, centroid: { lat: 18.955, lng: 72.85 } },
    { name: 'D Ward — Malabar Hill, Tardeo', bbox: { minLat: 18.96, maxLat: 19.04, minLng: 72.79, maxLng: 72.825 }, centroid: { lat: 18.97, lng: 72.805 } },
    { name: 'E Ward — Byculla, Mazgaon', bbox: { minLat: 18.96, maxLat: 19.06, minLng: 72.845, maxLng: 72.875 }, centroid: { lat: 18.975, lng: 72.86 } },
    { name: 'F/N Ward — Sion, Matunga', bbox: { minLat: 19.02, maxLat: 19.07, minLng: 72.855, maxLng: 72.895 }, centroid: { lat: 19.045, lng: 72.87 } },
    { name: 'F/S Ward — Parel, Sewri', bbox: { minLat: 18.99, maxLat: 19.04, minLng: 72.845, maxLng: 72.875 }, centroid: { lat: 19.005, lng: 72.86 } },
    { name: 'G/N Ward — Dadar, Shivaji Park', bbox: { minLat: 19.01, maxLat: 19.045, minLng: 72.825, maxLng: 72.855 }, centroid: { lat: 19.025, lng: 72.84 } },
    { name: 'G/S Ward — Worli, Lower Parel', bbox: { minLat: 18.99, maxLat: 19.03, minLng: 72.805, maxLng: 72.835 }, centroid: { lat: 19.01, lng: 72.82 } },
    { name: 'H/E Ward — Bandra East, Khar East', bbox: { minLat: 19.045, maxLat: 19.085, minLng: 72.845, maxLng: 72.885 }, centroid: { lat: 19.065, lng: 72.865 } },
    { name: 'H/W Ward — Bandra West, Khar West', bbox: { minLat: 19.045, maxLat: 19.095, minLng: 72.815, maxLng: 72.855 }, centroid: { lat: 19.06, lng: 72.835 } },
    { name: 'K/E Ward — Andheri East, Vile Parle East', bbox: { minLat: 19.095, maxLat: 19.13, minLng: 72.845, maxLng: 72.89 }, centroid: { lat: 19.115, lng: 72.865 } },
    { name: 'K/W Ward — Andheri West, Vile Parle West', bbox: { minLat: 19.1, maxLat: 19.145, minLng: 72.815, maxLng: 72.855 }, centroid: { lat: 19.12, lng: 72.835 } },
    { name: 'L Ward — Kurla, Sakinaka', bbox: { minLat: 19.065, maxLat: 19.11, minLng: 72.87, maxLng: 72.915 }, centroid: { lat: 19.09, lng: 72.885 } },
    { name: 'M/E Ward — Chembur, Deonar', bbox: { minLat: 19.035, maxLat: 19.075, minLng: 72.885, maxLng: 72.925 }, centroid: { lat: 19.055, lng: 72.905 } },
    { name: 'M/W Ward — Marol, Jogeshwari', bbox: { minLat: 19.105, maxLat: 19.145, minLng: 72.855, maxLng: 72.895 }, centroid: { lat: 19.125, lng: 72.87 } },
    { name: 'N Ward — Ghatkopar, Vikhroli', bbox: { minLat: 19.085, maxLat: 19.125, minLng: 72.895, maxLng: 72.935 }, centroid: { lat: 19.1, lng: 72.91 } },
    { name: 'P/N Ward — Goregaon, Malad', bbox: { minLat: 19.165, maxLat: 19.205, minLng: 72.835, maxLng: 72.875 }, centroid: { lat: 19.185, lng: 72.855 } },
    { name: 'P/S Ward — Kandivali, Charkop', bbox: { minLat: 19.19, maxLat: 19.225, minLng: 72.82, maxLng: 72.86 }, centroid: { lat: 19.205, lng: 72.84 } },
    { name: 'R/N Ward — Dahisar, Borivali', bbox: { minLat: 19.23, maxLat: 19.27, minLng: 72.845, maxLng: 72.885 }, centroid: { lat: 19.25, lng: 72.865 } },
    { name: 'R/C Ward — Borivali West', bbox: { minLat: 19.22, maxLat: 19.255, minLng: 72.83, maxLng: 72.865 }, centroid: { lat: 19.235, lng: 72.845 } },
    { name: 'R/S Ward — Kandivali West', bbox: { minLat: 19.2, maxLat: 19.235, minLng: 72.81, maxLng: 72.845 }, centroid: { lat: 19.215, lng: 72.825 } },
    { name: 'S Ward — Bhandup, Mulund', bbox: { minLat: 19.145, maxLat: 19.185, minLng: 72.915, maxLng: 72.955 }, centroid: { lat: 19.165, lng: 72.935 } },
    { name: 'T Ward — Mulund, Nahur', bbox: { minLat: 19.165, maxLat: 19.205, minLng: 72.945, maxLng: 72.985 }, centroid: { lat: 19.18, lng: 72.96 } },
  ];

  global.CivicWardData = global.CivicWardData || {};
  global.CivicWardData.mumbai = WARDS;
})(typeof window !== 'undefined' ? window : globalThis);
