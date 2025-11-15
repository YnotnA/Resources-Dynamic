import type { Vector3Type } from "@lib/vector3/schema/vector3.model";
import { Vector3Math } from "@lib/vector3/vector3Math";

export class Quaternion {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
    public w = 1,
  ) {}

  static identity() {
    return new Quaternion(0, 0, 0, 1);
  }

  static fromAxisAngle(axis: Vector3Type, angleRad: number) {
    const half = angleRad / 2;
    const s = Math.sin(half);
    const a = Vector3Math.normalize(axis);
    return new Quaternion(a.x * s, a.y * s, a.z * s, Math.cos(half));
  }

  mul(q: Quaternion): Quaternion {
    return new Quaternion(
      this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y,
      this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x,
      this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w,
      this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z,
    );
  }

  rotateVector(v: Vector3Type): Vector3Type {
    const qv = new Quaternion(v.x, v.y, v.z, 0);
    const qi = new Quaternion(-this.x, -this.y, -this.z, this.w);
    const r = this.mul(qv).mul(qi);
    return { x: r.x, y: r.y, z: r.z };
  }

  // Calcule la norme du quaternion
  length(): number {
    return Math.sqrt(
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w,
    );
  }

  // Normalise le quaternion (retourne un nouveau quaternion)
  normalize(): Quaternion {
    const len = this.length();
    if (len < 0.000001) {
      return Quaternion.identity();
    }
    const invLen = 1 / len;
    return new Quaternion(
      this.x * invLen,
      this.y * invLen,
      this.z * invLen,
      this.w * invLen,
    );
  }

  // Conjugué du quaternion (inverse pour quaternions unitaires)
  conjugate(): Quaternion {
    return new Quaternion(-this.x, -this.y, -this.z, this.w);
  }

  // Inverse du quaternion
  inverse(): Quaternion {
    const lenSq =
      this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    if (lenSq < 0.000001) {
      return Quaternion.identity();
    }
    const invLenSq = 1 / lenSq;
    return new Quaternion(
      -this.x * invLenSq,
      -this.y * invLenSq,
      -this.z * invLenSq,
      this.w * invLenSq,
    );
  }

  // Interpolation sphérique (pour les rotations douces)
  slerp(target: Quaternion, t: number): Quaternion {
    if (t <= 0) return this;
    if (t >= 1) return target;

    let dot =
      this.x * target.x +
      this.y * target.y +
      this.z * target.z +
      this.w * target.w;

    // Si les quaternions sont opposés, inverser l'un d'eux
    let q2 = target;
    if (dot < 0) {
      dot = -dot;
      q2 = new Quaternion(-target.x, -target.y, -target.z, -target.w);
    }

    // Si les quaternions sont très proches, faire une interpolation linéaire
    if (dot > 0.9995) {
      return new Quaternion(
        this.x + t * (q2.x - this.x),
        this.y + t * (q2.y - this.y),
        this.z + t * (q2.z - this.z),
        this.w + t * (q2.w - this.w),
      ).normalize();
    }

    // Interpolation sphérique standard
    const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
    const sinTheta = Math.sin(theta);
    const a = Math.sin((1 - t) * theta) / sinTheta;
    const b = Math.sin(t * theta) / sinTheta;

    return new Quaternion(
      a * this.x + b * q2.x,
      a * this.y + b * q2.y,
      a * this.z + b * q2.z,
      a * this.w + b * q2.w,
    );
  }

  // Produit scalaire entre quaternions
  dot(q: Quaternion): number {
    return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
  }

  // Clone le quaternion
  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }
}
