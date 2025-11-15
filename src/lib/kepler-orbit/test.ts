import type { Vector3Type } from "@lib/vector3/schema/vector3.model";
import { Vector3Math } from "@lib/vector3/vector3Math";

import type { OrbitalObject } from "./kepler-orbit";
import type { RotationObject } from "./keplerRotationQuaternion";
import { Quaternion } from "./quaternion";

export class SuperRotation {
  private heure_rotation: number; // durée rotation sur Y local

  constructor(
    private elements: RotationObject & OrbitalObject,
    private referenceTimeS: number = 0,
  ) {
    this.heure_rotation = elements.rotationPeriodH;
  }

  getRotation(timeS: number, position: Vector3Type) {
    const ORIGIN = { x: 0, y: 0, z: 0 }; // centre du système
    const heure = (timeS - this.referenceTimeS) / 3600; // temps en heure depuis référence

    // Axe X local = centre vers position de l'astre
    const dirX = Vector3Math.normalize(Vector3Math.subtract(position, ORIGIN));

    // Axe Z local = normal orbital (à récupérer depuis tes éléments orbitaux)
    // Pour l'instant j'utilise Y+ mais tu devrais calculer la vraie normale
    // à partir de l'inclinaison et du nœud ascendant
    const normalOrbital = this.getOrbitalNormal();

    // Axe Y local = Z × X (perpendiculaire au plan formé par X et Z)
    const dirY = Vector3Math.normalize(Vector3Math.cross(normalOrbital, dirX));

    // Recalculer Z pour assurer l'orthogonalité parfaite
    const dirZ = Vector3Math.normalize(Vector3Math.cross(dirX, dirY));

    // Matrice des axes locaux (colonnes = axes du repère local)
    const rotMatrix = [
      [dirX.x, dirY.x, dirZ.x],
      [dirX.y, dirY.y, dirZ.y],
      [dirX.z, dirY.z, dirZ.z],
    ];

    // Orientation de base (pointe X vers position, Z vers normale orbitale)
    const baseOrientation = Quaternion.fromRotationMatrix(rotMatrix);

    // Rotation propre de l'astre sur Y local
    const spinAngle = 2 * Math.PI * (heure / this.heure_rotation);
    const spinQuat = Quaternion.fromAxisAngle(dirY, spinAngle);

    // Orientation totale : d'abord l'orientation de base, puis la rotation propre
    const finalOrientation = baseOrientation.mul(spinQuat);

    return finalOrientation;
  }

  private getOrbitalNormal(): Vector3Type {
    // Tu dois calculer la normale à partir de tes éléments orbitaux
    // Inclinaison (i) et longitude du nœud ascendant (Ω)

    const i = (this.elements.inclinationDeg * Math.PI) / 180; // en radians
    const omega = (this.elements.longitudeOfAscendingNodeDeg * Math.PI) / 180; // en radians

    // Normale du plan orbital
    return {
      x: Math.sin(i) * Math.sin(omega),
      y: Math.cos(i),
      z: -Math.sin(i) * Math.cos(omega),
    };
  }
}
