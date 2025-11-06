import type { PlanetFromDB, SystemFromDB, Vector3 } from "@lib/kepler-orbit";
import {
  KeplerOrbitService,
  type OrbitCalculationParams,
  // keplerOrbitService,
  keplerOrbitService,
} from "@lib/kepler-orbit";
// console.log(samples1);

// // Deuxième appel pour une plage suivante: utilisera le cache!
// console.log("📞 Deuxième demande: 100-200s (couverts par le cache)");
// const params2: OrbitCalculationParams = {
//   ...params1,
//   startTimeS: 100,
//   durationS: 100,
// };
// const samples2 = keplerOrbitService.getPositions(params2);
// console.log(`✅ Reçu: ${samples2.length} échantillons (depuis cache)\n`);

import { OrbitDataHelper } from "@lib/kepler-orbit";
import { decode, encode } from "@msgpack/msgpack";
import WebSocket from "ws";

const planetData: PlanetFromDB = {
  id: 3,
  uuid: "5514fdf5-a411-42ea-aee5-0c2d6343accc",
  system_id: 1,
  name: "Tarsis_1",
  internal_name: "Tarsis_1",
  mass_kg: 0.318718034317024,
  periapsis_au: 0.0518740964529183,
  apoapsis_au: 0.0561969378239948,
  inc_deg: 0.43879826599353,
  node_deg: 3.73398360904092,
  arg_peri_deg: 89.2849996583068,
  mean_anomaly_deg: 81.9,
  radius_km: 4678.72368420455,
  radius_gravity_influence_km: 35315.60801443042,
};

// Données du système stellaire (à récupérer depuis DB)
const systemData: SystemFromDB = {
  id: 1,
  star_mass_kg: 0.758581416228569, // Multiplicateur (75.8% de la masse solaire)
};

// Conversion
const orbitalElements = KeplerOrbitService.planetDBToOrbitalElements(
  planetData,
  systemData,
);

// console.log("🌟 Orbital Elements:");
// console.log(`  Star mass: ${orbitalElements.starMassKg.toExponential(2)} kg`);
// console.log(`  Planet mass: ${orbitalElements.planetMassKg} kg`);
// console.log(
//   `  Semi-major axis: ${((((orbitalElements.periapsisAU + orbitalElements.apoapsisAU) / 2) * 1.496e11) / 1e9).toFixed(2)} million km`,
// );
// console.log(`  Mean anomaly: ${orbitalElements.meanAnomalyDeg}°`);

// console.log("=== Exemple 1: Prefetch automatique ===\n");

// const params1: OrbitCalculationParams = {
//   objectId: planetData.uuid,
//   objectType: "planet",
//   startTimeS: 0,
//   durationS: 60, // Demande 60 secondes
//   timestepS: 0.01666667, // 60 Hz
//   orbitalElements,
// };

// // Premier appel: calculera 600s (10x) automatiquement
// console.log("📞 Première demande: 60 secondes");
// const samples1 = keplerOrbitService.getPositions(params1);
// console.log(`✅ Reçu: ${samples1.length} échantillons\n`);

// // console.log(samples1);

// console.log("\n📊 Position Analysis:");
// samples1.slice(0, 10).forEach((sample, i) => {
//   const dist = Math.sqrt(
//     sample.position.x ** 2 + sample.position.y ** 2 + sample.position.z ** 2,
//   );
//   console.log(
//     `  T=${sample.timeS.toFixed(3)}s: ${(dist / 1e9).toFixed(6)} million km`,
//   );
// });

// const params2: OrbitCalculationParams = {
//   objectId: planetData.uuid,
//   objectType: "planet",
//   startTimeS: 60,
//   durationS: 60, // Demande 60 secondes
//   timestepS: 0.01666667, // 60 Hz
//   orbitalElements,
// };
// const samples2 = keplerOrbitService.getPositions(params2);

