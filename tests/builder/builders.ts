import { Faker } from "@faker-js/faker";

import { FakerGeneratorFactory } from "./FakerGeneratorFactory";
import { CelestialBodyMappingBuilder } from "./builders/CelestialBodyMappingBuilder";
import { ObjectPositionBuilder } from "./builders/ObjectPositionBuilder";
import { Vector3Builder } from "./builders/Vector3Builder";

export const aVector3 = (generator?: Faker): Vector3Builder => {
  const faker = generator ?? FakerGeneratorFactory.getInstance();

  return new Vector3Builder(faker);
};

export const aCelestialBodyMapping = (
  generator?: Faker,
): CelestialBodyMappingBuilder => {
  const faker = generator ?? FakerGeneratorFactory.getInstance();

  return new CelestialBodyMappingBuilder(faker);
};

export const aObjectPositionBuilder = (
  generator?: Faker,
): ObjectPositionBuilder => {
  const faker = generator ?? FakerGeneratorFactory.getInstance();

  return new ObjectPositionBuilder(faker);
};
