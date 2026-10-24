import "./style.css";
import { THRESHOLDS } from "./lib/config.js";
import { PHASE } from "./lib/tracker.js";
import { PlayerSession } from "./lib/player-session.js";
import { PoseEngine } from "./lib/pose-engine.js";
import { SkeletonRenderer } from "./lib/renderer.js";

<<<<<<< HEAD
const els = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  videoCard: document.getElementById("videoCard"),
  angle: document.getElementById("angle"),
  phaseChip: document.getElementById("phaseChip"),
  depthFill: document.getElementById("depthFill"),
  depthValue: document.getElementById("depthValue"),
  counter: document.getElementById("counter"),
  counterFloat: document.getElementById("counterFloat"),
  sessionBadge: document.getElementById("sessionBadge"),
  repMeta: document.getElementById("repMeta"),
  timer: document.getElementById("timer"),
  pace: document.getElementById("pace"),
  status: document.getElementById("status"),
  statusCard: document.getElementById("statusCard"),
  btnReset: document.getElementById("btnReset"),
  btnRetry: document.getElementById("btnRetry"),
  liveBadge: document.getElementById("liveBadge"),
  liveText: document.getElementById("liveText"),
  loadingOverlay: document.getElementById("loadingOverlay"),
  loadingText: document.getElementById("loadingText"),
  errorOverlay: document.getElementById("errorOverlay"),
  errorTitle: document.getElementById("errorTitle"),
  errorMessage: document.getElementById("errorMessage"),
=======
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusEl = document.getElementById("status");
const angleEl = document.getElementById("angle");
const counterEl = document.getElementById("counter");
const timerEl = document.getElementById("timer");
const paceEl = document.getElementById("pace");
const btnReset = document.getElementById("btnReset");
const phaseEl = document.getElementById("phase");
const phasePill = document.getElementById("phasePill");
const primaryCard = document.querySelector(".stat-card.primary");
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
>>>>>>> 8a5a45dda0664fa228899261f6b32595ebb2e10a
};

const player = new PlayerSession({ name: "Bạn" });
const renderer = new SkeletonRenderer(els.canvas);
const engine = new PoseEngine({ numPoses: 1 });

const ui = {
  count: 0,
  phaseKey: "",
  phaseLabel: "",
  statusText: "",
  statusTone: "",
  depth: -1,
};

let notice = null;

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

<<<<<<< HEAD
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
=======
const visible = (p) => p && p.visibility > VIS_THRESHOLD;

// ---------- HUD: pha động tác + thanh tiến trình ----------
function setPhase(label, kind) {
  if (!phaseEl || !phasePill) return;
  phaseEl.textContent = label;
  phasePill.classList.toggle("is-up", kind === "up");
  phasePill.classList.toggle("is-down", kind === "down");
}

function setRepProgress(percent) {
  if (primaryCard) {
    primaryCard.style.setProperty("--rep-progress", `${percent}%`);
  }
}

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
>>>>>>> 8a5a45dda0664fa228899261f6b32595ebb2e10a
}

function setLiveState(state, label) {
  els.liveBadge.dataset.state = state;
  setText(els.liveText, label);
}

function setLoading(active, text) {
  els.loadingOverlay.classList.toggle("is-hidden", !active);
  els.videoCard.setAttribute("aria-busy", String(active));
  if (text) setText(els.loadingText, text);
}

function syncVideoSize() {
  if (!renderer.resize(els.video)) return;

  const ratio =
    els.video.videoWidth && els.video.videoHeight
      ? `${els.video.videoWidth} / ${els.video.videoHeight}`
      : "16 / 9";

  els.videoCard.style.setProperty("--video-ratio", ratio);
}

function renderStatus(text, tone = "neutral") {
  if (text === ui.statusText && tone === ui.statusTone) return;
  ui.statusText = text;
  ui.statusTone = tone;
  setText(els.status, text);
  els.statusCard.dataset.tone = tone;
}

function renderCount(count, animate = true) {
  if (count === ui.count) return;

  ui.count = count;
  setText(els.counter, String(count));
  setText(els.counterFloat, String(count));

  if (!animate) return;

  els.counter.classList.remove("pop");
  void els.counter.offsetWidth;
  els.counter.classList.add("pop");
}