// console.log("\n📊 Position Analysis:");
// samples2.slice(0, 10).forEach((sample, i) => {
//   const dist = Math.sqrt(
//     sample.position.x ** 2 + sample.position.y ** 2 + sample.position.z ** 2,
//   );
//   console.log(
//     `  T=${sample.timeS.toFixed(3)}s: ${(dist / 1e9).toFixed(6)} million km`,
//   );
// });

// const params3: OrbitCalculationParams = {
//   objectId: planetData.uuid,
//   objectType: "planet",
//   startTimeS: 580,
//   durationS: 60, // Demande 60 secondes
//   timestepS: 0.01666667, // 60 Hz
//   orbitalElements,
// };
// const samples3 = keplerOrbitService.getPositions(params3);

// console.log("\n📊 Position Analysis:");
// samples3.slice(0, 10).forEach((sample, i) => {
//   const dist = Math.sqrt(
//     sample.position.x ** 2 + sample.position.y ** 2 + sample.position.z ** 2,
//   );
//   console.log(
//     `  T=${sample.timeS.toFixed(3)}s: ${(dist / 1e9).toFixed(6)} million km`,
//   );
// });

// // Vérifier les limites de l'orbite
// const info = OrbitDataHelper.getOrbitalInfo(orbitalElements);
// const minDistance = info.semiMajorAxisKm * (1 - info.eccentricity) * 1000; // en mètres
// const maxDistance = info.semiMajorAxisKm * (1 + info.eccentricity) * 1000; // en mètres

// console.log("\n🎯 Orbital Boundaries:");
// console.log(
//   `  Min distance (periapsis): ${(minDistance / 1e9).toFixed(4)} million km`,
// );
// console.log(
//   `  Max distance (apoapsis):  ${(maxDistance / 1e9).toFixed(4)} million km`,
// );

// // Vérifier que toutes les positions sont dans ces limites
// const allValid = samples1.every((sample) => {
//   const dist = Math.sqrt(
//     sample.position.x ** 2 + sample.position.y ** 2 + sample.position.z ** 2,
//   );
//   return dist >= minDistance * 0.99 && dist <= maxDistance * 1.01;
// });

// console.log(
//   `\n✅ All positions within orbital bounds: ${allValid ? "YES" : "NO"}`,
// );

// // Analyser les éléments orbitaux
// // const info = OrbitDataHelper.getOrbitalInfo(orbitalElements);

// console.log("📊 Orbital Analysis:");
// console.log(`  Semi-major axis: ${info.semiMajorAxisAU.toFixed(4)} AU`);
// console.log(`  Semi-major axis: ${info.semiMajorAxisKm.toFixed(0)} km`);
// console.log(`  Eccentricity: ${info.eccentricity.toFixed(4)}`);
// console.log(`  Orbital period: ${info.periodDays.toFixed(2)} days`);
// console.log(`  Orbital period: ${info.periodYears.toFixed(4)} years`);

// // Validation
// const validation = OrbitDataHelper.validateOrbitalElements(orbitalElements);
// console.log("\n✅ Validation:", validation.valid ? "OK" : "ERRORS");
// if (validation.warnings.length > 0) {
//   console.log("⚠️  Warnings:");
//   validation.warnings.forEach((w) => console.log(`  - ${w}`));
// }

// // Position initiale attendue
// const expectedDistance = info.semiMajorAxisKm * 1000; // en mètres
// console.log(
//   `\n📍 Expected initial distance: ${(expectedDistance / 1e9).toFixed(2)} million km`,
// );

// // Position Python
// const pythonPos = {
//   x: -1.490099765857017e11,
//   y: 1.7556926374876687e8,
//   z: 1.3248357307084667e10,
// };
// const pythonDistance = Math.sqrt(
//   pythonPos.x ** 2 + pythonPos.y ** 2 + pythonPos.z ** 2,
// );
// console.log(
//   `📍 Python position distance: ${(pythonDistance / 1e9).toFixed(2)} million km`,
// );

// console.log(
//   `\n❌ INCONSISTENCY: ${((pythonDistance - expectedDistance) / 1e9).toFixed(2)} million km difference!`,
// );

// ===== TEST 1: Position à T=0 =====
// console.log(`\n${"=".repeat(60)}`);
// console.log("TEST 1: startTimeS = 0");
// console.log("=".repeat(60));

