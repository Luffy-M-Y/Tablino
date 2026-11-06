import assert from "node:assert/strict";
import test from "node:test";
import { deleteStudentSession, getStudentNameById } from "../src/session-logout";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type DeleteRecord = {
  table: unknown;
  condition?: unknown;
};

function createMemoryDatabase({
  selectedRows = [],
  deletedRows = [],
}: {
  selectedRows?: unknown[][];
  deletedRows?: Array<Array<{ id: string }>>;
} = {}) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];
  const deletes: DeleteRecord[] = [];

  const tx = {
    select: () => {
      const record: { table?: unknown; condition?: unknown } = {};
      selects.push(record);
      const query: SelectQuery = {
        from: (table) => {
          record.table = table;
          return query;
        },
        where: (condition) => {
          record.condition = condition;
          return query;
        },
        limit: async () => selectedRows.shift() ?? [],
      };
      return query;
    },
    delete: (table: unknown) => {
      const record: DeleteRecord = { table };
      deletes.push(record);
      const chain = {
        where: (condition: unknown) => {
          record.condition = condition;
          return chain;
        },
        returning: async () => deletedRows.shift() ?? [],
      };
      return chain;
    },
  };

  return {
    database: {
      select: tx.select,
      delete: tx.delete,
    } as never,
    selects,
    deletes,
  };
}

test("deleteStudentSession rejects an empty token", async () => {
  const fake = createMemoryDatabase();
  const result = await deleteStudentSession("", fake.database);
  assert.deepEqual(result, { deleted: false });
  assert.equal(fake.deletes.length, 0);
});

test("deleteStudentSession rejects an overlong token", async () => {
  const fake = createMemoryDatabase();
  const token = "a".repeat(501);
  const result = await deleteStudentSession(token, fake.database);
  assert.deepEqual(result, { deleted: false });
  assert.equal(fake.deletes.length, 0);
});

test("deleteStudentSession deletes an existing session", async () => {
  const fake = createMemoryDatabase({ deletedRows: [[{ id: "session-1" }]] });
  const result = await deleteStudentSession("token-123", fake.database);
  assert.deepEqual(result, { deleted: true });
  assert.equal(fake.deletes.length, 1);
});

test("deleteStudentSession returns false when no session matches", async () => {
  const fake = createMemoryDatabase({ deletedRows: [[]] });
  const result = await deleteStudentSession("token-456", fake.database);
  assert.deepEqual(result, { deleted: false });
  assert.equal(fake.deletes.length, 1);
});

test("getStudentNameById trims and returns a present name", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ name: "  Alice Smith  " }]] });
  const result = await getStudentNameById("user-1", fake.database);
  assert.equal(result, "Alice Smith");
  assert.equal(fake.selects.length, 1);
});

test("getStudentNameById returns null when the name is null", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ name: null }]] });
  const result = await getStudentNameById("user-2", fake.database);
  assert.equal(result, null);
});

test("getStudentNameById returns null when the name is blank after trim", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[{ name: "   " }]] });
  const result = await getStudentNameById("user-3", fake.database);
  assert.equal(result, null);
});

test("getStudentNameById returns null when no user exists", async () => {
  const fake = createMemoryDatabase({ selectedRows: [[]] });
  const result = await getStudentNameById("user-4", fake.database);
  assert.equal(result, null);
});
