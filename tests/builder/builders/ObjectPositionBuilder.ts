import { objectPositionSchema } from "@dbduck/schema/objectPosition.model";
import { Faker } from "@faker-js/faker";

import { BuilderBase } from "./BuilderBase";

export class ObjectPositionBuilder extends BuilderBase<
  typeof objectPositionSchema
> {
  constructor(faker: Faker) {
    super(objectPositionSchema, {
      time_s: faker.number.float({ min: 0, max: 500 }),
      type_id: faker.number.int({ min: 1, max: 50000 }),
      x: faker.number.float(),
      y: faker.number.float(),
      z: faker.number.float(),
    });
  }

  withTime(time: number): this {
    this.data.time_s = time;
    return this;
  }

  withTypeId(typeId: number): this {
    this.data.type_id = typeId;
    return this;
  }

  withX(x: number): this {
    this.data.x = x;
    return this;
  }

  withY(y: number): this {
    this.data.y = y;
    return this;
  }

  withZ(z: number): this {
    this.data.z = z;
    return this;
  }
}
