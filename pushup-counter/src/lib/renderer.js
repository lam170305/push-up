import { CONNECTIONS, KEEP_LANDMARKS, THRESHOLDS } from "./config.js";
import { pointVisibility } from "./geometry.js";

export class SkeletonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  resize(video) {
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;

    if (!width || !height) return false;
    if (this.canvas.width === width && this.canvas.height === height) {
      return false;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(landmarks) {
    this.clear();
    if (!landmarks) return;

    const { ctx, canvas } = this;
    const isVisible = (point) =>
      point && pointVisibility(point) >= THRESHOLDS.minVisibility;
    const scale = canvas.width / 1280;
    const lineWidth = Math.max(3, 5 * scale);
    const dotRadius = Math.max(5, 9 * scale);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = 6;

    ctx.beginPath();
    for (const [start, end] of CONNECTIONS) {
      const a = landmarks[start];
      const b = landmarks[end];
      if (!isVisible(a) || !isVisible(b)) continue;

      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (const index of KEEP_LANDMARKS) {
      const point = landmarks[index];
      if (!isVisible(point)) continue;

      const x = point.x * canvas.width;
      const y = point.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#ffc400";
      ctx.fill();
      ctx.lineWidth = Math.max(2, dotRadius * 0.32);
      ctx.strokeStyle = "rgba(20, 18, 8, 0.88)";
      ctx.stroke();
    }
  }
}
