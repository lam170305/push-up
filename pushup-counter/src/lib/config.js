export const LANDMARKS = {
  L_SHOULDER: 11,
  L_ELBOW: 13,
  L_WRIST: 15,
  L_HIP: 23,
  L_KNEE: 25,
  L_ANKLE: 27,
  R_SHOULDER: 12,
  R_ELBOW: 14,
  R_WRIST: 16,
  R_HIP: 24,
  R_KNEE: 26,
  R_ANKLE: 28,
};

export const KEEP_LANDMARKS = [
  LANDMARKS.L_SHOULDER,
  LANDMARKS.L_ELBOW,
  LANDMARKS.L_WRIST,
  LANDMARKS.R_SHOULDER,
  LANDMARKS.R_ELBOW,
  LANDMARKS.R_WRIST,
  LANDMARKS.L_HIP,
  LANDMARKS.L_KNEE,
  LANDMARKS.L_ANKLE,
  LANDMARKS.R_HIP,
  LANDMARKS.R_KNEE,
  LANDMARKS.R_ANKLE,
];

export const CONNECTIONS = [
  [LANDMARKS.L_SHOULDER, LANDMARKS.L_ELBOW],
  [LANDMARKS.L_ELBOW, LANDMARKS.L_WRIST],
  [LANDMARKS.R_SHOULDER, LANDMARKS.R_ELBOW],
  [LANDMARKS.R_ELBOW, LANDMARKS.R_WRIST],
  [LANDMARKS.L_SHOULDER, LANDMARKS.R_SHOULDER],
  [LANDMARKS.L_SHOULDER, LANDMARKS.L_HIP],
  [LANDMARKS.L_HIP, LANDMARKS.L_KNEE],
  [LANDMARKS.L_KNEE, LANDMARKS.L_ANKLE],
  [LANDMARKS.R_SHOULDER, LANDMARKS.R_HIP],
  [LANDMARKS.R_HIP, LANDMARKS.R_KNEE],
  [LANDMARKS.R_KNEE, LANDMARKS.R_ANKLE],
  [LANDMARKS.L_HIP, LANDMARKS.R_HIP],
];

export const THRESHOLDS = {
  minVisibility: 0.5,
  downStartAngle: 125,
  deepAngle: 100,
  upAngle: 150,
  formTolerance: 38,
  maxTorsoAngle: 45,
  handsBelowTolerance: 0.03,
  minRepMs: 500,
  maxRepMs: 9000,
  maxBadFormMs: 350,
  maxOutOfPositionMs: 900,
  maxMissingMs: 1500,
  lostResetMs: 1200,
  smoothingTauMs: 90,
};

export const MODEL = {
  wasmBase: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm",
  poseLite:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

export const SIDES = [
  {
    shoulder: LANDMARKS.L_SHOULDER,
    elbow: LANDMARKS.L_ELBOW,
    wrist: LANDMARKS.L_WRIST,
    hip: LANDMARKS.L_HIP,
    knee: LANDMARKS.L_KNEE,
    ankle: LANDMARKS.L_ANKLE,
  },
  {
    shoulder: LANDMARKS.R_SHOULDER,
    elbow: LANDMARKS.R_ELBOW,
    wrist: LANDMARKS.R_WRIST,
    hip: LANDMARKS.R_HIP,
    knee: LANDMARKS.R_KNEE,
    ankle: LANDMARKS.R_ANKLE,
  },
];
