// Pune areas with rough centre points. Travel time is an evening-traffic estimate;
// override any pair with real numbers from Google Maps in TRAVEL_OVERRIDES ("a|b" sorted alphabetically).
export const AREAS = [
  { id: 'koregaon_park', name: 'Koregaon Park', lat: 18.5362, lng: 73.8940 },
  { id: 'kalyani_nagar', name: 'Kalyani Nagar', lat: 18.5463, lng: 73.9027 },
  { id: 'viman_nagar',   name: 'Viman Nagar',   lat: 18.5679, lng: 73.9143 },
  { id: 'kharadi',       name: 'Kharadi',       lat: 18.5513, lng: 73.9400 },
  { id: 'hadapsar',      name: 'Hadapsar / Magarpatta', lat: 18.5089, lng: 73.9259 },
  { id: 'camp',          name: 'Camp',          lat: 18.5136, lng: 73.8786 },
  { id: 'deccan',        name: 'Deccan / FC Road', lat: 18.5167, lng: 73.8410 },
  { id: 'kothrud',       name: 'Kothrud',       lat: 18.5074, lng: 73.8077 },
  { id: 'aundh',         name: 'Aundh',         lat: 18.5580, lng: 73.8077 },
  { id: 'baner',         name: 'Baner',         lat: 18.5590, lng: 73.7868 },
  { id: 'balewadi',      name: 'Balewadi',      lat: 18.5770, lng: 73.7790 },
  { id: 'wakad',         name: 'Wakad',         lat: 18.5987, lng: 73.7600 },
  { id: 'hinjewadi',     name: 'Hinjewadi',     lat: 18.5912, lng: 73.7380 },
];

export const TRAVEL_OVERRIDES = {
  // 'baner|koregaon_park': 55,
};

export const areaName = id => AREAS.find(a => a.id === id)?.name ?? id;

export function travelMinutes(a, b) {
  if (a === b) return 8;
  const key = [a, b].sort().join('|');
  if (TRAVEL_OVERRIDES[key] != null) return TRAVEL_OVERRIDES[key];
  const A = AREAS.find(x => x.id === a), B = AREAS.find(x => x.id === b);
  if (!A || !B) return 60;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (B.lat - A.lat) * rad, dLng = (B.lng - A.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * rad) * Math.cos(B.lat * rad) * Math.sin(dLng / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(s)) * 1.4; // road detour factor
  return Math.round(6 + km * 3.2); // ~19 km/h at evening speeds
}
