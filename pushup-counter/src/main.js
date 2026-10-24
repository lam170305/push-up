import "./style.css";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

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
let lastVideoTime = -1;

// ---------- Ngưỡng (dựa trên góc khuỷu tay) ----------
const DOWN_ANGLE = 95;      // khuỷu gập sâu -> trạng thái DOWN
const UP_ANGLE = 150;       // khuỷu duỗi gần thẳng -> trạng thái UP
const FORM_TOLERANCE = 35;  // độ lệch cho phép khi kiểm tra thân thẳng
const HORIZONTAL_THRESHOLD = 0.45;
const VIS_THRESHOLD = 0.5;
const ANGLE_SMOOTHING = 0.4; // 0..1 (càng nhỏ càng mượt)
const MIN_REP_MS = 450;      // rep ngắn hơn coi như nhiễu
const MAX_REP_MS = 8000;     // rep dài hơn coi như bỏ dở

// ---------- Landmark indices ----------
const L = {
  L_SHOULDER: 11, L_ELBOW: 13, L_WRIST: 15, L_HIP: 23, L_KNEE: 25, L_ANKLE: 27,
  R_SHOULDER: 12, R_ELBOW: 14, R_WRIST: 16, R_HIP: 24, R_KNEE: 26, R_ANKLE: 28,
};

// Bỏ toàn bộ điểm trên mặt: chỉ giữ vai, khuỷu, cổ tay, hông, gối, cổ chân
const KEEP_LANDMARKS = [
  L.L_SHOULDER, L.L_ELBOW, L.L_WRIST,
  L.R_SHOULDER, L.R_ELBOW, L.R_WRIST,
  L.L_HIP, L.L_KNEE, L.L_ANKLE,
  L.R_HIP, L.R_KNEE, L.R_ANKLE,
];

// Chỉ nối tay + thân
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

// ---------- Màu vẽ (giống tham chiếu) ----------
const DOT_FILL = "#FFC400";      // vàng
const DOT_STROKE = "#1a1a1a";    // viền đậm
const LINE_COLOR = "#ffffff";    // đường trắng

// ---------- State ----------
let state = "UP";
let sessionActive = false;
let sessionStartTime = 0;
let count = 0;
let startTime = null;
let timerInterval = null;
let smoothAngle = null;

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

const visible = (p) => p && p.visibility > VIS_THRESHOLD;

// ---------- Góc khuỷu: ưu tiên bên tay thấy rõ hơn ----------
function getElbowAngle(lm) {
  const leftParts = [lm[L.L_SHOULDER], lm[L.L_ELBOW], lm[L.L_WRIST]];
  const rightParts = [lm[L.R_SHOULDER], lm[L.R_ELBOW], lm[L.R_WRIST]];

  const leftVis = leftParts.reduce((s, p) => s + (p?.visibility ?? 0), 0) / 3;
  const rightVis = rightParts.reduce((s, p) => s + (p?.visibility ?? 0), 0) / 3;

  const leftOk = leftVis >= VIS_THRESHOLD;
  const rightOk = rightVis >= VIS_THRESHOLD;

  if (!leftOk && !rightOk) return null;

  const angleLeft = leftOk ? calcAngle(...leftParts) : null;
  const angleRight = rightOk ? calcAngle(...rightParts) : null;

  if (angleLeft !== null && angleRight !== null) {
    // Bên thấy rõ hơn được trọng số cao hơn
    const wL = leftVis / (leftVis + rightVis);
    return angleLeft * wL + angleRight * (1 - wL);
  }
  return angleLeft ?? angleRight;
}

// ---------- Kiểm tra thân thẳng (không bắt buộc thấy cổ chân) ----------
function isFormValid(lm) {
  const leftVis =
    ((lm[L.L_SHOULDER]?.visibility ?? 0) +
      (lm[L.L_HIP]?.visibility ?? 0) +
      (lm[L.L_ANKLE]?.visibility ?? 0)) / 3;
  const rightVis =
    ((lm[L.R_SHOULDER]?.visibility ?? 0) +
      (lm[L.R_HIP]?.visibility ?? 0) +
      (lm[L.R_ANKLE]?.visibility ?? 0)) / 3;
  const side = leftVis > rightVis ? "L" : "R";

  const shoulder = lm[L[`${side}_SHOULDER`]];
  const hip = lm[L[`${side}_HIP`]];
  const ankle = lm[L[`${side}_ANKLE`]];

  if (!shoulder || !hip) return true;

  // Nếu thấy cổ chân -> kiểm tra cả thân: vai - hông - cổ chân
  if (visible(ankle)) {
    return calcAngle(shoulder, hip, ankle) > 180 - FORM_TOLERANCE;
  }

  // Không thấy cổ chân -> dùng gối làm mốc thay thế
  const knee = lm[L[`${side}_KNEE`]];
  if (visible(hip) && visible(knee)) {
    return calcAngle(shoulder, hip, knee) > 180 - FORM_TOLERANCE;
  }

  // Không đủ điểm để kiểm tra -> không chặn rep
  return true;
}

