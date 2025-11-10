import { planetSchema } from "@db/schema";
import { Faker } from "@faker-js/faker";

import { BuilderBase } from "./BuilderBase";

export class PlanetBuilder extends BuilderBase<typeof planetSchema> {
  constructor(faker: Faker) {
    super(planetSchema, {
      id: faker.number.int({ min: 1, max: 50000 }),
      uuid: faker.string.uuid(),
      systemId: faker.number.int({ min: 1, max: 50000 }),
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
    });
  }

  withId(id: number): this {
    this.data.id = id;
    return this;
  }

  withSystemId(systemId: number): this {
    this.data.systemId = systemId;
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