// const params4: OrbitCalculationParams = {
//   objectId: planetData.uuid,
//   objectType: "planet",
//   startTimeS: 0, // ⬅️ Départ à T=0
//   durationS: 0.1,
//   timestepS: 0.01666667,
//   orbitalElements,
// };

// const samples4 = keplerOrbitService.getPositions(params4);
// console.log(`\n📍 Position at T=0.000s:`);
// const pos1 = samples4[0].position;
// const dist1 = Math.sqrt(pos1.x ** 2 + pos1.y ** 2 + pos1.z ** 2);
// console.log(`  Distance: ${(dist1 / 1e9).toFixed(6)} million km`);
// console.log(
//   `  Coords: (${(pos1.x / 1e9).toFixed(4)}, ${(pos1.y / 1e9).toFixed(4)}, ${(pos1.z / 1e9).toFixed(4)})`,
// );

// // ===== TEST 2: Position à T=172800 (2 jours) =====
// console.log(`\n${"=".repeat(60)}`);
// console.log("TEST 2: startTimeS = 172800 (2 days)");
// console.log("=".repeat(60));

// const params2: OrbitCalculationParams = {
//   objectId: planetData.uuid,
//   objectType: "planet",
//   startTimeS: 172800, // ⬅️ Départ après 2 jours
//   durationS: 0.1,
//   timestepS: 0.01666667,
//   orbitalElements,
// };

// const samples2 = keplerOrbitService.getPositions(params2);
// console.log(`\n📍 Position at T=172800.000s:`);
// const pos2 = samples2[0].position;
// const dist2 = Math.sqrt(pos2.x ** 2 + pos2.y ** 2 + pos2.z ** 2);
// console.log(`  Distance: ${(dist2 / 1e9).toFixed(6)} million km`);
// console.log(
//   `  Coords: (${(pos2.x / 1e9).toFixed(4)}, ${(pos2.y / 1e9).toFixed(4)}, ${(pos2.z / 1e9).toFixed(4)})`,
// );

// // ===== TEST 3: Position à T = période orbitale / 2 =====
// const halfPeriod = info.periodSeconds / 2;
// console.log(`\n${"=".repeat(60)}`);
// console.log(`TEST 3: startTimeS = ${halfPeriod.toFixed(0)} (half period)`);
// console.log("=".repeat(60));

// const params3: OrbitCalculationParams = {
//   objectId: planetData.uuid,
//   objectType: "planet",
//   startTimeS: halfPeriod, // ⬅️ Mi-orbite
//   durationS: 0.1,
//   timestepS: 0.01666667,
//   orbitalElements,
// };

// const samples3 = keplerOrbitService.getPositions(params3);
// console.log(`\n📍 Position at T=${halfPeriod.toFixed(0)}s (opposite side):`);
// const pos3 = samples3[0].position;
// const dist3 = Math.sqrt(pos3.x ** 2 + pos3.y ** 2 + pos3.z ** 2);
// console.log(`  Distance: ${(dist3 / 1e9).toFixed(6)} million km`);
// console.log(
//   `  Coords: (${(pos3.x / 1e9).toFixed(4)}, ${(pos3.y / 1e9).toFixed(4)}, ${(pos3.z / 1e9).toFixed(4)})`,
// );

// // ===== COMPARAISON =====
// console.log(`\n${"=".repeat(60)}`);
// console.log("📊 COMPARISON");
// console.log("=".repeat(60));

// OrbitDataHelper.comparePositions(pos1, pos2, "T=0", "T=2 days");
// OrbitDataHelper.comparePositions(pos1, pos3, "T=0", "T=half period");

// // Vérifier que les positions sont différentes
// const diff12 = Math.sqrt(
//   (pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2,
// );

// console.log(
//   `\n✅ Positions are different: ${diff12 > 1e6 ? "YES (> 1000 km)" : "NO (BUG!)"}`,
// );
// console.log(`   Difference: ${(diff12 / 1e6).toFixed(2)} thousand km`);