function renderStats(stats) {
  setText(els.timer, formatTime(stats.elapsedMs));
  setText(
    els.pace,
    stats.pace === null ? "--" : String(Math.round(stats.pace))
  );
  setText(
    els.repMeta,
    stats.lastRepMs === null
      ? "Rep đầu tiên sẽ bắt đầu tính giờ"
      : `Rep gần nhất · ${(stats.lastRepMs / 1000).toFixed(1)}s`
  );
  setText(els.sessionBadge, stats.count === 0 ? "Sẵn sàng" : "Đang tập");
}

function getPhaseMeta(frame) {
  if (frame.angle === null) return { key: "idle", label: "MẤT DẤU" };
  if (!frame.inPosition) return { key: "idle", label: "CHỜ TƯ THẾ" };

  if (frame.phase === PHASE.DOWN) {
    return frame.angle <= THRESHOLDS.deepAngle
      ? { key: "down", label: "ĐỦ SÂU" }
      : { key: "down", label: "HẠ XUỐNG" };
  }

  if (frame.phase === PHASE.UP) return { key: "up", label: "ĐẨY LÊN" };
  if (frame.phase === PHASE.READY) {
    return { key: "ready", label: "SẴN SÀNG" };
  }

  return { key: "idle", label: "CHỜ" };
}

function renderPhase(frame) {
  const phase = getPhaseMeta(frame);

  if (phase.key !== ui.phaseKey) {
    ui.phaseKey = phase.key;
    els.phaseChip.dataset.phase = phase.key;
  }

  if (phase.label !== ui.phaseLabel) {
    ui.phaseLabel = phase.label;
    setText(els.phaseChip, phase.label);
  }
}

<<<<<<< HEAD
function renderAngle(frame) {
  setText(
    els.angle,
    frame.angle === null ? "--°" : `${Math.round(frame.angle)}°`
=======
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
  setPhase("READY", "ready");
  setRepProgress(0);
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
>>>>>>> 8a5a45dda0664fa228899261f6b32595ebb2e10a
  );

  const depth = Math.round(frame.depth * 100);
  setText(els.depthValue, frame.angle === null ? "--" : `${depth}%`);

  if (depth !== ui.depth) {
    ui.depth = depth;
    els.depthFill.style.width = `${depth}%`;
    els.depthFill.classList.toggle("is-deep", depth >= 92);
  }
}

function getStatus(frame) {
  if (frame.angle === null) {
    return {
      text: "Đưa toàn bộ cơ thể vào khung hình để bắt đầu.",
      tone: "warn",
    };
  }

  if (!frame.inPosition) {
    return {
      text: "Vào tư thế chống đẩy, quay camera ngang hông.",
      tone: "warn",
    };
  }

  if (frame.form.checked && !frame.form.ok) {
    return {
      text: "Giữ thân thẳng và siết cơ bụng.",
      tone: "warn",
    };
  }

<<<<<<< HEAD
  if (frame.phase === PHASE.DOWN) {
    if (frame.angle <= THRESHOLDS.deepAngle) {
      return { text: "Đủ độ sâu — đẩy mạnh lên.", tone: "good" };
=======
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
        setPhase("READY", "ready");
      } else {
        smoothAngle =
          smoothAngle === null
            ? rawAngle
            : smoothAngle + (rawAngle - smoothAngle) * ANGLE_SMOOTHING;

        const angle = smoothAngle;
        angleEl.textContent = `${Math.round(angle)}°`;
        setPhase(angle < DOWN_ANGLE ? "DOWN" : "UP", angle < DOWN_ANGLE ? "down" : "up");

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

              const inCycle = count % 10;
              setRepProgress(inCycle === 0 ? 100 : inCycle * 10);

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
      setPhase("READY", "ready");
>>>>>>> 8a5a45dda0664fa228899261f6b32595ebb2e10a
    }
    return { text: "Hạ người xuống chậm và sâu hơn.", tone: "neutral" };
  }

  if (frame.phase === PHASE.UP) {
    return { text: "Đẩy lên hết biên độ.", tone: "neutral" };
  }

  if (frame.phase === PHASE.READY) {
    return { text: "Sẵn sàng — bắt đầu rep tiếp theo.", tone: "neutral" };
  }

  return { text: "Đang tìm tư thế chống đẩy…", tone: "neutral" };
}

