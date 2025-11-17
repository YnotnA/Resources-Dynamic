import { moonSchema } from "@db/schema";
import { Faker } from "@faker-js/faker";

import { BuilderBase } from "./BuilderBase";

export class MoonBuilder extends BuilderBase<typeof moonSchema> {
  constructor(faker: Faker) {
    super(moonSchema, {
      id: faker.number.int({ min: 1, max: 50000 }),
      planetId: faker.number.int({ min: 1, max: 50000 }),
      uuid: faker.string.uuid(),
      name: faker.word.sample(),
      internalName: faker.word.sample(),
      massKg: faker.number.float(),
      periapsisAu: faker.number.float({ min: 0, max: 1 }),
      apoapsisAu: faker.number.float({ min: 0, max: 1 }),
      incDeg: faker.number.int({ min: -360, max: 360 }),
      nodeDeg: faker.number.int({ min: -360, max: 360 }),
      argPeriDeg: faker.number.int({ min: -360, max: 360 }),
      meanAnomalyDeg: faker.number.int({ min: -360, max: 360 }),
      radiusKm: faker.number.float(),
      radiusGravityInfluenceKm: faker.number.float(),
      rotationH: faker.number.int({ min: 1, max: 360 }),
      tidalLocked: faker.datatype.boolean(),
      tiltDeg: faker.number.int({ min: -360, max: 360 }),
    });
  }

  withId(id: number): this {
    this.data.id = id;
    return this;
  }

  withPlanetId(planetId: number): this {
    this.data.planetId = planetId;
    return this;
  }

  withUuid(uuid: string): this {
    this.data.uuid = uuid;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }
}
