import { Basis3D } from "@lib/vector3/basis3d";
import type { Vector3Type } from "@lib/vector3/schema/vector3.model";
import { Vector3Math } from "@lib/vector3/vector3Math";

export interface RotationObject {
  tidalLocked: boolean;
  rotationPeriodH: number;
  tiltDeg: number;
  spinLongitudeDeg: number;
}

export class KeplerRotation {
  private static readonly TAU = 2.0 * Math.PI;
  private tiltRad: number;
  private spinLongitudeRad: number;
  private rotationRateRadS: number;
  private basis: Basis3D;

  constructor(
    private elements: RotationObject,
    private referenceTimeS: number = 0,
  ) {
    const { tiltDeg, spinLongitudeDeg, rotationPeriodH } = elements;
    this.tiltRad = (tiltDeg * Math.PI) / 180;
    this.spinLongitudeRad = (spinLongitudeDeg * Math.PI) / 180;
    this.rotationRateRadS = KeplerRotation.TAU / (rotationPeriodH * 3600);

    // Base d'orientation initiale pour rotation libre
    // Ordre : d'abord le tilt (inclinaison de l'axe), puis le spin longitude
    this.basis = Basis3D.identity()
      .rotated({ x: 1, y: 0, z: 0 }, this.tiltRad)
      .rotated({ x: 0, y: 1, z: 0 }, this.spinLongitudeRad);
  }

  getBasisAtTime(timeS: number, orbitPos?: Vector3Type): Basis3D {
    const { tidalLocked } = this.elements;

    if (tidalLocked && orbitPos) {
      // Direction vers la planète (vecteur de la lune vers la planète)
      const towardsPlanet = Vector3Math.normalize(
        Vector3Math.multiply(orbitPos, -1),
      );

      // Normale orbitale (Y est "up" dans le système)
      const orbitalNormal = { x: 0, y: 1, z: 0 };

      // Calculer le vecteur tangent à l'orbite (perpendiculaire à towardsPlanet et orbitalNormal)
      let tangent = Vector3Math.cross(orbitalNormal, towardsPlanet);
      const tangentMagnitude = Vector3Math.magnitude(tangent);

      // Cas dégénéré : si la lune est au pôle
      if (tangentMagnitude < 0.001) {
        tangent = { x: 1, y: 0, z: 0 };
      } else {
        tangent = Vector3Math.normalize(tangent);
      }

      // Recalculer la normale réelle pour avoir une base orthonormée
      const normal = Vector3Math.normalize(
        Vector3Math.cross(towardsPlanet, tangent),
      );

      // Construire la base : X = tangent, Y = normal, Z = towardsPlanet
      // Cela signifie que l'axe Z de la lune pointe vers la planète
      let tidalBasis = new Basis3D(tangent, normal, towardsPlanet);

      // Appliquer le tilt (rotation autour de l'axe tangent = X local)
      // Cela incline l'axe de rotation de la lune
      if (Math.abs(this.tiltRad) > 0.0001) {
        tidalBasis = tidalBasis.rotated(tangent, this.tiltRad);
      }

      // Appliquer la longitude de spin (rotation autour de Z local = vers planète)
      // Cela fait "tourner" la lune sur elle-même tout en gardant la même face
      if (Math.abs(this.spinLongitudeRad) > 0.0001) {
        tidalBasis = tidalBasis.rotated(towardsPlanet, this.spinLongitudeRad);
      }

      return tidalBasis;
    }

    // Rotation normale (non tidal-locked)
    const dt = timeS - this.referenceTimeS;
    const rotationAngle = this.rotationRateRadS * dt;

    // Rotation autour de l'axe Y (axe polaire)
    return this.basis.rotated({ x: 0, y: 1, z: 0 }, rotationAngle);
  }

  toEuler(timeS: number, orbitPos?: Vector3Type): Vector3Type {
    const basis = this.getBasisAtTime(timeS, orbitPos);

    // On travaille directement avec les vecteurs de base plutôt que la matrice
    // basis.x = vecteur X (right)
    // basis.y = vecteur Y (up)
    // basis.z = vecteur Z (forward)

    // Extraction des angles d'Euler selon l'ordre YXZ (convention Godot)
    // Formules pour l'ordre YXZ :
    // R = Ry(yaw) * Rx(pitch) * Rz(roll)

    let roll, pitch, yaw;

    // sin(pitch) = basis.z.y (composante Y du vecteur forward)
    const sy = basis.z.y;

    if (Math.abs(sy) < 0.99999) {
      // Pas de gimbal lock
      pitch = Math.asin(sy);
      yaw = Math.atan2(-basis.z.x, basis.z.z);
      roll = Math.atan2(-basis.x.y, basis.y.y);
    } else {
      // Gimbal lock (pitch = ±90°)
      pitch = sy > 0 ? Math.PI / 2 : -Math.PI / 2;
      yaw = Math.atan2(basis.x.z, basis.x.x);
      roll = 0;
    }

    // Retour selon la convention Godot : x=roll, y=pitch, z=yaw
    return { x: roll, y: pitch, z: yaw };
  }
}
