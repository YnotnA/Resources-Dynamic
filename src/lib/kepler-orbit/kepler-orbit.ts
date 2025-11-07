import { keplerOrbitLogger } from "@lib/logger";
import type { Vector3Type } from "@websocket/schema/vector3.model";

export interface OrbitalObject {
  starMassKg: number;
  planetMassKg: number;
  periapsisAU: number;
  apoapsisAU: number;
  inclinationDeg: number;
  longitudeOfAscendingNodeDeg: number;
  argumentOfPeriapsisDeg: number;
  meanAnomalyDeg: number;
}

class Vector3Math {
  static create(x: number = 0, y: number = 0, z: number = 0): Vector3Type {
    return { x, y, z };
  }

  static add(a: Vector3Type, b: Vector3Type): Vector3Type {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static subtract(a: Vector3Type, b: Vector3Type): Vector3Type {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static multiply(v: Vector3Type, scalar: number): Vector3Type {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  }

  static distanceTo(a: Vector3Type, b: Vector3Type): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  static magnitude(v: Vector3Type): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static normalize(v: Vector3Type): Vector3Type {
    const mag = this.magnitude(v);
    if (mag === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }

  static dot(a: Vector3Type, b: Vector3Type): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a: Vector3Type, b: Vector3Type): Vector3Type {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }
}

class Basis3D {
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

export class KeplerOrbit {
  private static readonly AU_M = 1.495978707e11;
  private static readonly G = 6.6743e-11;
  private static readonly TAU = 2.0 * Math.PI;
  private static readonly SOLAR_MASS_KG = 1.98892e30;

  private basis: Basis3D;
  private orbitCenter: Vector3Type;
  private semiMajorAxisM: number;
  private eccentricity: number;
  private meanMotion: number;
  private meanAnomaly: number;

  constructor(
    private elements: OrbitalObject,
    private referenceTimeS: number = 0,
  ) {
    this.orbitCenter = { x: 0, y: 0, z: 0 };

    if (elements.periapsisAU > 0 || elements.apoapsisAU > 0) {
      let rpAU =
        elements.periapsisAU > 0 ? elements.periapsisAU : elements.apoapsisAU;
      let raAU =
        elements.apoapsisAU > 0 ? elements.apoapsisAU : elements.periapsisAU;

      if (raAU < rpAU) {
        [rpAU, raAU] = [raAU, rpAU];
      }

      this.semiMajorAxisM = 0.5 * (rpAU + raAU) * KeplerOrbit.AU_M;
      this.eccentricity = Math.max(
        0,
        (raAU - rpAU) / Math.max(raAU + rpAU, 1e-12),
      );

      keplerOrbitLogger.debug(
        {
          "Semi-major axis": `${(this.semiMajorAxisM / 1e9).toFixed(2)} million km (${(this.semiMajorAxisM / KeplerOrbit.AU_M).toFixed(4)} AU)`,
          Eccentricity: this.eccentricity.toFixed(4),
          Periapsis: `${rpAU.toFixed(4)} AU`,
          Apoapsis: `${raAU.toFixed(4)} AU`,
        },
        "📐 Orbit parameters",
      );
    } else {
      throw new Error("periapsisAU and apoapsisAU must be provided");
    }

    if (elements.starMassKg === 0) {
      keplerOrbitLogger.warn(
        { defaultValue: KeplerOrbit.SOLAR_MASS_KG, orbitalObject: elements },
        "⚠️ Star mass missing. Use default value",
      );
    }

    const starMass = elements.starMassKg || KeplerOrbit.SOLAR_MASS_KG;
    const planetMass = elements.planetMassKg;

    // Create mean motion
    const mu = KeplerOrbit.G * (starMass + planetMass);
    this.meanMotion = Math.sqrt(mu / Math.pow(this.semiMajorAxisM, 3));

    // Create the orbital rotation base
    this.basis = this.createOrbitBasis(
      elements.argumentOfPeriapsisDeg,
      elements.inclinationDeg,
      elements.longitudeOfAscendingNodeDeg,
    );

    const M0 = (elements.meanAnomalyDeg * Math.PI) / 180;
    this.meanAnomaly = this.normalizeAngle(
      M0 + this.meanMotion * referenceTimeS,
    );

    // Check the calculated initial position
    const initialPos = this.getPosition();
    const initialDistance = Vector3Math.magnitude(initialPos);
    keplerOrbitLogger.debug(
      {
        elements,
        "🎯 Mean anomaly at epoch (T=0)": `${elements.meanAnomalyDeg.toFixed(2)}°`,
        "🕐 Reference time": `${referenceTimeS.toFixed(2)}s`,
        "📍 Mean anomaly": `${((this.meanAnomaly * 180) / Math.PI).toFixed(2)}°`,
        distance: `${(initialDistance / 1e9).toFixed(2)} million km`,
        coordinates: `(${(initialPos.x / 1e9).toFixed(2)}, ${(initialPos.y / 1e9).toFixed(2)}, ${(initialPos.z / 1e9).toFixed(2)}) million km`,
      },
      "✅ Initial position calculated",
    );

    // Check if planet is on orbit
    const minR = this.semiMajorAxisM * (1 - this.eccentricity);
    const maxR = this.semiMajorAxisM * (1 + this.eccentricity);
    if (initialDistance < minR * 0.99 || initialDistance > maxR * 1.01) {
      keplerOrbitLogger.warn(
        {
          "Expected range": `[${(minR / 1e9).toFixed(2)}, ${(maxR / 1e9).toFixed(2)}] million km`,
          Actual: `${(initialDistance / 1e9).toFixed(2)} million km`,
        },
        "⚠️  Initial position may be off orbit!",
      );
    }
  }

  getOrbitalPeriod(): number {
    if (this.meanMotion === 0) return 0;
    return (2 * Math.PI) / this.meanMotion;
  }

  private createOrbitBasis(
    argPeriDeg: number,
    incDeg: number,
    nodeDeg: number,
  ): Basis3D {
    let b = Basis3D.identity();
    // Rotation sequence: Rz(Ω) * Rx(i) * Rz(ω)
    b = b.rotated({ x: 0, y: 0, z: 1 }, (nodeDeg * Math.PI) / 180);
    b = b.rotated({ x: 1, y: 0, z: 0 }, (incDeg * Math.PI) / 180);
    b = b.rotated({ x: 0, y: 0, z: 1 }, (argPeriDeg * Math.PI) / 180);
    return b;
  }

  private normalizeAngle(angle: number): number {
    let x = angle % KeplerOrbit.TAU;
    if (x < 0) x += KeplerOrbit.TAU;
    return x;
  }

  private solveKeplerEquation(M: number, e: number): number {
    const Mm = this.normalizeAngle(M);
    let E = e > 0.8 ? Math.PI : Mm;

    for (let i = 0; i < 16; i++) {
      const f = E - e * Math.sin(E) - Mm;
      const fp = 1.0 - e * Math.cos(E);
      const step = -f / Math.max(fp, 1e-12);
      E += step;
      if (Math.abs(step) < 1e-12) break;
    }

    return this.normalizeAngle(E);
  }

  private keplerPositionPlane(a: number, e: number, M: number): Vector3Type {
    const E = this.solveKeplerEquation(M, e);
    const xp = a * (Math.cos(E) - e);
    const zp = a * Math.sqrt(Math.max(1.0 - e * e, 0)) * Math.sin(E);
    return { x: xp, y: 0, z: zp };
  }

  private calculatePosition(M: number): Vector3Type {
    const posPlane = this.keplerPositionPlane(
      this.semiMajorAxisM,
      this.eccentricity,
      M,
    );
    return Vector3Math.add(this.orbitCenter, this.basis.transform(posPlane));
  }

  advance(dt: number): Vector3Type {
    this.meanAnomaly = this.normalizeAngle(
      this.meanAnomaly + this.meanMotion * dt,
    );
    return this.calculatePosition(this.meanAnomaly);
  }

  getPosition(): Vector3Type {
    return this.calculatePosition(this.meanAnomaly);
  }

  getCurrentMeanAnomaly(): number {
    return this.meanAnomaly;
  }
}