// console.log(`\n${"=".repeat(60)}`);
// console.log("🎉 FINAL VALIDATION");
// console.log("=".repeat(60));

// // Test sur une période complète
// const fullPeriod = info.periodSeconds;
// console.log(
//   `\n⏱️  Full orbital period: ${fullPeriod.toFixed(0)}s (${info.periodDays.toFixed(2)} days)`,
// );

// const testTimes = [
//   0, // Start
//   fullPeriod * 0.25, // Quarter
//   fullPeriod * 0.5, // Half
//   fullPeriod * 0.75, // Three quarters
//   fullPeriod, // Full period (should return to start!)
// ];

// const positions: { time: number; pos: Vector3; dist: number }[] = [];

// testTimes.forEach((timeS) => {
//   const params: OrbitCalculationParams = {
//     objectId: planetData.uuid,
//     objectType: "planet",
//     startTimeS: timeS,
//     durationS: 60,
//     timestepS: 0.01666667,
//     orbitalElements,
//   };

//   const samples = keplerOrbitService.getPositions(params);
//   const pos = samples[0].position;
//   const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);

//   positions.push({ time: timeS, pos, dist });

//   console.log(
//     `\nT=${(timeS / 86400).toFixed(2)} days (${((timeS / fullPeriod) * 360).toFixed(0)}°):`,
//   );
//   console.log(`  Distance: ${(dist / 1e9).toFixed(4)} million km`);
//   console.log(
//     `  Position: (${(pos.x / 1e9).toFixed(2)}, ${(pos.y / 1e9).toFixed(2)}, ${(pos.z / 1e9).toFixed(2)})`,
//   );
// });

// // Vérifier que position(T=0) ≈ position(T=full_period)
// const pos0 = positions[0].pos;
// const posFull = positions[4].pos;
// const diffFull = Math.sqrt(
//   (pos0.x - posFull.x) ** 2 +
//     (pos0.y - posFull.y) ** 2 +
//     (pos0.z - posFull.z) ** 2,
// );

// console.log(`\n${"=".repeat(60)}`);
// console.log("🔄 PERIODICITY CHECK");
// console.log("=".repeat(60));
// console.log(
//   `Position at T=0:           (${(pos0.x / 1e9).toFixed(4)}, ${(pos0.y / 1e9).toFixed(4)}, ${(pos0.z / 1e9).toFixed(4)})`,
// );
// console.log(
//   `Position at T=full_period: (${(posFull.x / 1e9).toFixed(4)}, ${(posFull.y / 1e9).toFixed(4)}, ${(posFull.z / 1e9).toFixed(4)})`,
// );
// console.log(`Difference: ${(diffFull / 1e6).toFixed(2)} thousand km`);
// console.log(`Periodic: ${diffFull < 1e6 ? "✅ YES (< 1000 km)" : "❌ NO"}`);

// // Vérifier les distances min/max
// const distances = positions.map((p) => p.dist);
// const minDist = Math.min(...distances);
// const maxDist = Math.max(...distances);

// console.log(`\n${"=".repeat(60)}`);
// console.log("📏 DISTANCE RANGE");
// console.log("=".repeat(60));
// console.log(`Min distance observed: ${(minDist / 1e9).toFixed(4)} million km`);
// console.log(`Max distance observed: ${(maxDist / 1e9).toFixed(4)} million km`);
// console.log(
//   `Expected periapsis:    ${((info.semiMajorAxisKm * (1 - info.eccentricity)) / 1e6).toFixed(4)} million km`,
// );
// console.log(
//   `Expected apoapsis:     ${((info.semiMajorAxisKm * (1 + info.eccentricity)) / 1e6).toFixed(4)} million km`,
// );

// const periError = Math.abs(
//   minDist / 1e9 - (info.semiMajorAxisKm * (1 - info.eccentricity)) / 1e6,
// );
// const apoError = Math.abs(
//   maxDist / 1e9 - (info.semiMajorAxisKm * (1 + info.eccentricity)) / 1e6,
// );

