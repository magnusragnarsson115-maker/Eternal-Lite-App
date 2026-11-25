/**
 * Odnośniki do map (A7.8, F7.4). Aplikacja nie wyznacza tras sama — otwiera mapę wybraną przez użytkownika
 * z adresem albo współrzędnymi celu. Punkt startowy ustala mapa na urządzeniu (nie wysyłamy położenia).
 */

export type MapProvider = 'osm' | 'google' | 'apple';

export function placeUrl(place: string): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(place)}`;
}

export function routeUrl(provider: MapProvider, to: { address?: string; lat?: number; lon?: number }): string {
  const coords = to.lat !== undefined && to.lon !== undefined ? `${to.lat},${to.lon}` : undefined;
  const dest = coords ?? to.address ?? '';
  if (provider === 'google') return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  if (provider === 'apple') return `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`;
  return coords ? `https://www.openstreetmap.org/directions?route=%3B${encodeURIComponent(coords)}` : placeUrl(dest);
}
