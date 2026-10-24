import "./style.css";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const angleEl = document.getElementById("angle");
const counterEl = document.getElementById("counter");
const timerEl = document.getElementById("timer");
const paceEl = document.getElementById("pace");
const btnReset = document.getElementById("btnReset");
const ctx = canvas.getContext("2d");

let poseLandmarker = null;
let drawingUtils = null;
let lastVideoTime = -1;

// ---------- Ngưỡng ----------
const DOWN_ANGLE = 100;
const UP_ANGLE = 140;
const FORM_TOLERANCE = 25;
const HORIZONTAL_THRESHOLD = 0.35;
const SESSION_TIMEOUT_MS = 8000;

// ---------- Landmark indices ----------
const L = {
  L_SHOULDER: 11, L_ELBOW: 13, L_WRIST: 15, L_HIP: 23, L_KNEE: 25, L_ANKLE: 27,
  R_SHOULDER: 12, R_ELBOW: 14, R_WRIST: 16, R_HIP: 24, R_KNEE: 26, R_ANKLE: 28,
};

// Chỉ giữ các điểm: vai, khuỷu, cổ tay, hông, gối, cổ chân
const KEEP_LANDMARKS = [
  L.L_SHOULDER, L.L_ELBOW, L.L_WRIST,
  L.R_SHOULDER, L.R_ELBOW, L.R_WRIST,
  L.L_HIP, L.L_KNEE, L.L_ANKLE,
  L.R_HIP, L.R_KNEE, L.R_ANKLE,
];

// Connector tự định nghĩa — chỉ nối tay và thân
const KEEP_CONNECTIONS = [
  // Tay trái
  [L.L_SHOULDER, L.L_ELBOW],
  [L.L_ELBOW, L.L_WRIST],
  // Tay phải
  [L.R_SHOULDER, L.R_ELBOW],
  [L.R_ELBOW, L.R_WRIST],
  // Vai nối 2 bên
  [L.L_SHOULDER, L.R_SHOULDER],
  // Thân trái
  [L.L_SHOULDER, L.L_HIP],
  [L.L_HIP, L.L_KNEE],
  [L.L_KNEE, L.L_ANKLE],
  // Thân phải
  [L.R_SHOULDER, L.R_HIP],
  [L.R_HIP, L.R_KNEE],
  [L.R_KNEE, L.R_ANKLE],
  // Hông nối 2 bên
  [L.L_HIP, L.R_HIP],
];

// ---------- State ----------
let state = "UP";
let sessionActive = false;
let sessionStartTime = 0;
let count = 0;
let startTime = null;
let timerInterval = null;

// ---------- Tính góc ----------
function calcAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  let cos = dot / (mag1 * mag2);
  cos = Math.max(-1, Math.min(1, cos));
  return Math.acos(cos) * (180 / Math.PI);
}

// ---------- Kiểm tra thân thẳng ----------
function isFormValid(lm) {
  const leftVis =
    (lm[L.L_SHOULDER].visibility + lm[L.L_HIP].visibility + lm[L.L_ANKLE].visibility) / 3;
  const rightVis =
    (lm[L.R_SHOULDER].visibility + lm[L.R_HIP].visibility + lm[L.R_ANKLE].visibility) / 3;
  const side = leftVis > rightVis ? "L" : "R";

  const shoulder = lm[L[`${side}_SHOULDER`]];
  const hip = lm[L[`${side}_HIP`]];
  const ankle = lm[L[`${side}_ANKLE`]];

  const bodyAngle = calcAngle(shoulder, hip, ankle);
  return bodyAngle > 180 - FORM_TOLERANCE;
}

// ---------- Kiểm tra tư thế chống đẩy ----------
function isInPushupPosition(lm) {
  const shoulderY = (lm[L.L_SHOULDER].y + lm[L.R_SHOULDER].y) / 2;
  const ankleY = (lm[L.L_ANKLE].y + lm[L.R_ANKLE].y) / 2;
  const bodySpread = Math.abs(shoulderY - ankleY);
  const isHorizontal = bodySpread < HORIZONTAL_THRESHOLD;

  const wristY = (lm[L.L_WRIST].y + lm[L.R_WRIST].y) / 2;
  const handsBelowShoulders = wristY >= shoulderY - 0.05;

  const bothWristsVisible =
    lm[L.L_WRIST].visibility > 0.5 && lm[L.R_WRIST].visibility > 0.5;

  return isHorizontal && handsBelowShoulders && bothWristsVisible;
}

