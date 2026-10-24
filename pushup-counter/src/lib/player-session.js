import { PushupTracker } from "./tracker.js";

export class PlayerSession {
  constructor({ name = "Bạn", tracker = new PushupTracker() } = {}) {
    this.name = name;
    this.tracker = tracker;
    this.reset();
  }

  reset() {
    this.tracker.reset();
    this.count = 0;
    this.repDurations = [];
    this.activeMs = 0;
    this.started = false;
    this.lastUpdateAt = null;
  }

  update(landmarks, now) {
    if (this.started && this.lastUpdateAt !== null) {
      this.activeMs += Math.min(300, Math.max(0, now - this.lastUpdateAt));
    }
    this.lastUpdateAt = now;

    return this.handle(this.tracker.update(landmarks, now));
  }

  markMissing(now) {
    this.lastUpdateAt = now;
    return this.handle(this.tracker.markMissing(now));
  }

  handle(frame) {
    if (frame.event?.type === "rep") {
      this.count += 1;
      this.repDurations.push(frame.event.duration);

      if (!this.started) {
        this.started = true;
        this.activeMs = frame.event.duration;
      }
    }

    return { ...frame, stats: this.getStats() };
  }

  getStats() {
    return {
      count: this.count,
      elapsedMs: this.activeMs,
      pace:
        this.activeMs >= 5000
          ? this.count / (this.activeMs / 60000)
          : null,
      lastRepMs:
        this.repDurations.length > 0
          ? this.repDurations[this.repDurations.length - 1]
          : null,
      started: this.started,
    };
  }
}
