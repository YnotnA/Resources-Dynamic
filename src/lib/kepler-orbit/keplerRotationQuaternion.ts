import type { Vector3Type } from "@lib/vector3/schema/vector3.model";
import { Vector3Math } from "@lib/vector3/vector3Math";

import { Quaternion } from "./quaternion";

export interface RotationObject {
  tidalLocked: boolean;
  rotationPeriodH: number;
  tiltDeg: number;
  spinLongitudeDeg: number;
}

export class KeplerRotationQuaternion {
  private static readonly TAU = 2 * Math.PI;

  private tiltRad: number;
  private spinLongRad: number;
  private rotationRateRadS: number;

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

  // Crée un quaternion qui aligne l'axe X local avec "right" et Y avec "up"
  lookRotationX(right: Vector3Type, up: Vector3Type): Quaternion {
    right = Vector3Math.normalize(right);
    up = Vector3Math.normalize(up);

    // Base orthonormée : X = right, Y = up, Z = forward
    const forward = Vector3Math.normalize(Vector3Math.cross(right, up));
    const correctedUp = Vector3Math.normalize(
      Vector3Math.cross(forward, right),
    );

    return Quaternion.fromBasis(right, correctedUp, forward);
  }

  getRotation(
    timeS: number,
    orbitPos?: Vector3Type,
    orbitPrevPos?: Vector3Type,
  ): Quaternion {
    const { tidalLocked } = this.elements;

    if (tidalLocked && orbitPos) {
      // Direction vers le parent (ce sera l'axe X local)
      const towardParent = Vector3Math.normalize({
        x: -orbitPos.x,
        y: -orbitPos.y,
        z: -orbitPos.z,
      });

      const globalUp = Vector3Math.cross(
        orbitPos,
        orbitPrevPos ?? { x: 0, y: 0, z: 0 },
      );

      let targetRotation = this.lookRotationX(towardParent, globalUp);

      targetRotation = targetRotation.mul(
        Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, this.tiltRad),
      );
      targetRotation = targetRotation.mul(
        Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, this.spinLongRad),
      );

      return targetRotation;
    }

    // ---- CASE 2 : FREE ROTATION ----
    const dt = timeS - this.referenceTimeS;
    const spinAngle = this.rotationRateRadS * dt;

    let q = Quaternion.identity();
    q = q.mul(Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, this.tiltRad));
    q = q.mul(Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, this.spinLongRad));
    q = q.mul(Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, spinAngle));

    return q;
  }
}
