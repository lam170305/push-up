import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import { MODEL } from "./config.js";

export class PoseEngine {
  constructor({ numPoses = 1 } = {}) {
    this.numPoses = numPoses;
    this.landmarker = null;
    this.video = null;
    this.stream = null;
    this.onFrame = null;
    this.onError = null;
    this.running = false;
    this.rafId = 0;
    this.lastVideoTime = -1;
    this.fps = 0;
    this.framesSinceSample = 0;
    this.fpsSampledAt = 0;
  }

  async initialize(onProgress = () => {}) {
    onProgress("Đang tải model AI…");

    const vision = await FilesetResolver.forVisionTasks(MODEL.wasmBase);
    const createLandmarker = (delegate) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL.poseLite,
          delegate,
        },
        runningMode: "VIDEO",
        numPoses: this.numPoses,
      });

    try {
      this.landmarker = await createLandmarker("GPU");
    } catch {
      this.landmarker = await createLandmarker("CPU");
    }

    onProgress("Model AI đã sẵn sàng");
  }

  async startCamera(video, onProgress = () => {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error(
        "Trình duyệt không cho phép truy cập camera trên trang này."
      );
      error.code = "insecure";
      throw error;
    }

    onProgress("Đang xin quyền camera…");

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      },
    });

    this.stream = stream;
    this.video = video;
    video.srcObject = stream;

    if (video.readyState < 1) {
      await new Promise((resolve, reject) => {
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener(
          "error",
          () => reject(new Error("Không đọc được luồng camera.")),
          { once: true }
        );
      });
    }

    await video.play();
    onProgress("Camera đã sẵn sàng");
  }

  startFrameLoop(onFrame, onError) {
    this.onFrame = onFrame;
    this.onError = onError;
    this.running = true;
    this.lastVideoTime = -1;
    this.framesSinceSample = 0;
    this.fpsSampledAt = performance.now();

    const loop = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(loop);

      if (
        document.hidden ||
        !this.landmarker ||
        !this.video ||
        this.video.readyState < 2
      ) {
        return;
      }

      if (this.video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = this.video.currentTime;

      const now = performance.now();

      try {
        const result = this.landmarker.detectForVideo(this.video, now);

        this.framesSinceSample += 1;
        if (now - this.fpsSampledAt >= 1000) {
          this.fps = Math.round(
            (this.framesSinceSample * 1000) / (now - this.fpsSampledAt)
          );
          this.framesSinceSample = 0;
          this.fpsSampledAt = now;
        }

        this.onFrame?.({
          landmarks: result.landmarks ?? [],
          now,
          fps: this.fps,
        });
      } catch (error) {
        this.stop();
        this.onError?.(error);
      }
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
    }

    this.landmarker?.close?.();
    this.landmarker = null;
  }
}
