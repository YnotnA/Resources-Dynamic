import type { Vector3Type } from "@lib/vector3/schema/vector3.model";
import { Vector3Math } from "@lib/vector3/vector3Math";

import { Quaternion } from "./quaternion";

export interface RotationObject {
  tidalLocked: boolean;
  rotationPeriodH: number;
  tiltDeg: number;
  spinLongitudeDeg: number;
  argumentOfPeriapsisDeg: number;
}

export class KeplerRotationQuaternion {
  private static readonly TAU = 2 * Math.PI;

  private tiltRad: number;
  private spinLongRad: number;
  private rotationRateRadS: number;
  private lastRotation: Quaternion | null = null;
  private slerpSpeed: number = 0.1;

  constructor(
    private elements: RotationObject,
    private referenceTimeS: number = 0,
  ) {
    const { tiltDeg, spinLongitudeDeg, rotationPeriodH } = elements;
    this.tiltRad = (tiltDeg * Math.PI) / 180;
    this.spinLongRad = (spinLongitudeDeg * Math.PI) / 180;
    this.rotationRateRadS =
      KeplerRotationQuaternion.TAU / (rotationPeriodH * 3600);
  }

  lookRotation(forward: Vector3Type, up: Vector3Type): Quaternion {
    forward = Vector3Math.normalize(forward);
    up = Vector3Math.normalize(up);

    // Si forward et up sont colinéaires, ajuster up
    if (Math.abs(Vector3Math.dot(forward, up)) > 0.999) {
      up =
        Math.abs(forward.y) < 0.99
          ? { x: 0, y: 1, z: 0 }
          : { x: 1, y: 0, z: 0 };
    }

    // Base orthonormée
    const right = Vector3Math.normalize(Vector3Math.cross(up, forward));
    const correctedUp = Vector3Math.normalize(
      Vector3Math.cross(forward, right),
    );

    // Conversion matrice -> quaternion
    const m00 = right.x,
      m01 = correctedUp.x,
      m02 = forward.x;
    const m10 = right.y,
      m11 = correctedUp.y,
      m12 = forward.y;
    const m20 = right.z,
      m21 = correctedUp.z,
      m22 = forward.z;

    const trace = m00 + m11 + m22;
    let w, x, y, z;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      w = 0.25 / s;
      x = (m21 - m12) * s;
      y = (m02 - m20) * s;
      z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
      w = (m21 - m12) / s;
      x = 0.25 * s;
      y = (m01 + m10) / s;
      z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
      w = (m02 - m20) / s;
      x = (m01 + m10) / s;
      y = 0.25 * s;
      z = (m12 + m21) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
      w = (m10 - m01) / s;
      x = (m02 + m20) / s;
      y = (m12 + m21) / s;
      z = 0.25 * s;
    }

    return new Quaternion(x, y, z, w).normalize();
  }

  getRotation(
    timeS: number,
    orbitPos?: Vector3Type,
    deltaTime?: number,
  ): Quaternion {
    const { tidalLocked } = this.elements;

    // ---- CASE 1 : TIDAL LOCK (pas de rotation propre) ----
    if (tidalLocked && orbitPos) {
      const forward = Vector3Math.normalize({
        x: -orbitPos.x,
        y: -orbitPos.y,
        z: -orbitPos.z,
      });

      const globalUp = { x: 0, y: 1, z: 0 };
      let targetRotation = this.lookRotation(forward, globalUp);

      targetRotation = targetRotation.mul(
        Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, this.tiltRad),
      );
      targetRotation = targetRotation.mul(
        Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, this.spinLongRad),
      );

      // Interpolation douce pour éviter les sauts
      if (this.lastRotation && deltaTime) {
        const t = Math.min(this.slerpSpeed * deltaTime * 60, 1);
        const interpolated = this.lastRotation.slerp(targetRotation, t);
        this.lastRotation = interpolated;
        return interpolated;
      }

      this.lastRotation = targetRotation;
      return targetRotation;
    }

    // ---- CASE 2 : FREE ROTATION ----
    const dt = timeS - this.referenceTimeS;
    const spinAngle = this.rotationRateRadS * dt;

    let q = Quaternion.identity();
    q = q.mul(Quaternion.fromAxisAngle({ x: 1, y: 0, z: 0 }, this.tiltRad));
    q = q.mul(Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, this.spinLongRad));
    q = q.mul(Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, spinAngle));

    this.lastRotation = q;
    return q;
  }

  setSlerpSpeed(speed: number) {
    this.slerpSpeed = Math.max(0.001, Math.min(1, speed));
  }
}
