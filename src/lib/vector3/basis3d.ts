import type { Vector3Type } from "@websocket/schema/vector3.model";

import { Vector3Math } from "./vector3Math";

export class Basis3D {
  constructor(
    public x: Vector3Type = { x: 1, y: 0, z: 0 },
    public y: Vector3Type = { x: 0, y: 1, z: 0 },
    public z: Vector3Type = { x: 0, y: 0, z: 1 },
  ) {}

  transform(v: Vector3Type): Vector3Type {
    return {
      x: this.x.x * v.x + this.x.y * v.y + this.x.z * v.z,
      y: this.y.x * v.x + this.y.y * v.y + this.y.z * v.z,
      z: this.z.x * v.x + this.z.y * v.y + this.z.z * v.z,
    };
  }

  rotated(axis: Vector3Type, angleRad: number): Basis3D {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const axisNorm = Vector3Math.normalize(axis);

    if (Vector3Math.magnitude(axis) === 0) {
      return this;
    }

    const { x: ux, y: uy, z: uz } = axisNorm;

    const m00 = cosA + ux * ux * (1 - cosA);
    const m01 = ux * uy * (1 - cosA) - uz * sinA;
    const m02 = ux * uz * (1 - cosA) + uy * sinA;

    const m10 = uy * ux * (1 - cosA) + uz * sinA;
    const m11 = cosA + uy * uy * (1 - cosA);
    const m12 = uy * uz * (1 - cosA) - ux * sinA;

    const m20 = uz * ux * (1 - cosA) - uy * sinA;
    const m21 = uz * uy * (1 - cosA) + ux * sinA;
    const m22 = cosA + uz * uz * (1 - cosA);

    const rotVec = (v: Vector3Type): Vector3Type => ({
      x: m00 * v.x + m01 * v.y + m02 * v.z,
      y: m10 * v.x + m11 * v.y + m12 * v.z,
      z: m20 * v.x + m21 * v.y + m22 * v.z,
    });

    return new Basis3D(rotVec(this.x), rotVec(this.y), rotVec(this.z));
  }

  inverse(): Basis3D {
    return new Basis3D(
      { x: this.x.x, y: this.y.x, z: this.z.x },
      { x: this.x.y, y: this.y.y, z: this.z.y },
      { x: this.x.z, y: this.y.z, z: this.z.z },
    );
  }

  static identity(): Basis3D {
    return new Basis3D();
  }
}
