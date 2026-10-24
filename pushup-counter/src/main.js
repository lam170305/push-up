import "./style.css";
import { THRESHOLDS } from "./lib/config.js";
import { PHASE } from "./lib/tracker.js";
import { PlayerSession } from "./lib/player-session.js";
import { PoseEngine } from "./lib/pose-engine.js";
import { SkeletonRenderer } from "./lib/renderer.js";

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

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
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

function renderAngle(frame) {
  setText(
    els.angle,
    frame.angle === null ? "--°" : `${Math.round(frame.angle)}°`
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

  if (frame.phase === PHASE.DOWN) {
    if (frame.angle <= THRESHOLDS.deepAngle) {
      return { text: "Đủ độ sâu — đẩy mạnh lên.", tone: "good" };
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
