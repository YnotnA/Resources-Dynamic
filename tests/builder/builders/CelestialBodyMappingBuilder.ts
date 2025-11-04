import {
  CELESTIAL_BODY_TYPES,
  CelestialBodyType,
  celestialBodiesMappingSchema,
} from "@db/schema";
import { Faker } from "@faker-js/faker";

import { BuilderBase } from "./BuilderBase";

export class CelestialBodyMappingBuilder extends BuilderBase<
  typeof celestialBodiesMappingSchema
> {
  constructor(faker: Faker) {
    super(celestialBodiesMappingSchema, {
      id: faker.number.int({ min: 1, max: 50000 }),
      name: faker.word.sample(),
      systemId: faker.number.int({ min: 1, max: 50000 }),
      parentId: faker.number.int({ min: 1, max: 50000 }),
      type: faker.helpers.arrayElement(CELESTIAL_BODY_TYPES),
      uuid: faker.string.uuid(),
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
    });
  }

  withId(id: number): this {
    this.data.id = id;
    return this;
  }

  withParentId(parentId: number): this {
    this.data.parentId = parentId;
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

  withType(type: CelestialBodyType): this {
    this.data.type = type;
    return this;
  }
}
