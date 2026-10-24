export const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

export const pointVisibility = (point) => point?.visibility ?? 0;

export function angleAt(a, b, c) {
  if (!a || !b || !c) return null;

  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 < 1e-6 || mag2 < 1e-6) return null;

  const cosine = clamp((v1x * v2x + v1y * v2y) / (mag1 * mag2), -1, 1);
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function midpoint(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: (pointVisibility(a) + pointVisibility(b)) / 2,
  };
}

export function horizontalDeviation(a, b) {
  if (!a || !b) return null;

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  if (Math.hypot(dx, dy) < 1e-6) return null;

  let degrees = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  if (degrees > 90) degrees = 180 - degrees;
  return degrees;
}
