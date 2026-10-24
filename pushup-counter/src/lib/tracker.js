import { THRESHOLDS } from "./config.js";
import { clamp } from "./geometry.js";
import { analyzePose } from "./pose-analysis.js";

export const PHASE = Object.freeze({
  IDLE: "idle",
  READY: "ready",
  DOWN: "down",
  UP: "up",
});

export const REJECT = Object.freeze({
  FAST: "fast",
  SHALLOW: "shallow",
  FORM: "form",
  TIMEOUT: "timeout",
  POSTURE: "posture",
  LOST: "lost",
});

export class PushupTracker {
  constructor(thresholds = THRESHOLDS) {
    this.thresholds = thresholds;
    this.reset();
  }

  reset() {
    this.phase = PHASE.IDLE;
    this.angle = null;
    this.lastFrameAt = null;
    this.lastSeenAt = null;
    this.lastSmoothAt = null;
    this.rep = null;
    this.armed = true;
    this.event = null;
    this.eventId = 0;
  }

  update(landmarks, now) {
    this.event = null;

    if (!landmarks || landmarks.length === 0) {
      return this.markMissing(now);
    }

    const pose = analyzePose(landmarks);
    if (pose.angle === null) {
      return this.markMissing(now);
    }

    this.lastSeenAt = now;
    const gap =
      this.lastSmoothAt === null ? Number.POSITIVE_INFINITY : now - this.lastSmoothAt;

    if (this.angle === null || gap > this.thresholds.lostResetMs) {
      this.angle = pose.angle;
    } else {
      const alpha =
        1 -
        Math.exp(
          -Math.min(gap, 250) / this.thresholds.smoothingTauMs
        );
      this.angle += (pose.angle - this.angle) * alpha;
    }
    this.lastSmoothAt = now;

    const dt =
      this.lastFrameAt === null
        ? 16
        : clamp(now - this.lastFrameAt, 0, 250);
    this.lastFrameAt = now;

    if (this.rep === null) {
      this.updateWithoutRep(pose, now);
    } else {
      this.updateRep(pose, dt, now);
    }

    return this.frame(now, {
      angle: this.angle,
      inPosition: pose.inPosition,
      form: pose.form,
    });
  }

  updateWithoutRep(pose, now) {
    if (this.angle >= this.thresholds.upAngle) {
      this.armed = true;
    }

    if (
      this.armed &&
      pose.inPosition &&
      this.angle <= this.thresholds.downStartAngle
    ) {
      this.rep = {
        startedAt: now,
        minAngle: this.angle,
        lastAngle: this.angle,
        rising: false,
        badFormMs: 0,
        outOfPositionMs: 0,
      };
      this.armed = false;
      this.phase = PHASE.DOWN;
      return;
    }

    if (!pose.inPosition) {
      this.phase = PHASE.IDLE;
      return;
    }

    this.phase = this.armed ? PHASE.READY : PHASE.IDLE;
  }

  updateRep(pose, dt, now) {
    const rep = this.rep;

    if (pose.inPosition) {
      rep.outOfPositionMs = Math.max(0, rep.outOfPositionMs - dt * 0.5);
    } else {
      rep.outOfPositionMs += dt;
    }

    rep.rising = this.angle > rep.lastAngle + 0.15;
    rep.lastAngle = this.angle;
    rep.minAngle = Math.min(rep.minAngle, this.angle);

    if (pose.inPosition && pose.form.checked && !pose.form.ok) {
      rep.badFormMs += dt;
    }

    const elapsed = now - rep.startedAt;

    if (rep.outOfPositionMs > this.thresholds.maxOutOfPositionMs) {
      this.reject(REJECT.POSTURE, elapsed);
      return;
    }

    if (elapsed > this.thresholds.maxRepMs) {
      this.reject(REJECT.TIMEOUT, elapsed);
      return;
    }

    if (pose.inPosition && this.angle >= this.thresholds.upAngle) {
      if (elapsed < this.thresholds.minRepMs) {
        this.reject(REJECT.FAST, elapsed);
        return;
      }

      if (rep.minAngle > this.thresholds.deepAngle) {
        this.reject(REJECT.SHALLOW, elapsed);
        return;
      }

      if (rep.badFormMs > this.thresholds.maxBadFormMs) {
        this.reject(REJECT.FORM, elapsed);
        return;
      }

      this.event = {
        type: "rep",
        id: ++this.eventId,
        duration: elapsed,
        minAngle: rep.minAngle,
      };
      this.rep = null;
      this.armed = true;
      this.phase = PHASE.READY;
      return;
    }

    if (this.angle <= this.thresholds.deepAngle) {
      this.phase = PHASE.DOWN;
    } else {
      this.phase = rep.rising ? PHASE.UP : PHASE.DOWN;
    }
  }

  reject(reason, duration = 0) {
    this.event = {
      type: "reject",
      id: ++this.eventId,
      reason,
      duration,
    };
    this.rep = null;
    this.armed =
      this.angle !== null && this.angle >= this.thresholds.upAngle - 2;
    this.phase = this.armed ? PHASE.READY : PHASE.IDLE;
  }

  markMissing(now) {
    this.event = null;

    const missingMs =
      this.lastSeenAt === null
        ? Number.POSITIVE_INFINITY
        : now - this.lastSeenAt;

    if (this.rep && missingMs >= this.thresholds.maxMissingMs) {
      this.reject(REJECT.LOST);
      this.armed = false;
    }

    if (this.rep === null) {
      this.phase = PHASE.IDLE;
    }

    if (missingMs >= this.thresholds.lostResetMs) {
      this.angle = null;
      this.lastSmoothAt = null;
    }

    this.lastFrameAt = null;

    return this.frame(now, {
      angle: null,
      inPosition: false,
      form: { ok: true, checked: false },
    });
  }

  frame(now, overrides = {}) {
    const angle =
      overrides.angle !== undefined ? overrides.angle : this.angle;
    const span = this.thresholds.upAngle - this.thresholds.deepAngle;

    return {
      now,
      phase: this.phase,
      angle,
      depth:
        angle === null
          ? 0
          : clamp(
              (this.thresholds.upAngle - angle) / span,
              0,
              1
            ),
      inPosition: overrides.inPosition ?? false,
      form: overrides.form ?? { ok: true, checked: false },
      repActive: this.rep !== null,
      armed: this.armed,
      event: this.event,
    };
  }
}