// ---------- Kiểm tra tư thế chống đẩy (dựa trên tay) ----------
function isInPushupPosition(lm) {
  const ls = lm[L.L_SHOULDER];
  const rs = lm[L.R_SHOULDER];
  const lw = lm[L.L_WRIST];
  const rw = lm[L.R_WRIST];

  if (!visible(ls) || !visible(rs) || !visible(lw) || !visible(rw)) return false;

  const shoulderY = (ls.y + rs.y) / 2;
  const wristY = (lw.y + rw.y) / 2;

  // Cổ tay phải ở dưới vai (tay chống xuống sàn)
  const handsBelowShoulders = wristY >= shoulderY - 0.02;
  if (!handsBelowShoulders) return false;

  // Thân gần nằm ngang: dùng cổ chân nếu thấy, nếu không thì dùng hông
  const ankleVis =
    (lm[L.L_ANKLE]?.visibility ?? 0) + (lm[L.R_ANKLE]?.visibility ?? 0);
  if (ankleVis > VIS_THRESHOLD * 2) {
    const ankleY = (lm[L.L_ANKLE].y + lm[L.R_ANKLE].y) / 2;
    return Math.abs(shoulderY - ankleY) < HORIZONTAL_THRESHOLD;
  }

  const hipVis = (lm[L.L_HIP]?.visibility ?? 0) + (lm[L.R_HIP]?.visibility ?? 0);
  if (hipVis > VIS_THRESHOLD * 2) {
    const hipY = (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2;
    return Math.abs(shoulderY - hipY) < HORIZONTAL_THRESHOLD;
  }

  return true;
}

// ---------- Vẽ skeleton: chấm vàng + đường trắng ----------
function drawSkeleton(lm) {
  const px = (p) => ({ x: p.x * canvas.width, y: p.y * canvas.height });

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Đường nối
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = Math.max(3, canvas.width / 150);
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 6;

  for (const [a, b] of KEEP_CONNECTIONS) {
    const pa = lm[a];
    const pb = lm[b];
    if (!visible(pa) || !visible(pb)) continue;

    const p1 = px(pa);
    const p2 = px(pb);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  // Chấm tròn
  const dotR = Math.max(6, canvas.width / 80);
  for (const idx of KEEP_LANDMARKS) {
    const p = lm[idx];
    if (!visible(p)) continue;

    const { x, y } = px(p);
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = DOT_FILL;
    ctx.fill();

    ctx.lineWidth = Math.max(2, dotR / 3);
    ctx.strokeStyle = DOT_STROKE;
    ctx.stroke();
  }
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
  smoothAngle = null;
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
      drawSkeleton(lm);

      const rawAngle = getElbowAngle(lm);

      if (rawAngle === null) {
        statusEl.textContent = "Không thấy tay trong khung hình";
        statusEl.classList.add("form-warn");
        statusEl.classList.remove("success");
        angleEl.textContent = "--°";
      } else {
        smoothAngle =
          smoothAngle === null
            ? rawAngle
            : smoothAngle + (rawAngle - smoothAngle) * ANGLE_SMOOTHING;

        const angle = smoothAngle;
        angleEl.textContent = `${Math.round(angle)}°`;

        const inPosition = isInPushupPosition(lm);
        const formOk = isFormValid(lm);
        const nowMs = Date.now();

        // ===== BẮT ĐẦU REP =====
        if (!sessionActive) {
          if (inPosition && angle < DOWN_ANGLE) {
            sessionActive = true;
            sessionStartTime = nowMs;
            state = "DOWN";
            statusEl.textContent = "Đã xuống — đẩy lên!";
            statusEl.classList.remove("form-warn", "success");
          } else if (inPosition) {
            statusEl.textContent = `Sẵn sàng xuống... (${Math.round(angle)}°)`;
            statusEl.classList.remove("form-warn", "success");
          } else {
            statusEl.textContent = "⚠️ Chưa vào tư thế chống đẩy";
            statusEl.classList.add("form-warn");
            statusEl.classList.remove("success");
          }
        }
        // ===== ĐANG TRONG REP =====
        else {
          const repMs = nowMs - sessionStartTime;

          if (repMs > MAX_REP_MS) {
            sessionActive = false;
            state = "UP";
            statusEl.textContent = "⏱️ Rep quá lâu — đã hủy, thử lại";
            statusEl.classList.add("form-warn");
            statusEl.classList.remove("success");
          } else if (state === "DOWN" && angle > UP_ANGLE) {
            if (repMs < MIN_REP_MS) {
              statusEl.textContent = "⚡ Quá nhanh — hạ xuống chậm và sâu hơn";
              statusEl.classList.add("form-warn");
              statusEl.classList.remove("success");
            } else if (formOk) {
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
            statusEl.textContent = `Đang xuống... (${Math.round(angle)}°)`;
            statusEl.classList.remove("form-warn", "success");
          }
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