// console.log(
//   `\nPeriapsis error: ${periError.toFixed(4)} million km ${periError < 0.1 ? "✅" : "⚠️"}`,
// );
// console.log(
//   `Apoapsis error:  ${apoError.toFixed(4)} million km ${apoError < 0.1 ? "✅" : "⚠️"}`,
// );

// console.log(`\n${"=".repeat(60)}`);
// console.log("✅ ALL TESTS PASSED - ORBIT CALCULATION IS CORRECT!");
// console.log("=".repeat(60));

console.log("=".repeat(60));
console.log("🔍 CACHE DEBUG TEST");
console.log("=".repeat(60));

const info = OrbitDataHelper.getOrbitalInfo(orbitalElements);

// Vérifier la période orbitale
console.log(`\n⏱️  Orbital info:`);
console.log(
  `  Period: ${info.periodSeconds.toFixed(0)}s (${info.periodDays.toFixed(2)} days)`,
);
console.log(`  Semi-major axis: ${info.semiMajorAxisKm.toFixed(0)} km`);

console.log(`\n${"=".repeat(60)}`);
console.log("📞 TEST 1: Small request");
console.log("=".repeat(60));

const params1: OrbitCalculationParams = {
  objectId: planetData.uuid,
  objectType: "planet",
  startTimeS: 0,
  durationS: 100, // 100 secondes
  timestepS: 0.01666667,
  orbitalElements,
};

console.log(`\n📊 Request:`);
console.log(`  startTimeS: ${params1.startTimeS}`);
console.log(`  durationS: ${params1.durationS}s`);
console.log(`  timestepS: ${params1.timestepS}s`);
console.log(
  `  Expected samples: ${Math.ceil(params1.durationS / params1.timestepS)}`,
);

try {
  const samples1 = keplerOrbitService.getPositions(params1);
  console.log(`\n✅ SUCCESS: Received ${samples1.length} samples`);

  if (samples1.length > 0) {
    console.log(`   First sample: T=${samples1[0].timeS}s`);
    console.log(`   Last sample:  T=${samples1[samples1.length - 1].timeS}s`);
    console.log(
      `   Position at T=0: (${(samples1[0].position.x / 1e9).toFixed(4)}, ${(samples1[0].position.y / 1e9).toFixed(4)}, ${(samples1[0].position.z / 1e9).toFixed(4)}) million km`,
    );
  }
} catch (error) {
  console.error(`\n❌ ERROR:`, error);
}

console.log(`\n${"=".repeat(60)}`);
console.log("📞 TEST 2: Same request (should hit cache)");
console.log("=".repeat(60));

try {
  const samples2 = keplerOrbitService.getPositions(params1);
  console.log(`\n✅ SUCCESS: Received ${samples2.length} samples`);
} catch (error) {
  console.error(`\n❌ ERROR:`, error);
}

console.log(`\n${"=".repeat(60)}`);
console.log("📊 CACHE STATS");
console.log("=".repeat(60));

const stats = keplerOrbitService.getCacheStats();
console.log(`\nCache size: ${stats.size}`);
stats.entries.forEach((entry, i) => {
  console.log(`\nEntry ${i + 1}:`);
  console.log(`  Key: ${entry.key}`);
  console.log(`  Samples: ${entry.sampleCount.toLocaleString()}`);
  console.log(`  Time range: ${entry.timeRange}`);
  console.log(`  Access count: ${entry.accessCount}`);
});

const ws = new WebSocket("ws://localhost:9200");

ws.on("open", () => {
  console.log("✅ Connected to WebSocket server");

  ws.send(
    encode({
      action: "init",
    }),
  );

  ws.send(
    encode({
      action: "next-ticks",
      count: 60,
      fromTime: Math.floor(Math.random() * 86400) + 1,
      target: "5514fdf5-a411-42ea-aee5-0c2d6343accc",
    }),
  );
});

ws.on("message", (data) => {
  const decoded = decode(data as Buffer);
  console.log("🎯 Received:", decoded);
});

ws.on("close", () => console.log("🔴 Disconnected"));
ws.on("error", (err) => console.error("❌ WebSocket error:", err));