function handleEvent(event, stats, now) {
  if (event.type === "rep") {
    notice = {
      text: `Rep ${stats.count} hợp lệ!`,
      tone: "good",
      until: now + 1500,
    };
    return;
  }

  const messages = {
    fast: "Chậm lại — rep quá nhanh.",
    shallow: "Chưa đủ sâu — hạ thấp hơn nữa.",
    form: "Thân chưa thẳng — rep không được tính.",
    timeout: "Rep quá lâu — đã hủy, thử lại.",
    posture: "Ra khỏi tư thế — rep đã hủy.",
    lost: "Mất dấu cơ thể — rep đã hủy.",
  };

  const text = messages[event.reason];
  if (text) {
    notice = { text, tone: "warn", until: now + 1800 };
  }
}

function renderFrame(frame, now) {
  renderAngle(frame);
  renderPhase(frame);
  renderCount(frame.stats.count);
  renderStats(frame.stats);

  if (frame.event) handleEvent(frame.event, frame.stats, now);

  const status =
    notice && now < notice.until ? notice : getStatus(frame);

  renderStatus(status.text, status.tone);
}

function onFrame({ landmarks, now }) {
  syncVideoSize();

  const pose = landmarks[0] ?? null;

  if (pose) {
    renderer.draw(pose);
  } else {
    renderer.clear();
  }

  const frame = pose
    ? player.update(pose, now)
    : player.markMissing(now);

  renderFrame(frame, now);
}

function resetSession() {
  player.reset();
  notice = null;
  ui.depth = -1;
  ui.count = -1;

  renderCount(0, false);
  renderStats(player.getStats());
  renderAngle({ angle: null, depth: 0 });

  ui.phaseKey = "idle";
  ui.phaseLabel = "CHỜ TƯ THẾ";
  els.phaseChip.dataset.phase = "idle";
  setText(els.phaseChip, "CHỜ TƯ THẾ");

  renderStatus("Đã làm mới — vào tư thế chống đẩy.", "neutral");
}

function describeError(error) {
  if (error?.code === "insecure") {
    return {
      title: "Cần kết nối bảo mật",
      message:
        "Camera chỉ hoạt động trên HTTPS hoặc localhost. Hãy mở trang qua HTTPS hoặc chạy npm run dev.",
    };
  }

  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        title: "Chưa có quyền camera",
        message:
          "Bạn đã từ chối quyền camera. Hãy cấp quyền trong cài đặt trình duyệt rồi thử lại.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        title: "Không tìm thấy camera",
        message: "Hãy kết nối webcam hoặc kiểm tra lại thiết bị.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        title: "Camera đang bận",
        message:
          "Một ứng dụng khác đang sử dụng camera. Hãy đóng ứng dụng đó rồi thử lại.",
      };
    case "OverconstrainedError":
      return {
        title: "Camera không tương thích",
        message:
          "Thiết bị không hỗ trợ cấu hình camera này. Hãy thử webcam khác.",
      };
    default:
      return {
        title: "Không thể khởi động",
        message:
          error?.message ||
          "Đã có lỗi không xác định. Hãy tải lại trang.",
      };
  }
}

function showError(error) {
  const { title, message } = describeError(error);

  setLiveState("error", "LỖI");
  setLoading(false);
  setText(els.errorTitle, title);
  setText(els.errorMessage, message);
  els.errorOverlay.classList.remove("is-hidden");
  renderStatus(message, "warn");
}

function onEngineError(error) {
  console.error(error);
  showError(error);
}

async function start() {
  els.btnReset.addEventListener("click", resetSession);
  els.btnRetry.addEventListener("click", () => window.location.reload());
  window.addEventListener("pagehide", () => engine.stop(), { once: true });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });

  setLiveState("loading", "ĐANG TẢI");
  setLoading(true, "Đang khởi động camera và model AI…");

  try {
    await Promise.all([
      engine.startCamera(els.video),
      engine.initialize(),
    ]);
  } catch (error) {
    engine.stop();
    showError(error);
    return;
  }

  syncVideoSize();
  setLoading(false);
  setLiveState("live", "LIVE");
  renderStatus("Camera đã sẵn sàng — vào tư thế chống đẩy.", "good");
  engine.startFrameLoop(onFrame, onEngineError);
}

start();