// ---------- Timer ----------
function startTimer() {
  if (startTime) return;
  startTime = Date.now();

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    timerEl.textContent = `${m}:${s}`;

    if (elapsed > 5) {
      paceEl.textContent = Math.round((count / elapsed) * 60);
    }
  }, 250);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  startTime = null;
  timerEl.textContent = "00:00";
}

// ---------- Reset ----------
function resetAll() {
  count = 0;
  state = "UP";
  sessionActive = false;
  sessionStartTime = 0;
  counterEl.textContent = "0";
  paceEl.textContent = "--";
  stopTimer();
  statusEl.textContent = "Đã reset. Sẵn sàng!";
  statusEl.classList.remove("form-warn", "success");
}

btnReset.addEventListener("click", resetAll);

// ---------- Pop animation ----------
function popCounter() {
  counterEl.classList.remove("pop");
  void counterEl.offsetWidth;
  counterEl.classList.add("pop");
}

// ---------- Khởi tạo MediaPipe ----------
async function initMediaPipe() {
  statusEl.textContent = "Đang tải model AI...";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  drawingUtils = new DrawingUtils(ctx);
  statusEl.textContent = "Model sẵn sàng. Đang bật camera...";
}

// ---------- Camera ----------
async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });

  video.srcObject = stream;
  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  await video.play();
  statusEl.textContent = "Sẵn sàng. Vào tư thế chống đẩy!";
}

// ---------- Detect loop ----------
function detectLoop() {
  const now = performance.now();

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const results = poseLandmarker.detectForVideo(video, now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.landmarks && results.landmarks.length > 0) {
      const lm = results.landmarks[0];

      drawingUtils.drawLandmarks(lm, {
        radius: 4,
        color: "#4ade80",
        fillColor: "#4ade80",
      });
      drawingUtils.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
        color: "#22d3ee",
        lineWidth: 3,
      });

      const angleLeft = calcAngle(lm[L.L_SHOULDER], lm[L.L_ELBOW], lm[L.L_WRIST]);
      const angleRight = calcAngle(lm[L.R_SHOULDER], lm[L.R_ELBOW], lm[L.R_WRIST]);
      const avgAngle = (angleLeft + angleRight) / 2;

      angleEl.textContent = `${Math.round(avgAngle)}°`;

      const inPosition = isInPushupPosition(lm);
      const formOk = isFormValid(lm);
      const nowMs = Date.now();

      // ===== BẮT ĐẦU REP =====
      if (!sessionActive) {
        if (inPosition && avgAngle < DOWN_ANGLE) {
          sessionActive = true;
          sessionStartTime = nowMs;
          state = "DOWN";
          statusEl.textContent = "Đã xuống — đẩy lên!";
          statusEl.classList.remove("form-warn", "success");
        } else if (inPosition) {
          statusEl.textContent = `Sẵn sàng xuống... (${Math.round(avgAngle)}°)`;
          statusEl.classList.remove("form-warn", "success");
        } else {
          statusEl.textContent = "⚠️ Chưa vào tư thế chống đẩy";
          statusEl.classList.add("form-warn");
          statusEl.classList.remove("success");
        }
      }
      // ===== ĐANG TRONG REP =====
      else {
        if (nowMs - sessionStartTime > SESSION_TIMEOUT_MS) {
          sessionActive = false;
          state = "UP";
          statusEl.textContent = "⏱️ Rep quá lâu — đã hủy, thử lại";
          statusEl.classList.add("form-warn");
          statusEl.classList.remove("success");
        } else if (state === "DOWN" && avgAngle > UP_ANGLE) {
          if (formOk) {
            count++;
            counterEl.textContent = count;
            popCounter();
            if (count === 1) startTimer();

            const elapsedSec = (Date.now() - startTime) / 1000;
            if (elapsedSec > 5) {
              paceEl.textContent = Math.round((count / elapsedSec) * 60);
            }

            statusEl.textContent = `✅ Rep ${count} hợp lệ!`;
            statusEl.classList.add("success");
            statusEl.classList.remove("form-warn");
          } else {
            statusEl.textContent = "⚠️ Thân không thẳng — không tính";
            statusEl.classList.add("form-warn");
            statusEl.classList.remove("success");
          }
          sessionActive = false;
          state = "UP";
        } else {
          statusEl.textContent = `Đang xuống... (${Math.round(avgAngle)}°)`;
          statusEl.classList.remove("form-warn", "success");
        }
      }
    } else {
      statusEl.textContent = "Không thấy người trong khung hình";
      angleEl.textContent = "--°";
    }
  }

  requestAnimationFrame(detectLoop);
}

// ---------- Start ----------
async function main() {
  try {
    await initMediaPipe();
    await initCamera();
    detectLoop();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Lỗi: " + err.message;
  }
}

main();