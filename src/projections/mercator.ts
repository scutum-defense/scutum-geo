export function latLngToMercator(lat: number, lng: number): { x: number; y: number } {
  const x = (lng + 180) / 360;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  return { x, y };
}

export function mercatorToLatLng(x: number, y: number): { lat: number; lng: number } {
  const lng = x * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}
