import { SIDES, THRESHOLDS } from "./config.js";
import {
  angleAt,
  horizontalDeviation,
  pointVisibility,
} from "./geometry.js";

function sideScore(landmarks, side, keys) {
  return (
    keys.reduce(
      (total, key) => total + pointVisibility(landmarks[side[key]]),
      0
    ) / keys.length
  );
}

function bestSide(landmarks, keys) {
  return SIDES.reduce(
    (best, side) => {
      const score = sideScore(landmarks, side, keys);
      return score > best.score ? { side, score } : best;
    },
    { side: SIDES[0], score: -1 }
  );
}

export function getElbowAngle(landmarks) {
  const arms = SIDES.map((side) => {
    const points = [
      landmarks[side.shoulder],
      landmarks[side.elbow],
      landmarks[side.wrist],
    ];
    const visibility =
      points.reduce((sum, point) => sum + pointVisibility(point), 0) /
      points.length;

    return {
      angle:
        visibility >= THRESHOLDS.minVisibility ? angleAt(...points) : null,
      visibility,
    };
  }).filter((arm) => arm.angle !== null);

  if (arms.length === 0) return null;
  if (arms.length === 1) return arms[0].angle;

  const totalVisibility = arms.reduce(
    (sum, arm) => sum + arm.visibility,
    0
  );

  if (totalVisibility <= 0) {
    return (arms[0].angle + arms[1].angle) / 2;
  }

  return arms.reduce(
    (angle, arm) => angle + arm.angle * (arm.visibility / totalVisibility),
    0
  );
}

export function isInPushupPosition(landmarks) {
  const { side: armSide } = bestSide(landmarks, [
    "shoulder",
    "elbow",
    "wrist",
  ]);
  const shoulder = landmarks[armSide.shoulder];
  const wrist = landmarks[armSide.wrist];

  if (
    !shoulder ||
    !wrist ||
    pointVisibility(shoulder) < THRESHOLDS.minVisibility ||
    pointVisibility(wrist) < THRESHOLDS.minVisibility
  ) {
    return false;
  }

  if (wrist.y < shoulder.y - THRESHOLDS.handsBelowTolerance) return false;

  const { side: torsoSide } = bestSide(landmarks, [
    "shoulder",
    "hip",
    "ankle",
  ]);
  const torsoShoulder = landmarks[torsoSide.shoulder];
  const hip = landmarks[torsoSide.hip];
  const ankle = landmarks[torsoSide.ankle];

  if (
    !torsoShoulder ||
    pointVisibility(torsoShoulder) < THRESHOLDS.minVisibility
  ) {
    return true;
  }

  const anchor =
    hip && pointVisibility(hip) >= THRESHOLDS.minVisibility
      ? hip
      : ankle && pointVisibility(ankle) >= THRESHOLDS.minVisibility
        ? ankle
        : null;

  if (!anchor) return true;

  const deviation = horizontalDeviation(torsoShoulder, anchor);
  return deviation === null || deviation <= THRESHOLDS.maxTorsoAngle;
}

export function checkForm(landmarks) {
  const { side } = bestSide(landmarks, ["shoulder", "hip", "ankle"]);
  const shoulder = landmarks[side.shoulder];
  const hip = landmarks[side.hip];
  const knee = landmarks[side.knee];
  const ankle = landmarks[side.ankle];

  if (
    !shoulder ||
    !hip ||
    pointVisibility(shoulder) < THRESHOLDS.minVisibility ||
    pointVisibility(hip) < THRESHOLDS.minVisibility
  ) {
    return { ok: true, checked: false };
  }

  const target =
    ankle && pointVisibility(ankle) >= THRESHOLDS.minVisibility
      ? ankle
      : knee && pointVisibility(knee) >= THRESHOLDS.minVisibility
        ? knee
        : null;

  if (!target) return { ok: true, checked: false };

  const torsoAngle = angleAt(shoulder, hip, target);
  if (torsoAngle === null) return { ok: true, checked: false };

  return {
    ok: torsoAngle >= 180 - THRESHOLDS.formTolerance,
    checked: true,
  };
}

export function analyzePose(landmarks) {
  return {
    angle: getElbowAngle(landmarks),
    inPosition: isInPushupPosition(landmarks),
    form: checkForm(landmarks),
  };
}
