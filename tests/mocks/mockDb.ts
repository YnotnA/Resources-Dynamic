type TableName = string;
type AnyRow = Record<string, any>;

export const dbFixtures: Record<TableName, AnyRow[]> = {};

export const db = {
  select: () => ({
    from: (table: TableName) => {
      return dbFixtures[table] ?? [];
    },
  }),
};

// Optionnel : helpers pour les tests
export function setFixture(table: TableName, rows: AnyRow[]) {
  dbFixtures[table] = rows;
}

export function clearFixtures() {
  Object.keys(dbFixtures).forEach((key) => delete dbFixtures[key]);
}
