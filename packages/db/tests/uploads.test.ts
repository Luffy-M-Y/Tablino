import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import {
  createAssignment,
  createResource,
  inferResourceFormat,
} from "../src/uploads";

type InsertRecord = {
  table: unknown;
  values?: unknown;
};

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (mode: "update") => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

type InsertChain = {
  values: (values: unknown) => InsertChain;
  returning: () => Promise<unknown[]>;
};

function createMemoryDatabase(subjectRows: unknown[], returnedRows: unknown[]) {
  const inserts: InsertRecord[] = [];
  const selectedTables: unknown[] = [];
  const lockModes: string[] = [];

  const tx = {
    select: () => {
      const query: SelectQuery = {
        from: (table) => {
          selectedTables.push(table);
          return query;
        },
        where: () => query,
        for: (mode) => {
          lockModes.push(mode);
          return query;
        },
        limit: async () => subjectRows,
      };
      return query;
    },
    insert: (table: unknown) => {
      const insertChain: InsertChain = {
        values: (values: unknown) => {
          inserts.push({ table, values });
          return insertChain;
        },
        returning: async () => returnedRows,
      };
      return insertChain;
    },
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    inserts,
    selectedTables,
    lockModes,
  };
}

const UNIVERSITY_ID = "university-a";
const USER_ID = "user-a";
const SUBJECT_ID = "subject-a";

test("createResource inserts a draft resource after locking its subject", async () => {
  const fake = createMemoryDatabase([{ id: SUBJECT_ID }], [{ id: "resource-a" }]);

  assert.deepEqual(
    await createResource(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "  Cours de mathématiques  ",
      format: "pdf",
      fileKey: "university-a/resource-a.pdf",
      fileSizeBytes: 1024,
    }, fake.database),
    { ok: true, id: "resource-a" },
  );
  assert.deepEqual(fake.selectedTables, [schema.subjects]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.deepEqual(fake.inserts, [{
    table: schema.resources,
    values: {
      universityId: UNIVERSITY_ID,
      subjectId: SUBJECT_ID,
      uploadedBy: USER_ID,
      title: "Cours de mathématiques",
      format: "pdf",
      fileKey: "university-a/resource-a.pdf",
      fileSizeBytes: 1024,
      status: "draft",
    },
  }]);
});

test("createAssignment inserts a draft assignment", async () => {
  const fake = createMemoryDatabase([{ id: SUBJECT_ID }], [{ id: "assignment-a" }]);

  assert.deepEqual(
    await createAssignment(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "Devoir de mathématiques",
      fileKey: "university-a/assignment-a.pdf",
      fileSizeBytes: 2048,
    }, fake.database),
    { ok: true, id: "assignment-a" },
  );
  assert.deepEqual(fake.selectedTables, [schema.subjects]);
  assert.deepEqual(fake.lockModes, ["update"]);
  assert.deepEqual(fake.inserts, [{
    table: schema.assignments,
    values: {
      universityId: UNIVERSITY_ID,
      subjectId: SUBJECT_ID,
      uploadedBy: USER_ID,
      title: "Devoir de mathématiques",
      fileKey: "university-a/assignment-a.pdf",
      fileSizeBytes: 2048,
      status: "draft",
    },
  }]);
});

test("createResource publishes immediately when publish is true", async () => {
  const fake = createMemoryDatabase([{ id: SUBJECT_ID }], [{ id: "resource-a" }]);

  assert.deepEqual(
    await createResource(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "  Cours de mathématiques  ",
      format: "pdf",
      fileKey: "university-a/resource-a.pdf",
      fileSizeBytes: 1024,
      publish: true,
    }, fake.database),
    { ok: true, id: "resource-a" },
  );
  assert.equal(fake.inserts.length, 1);
  const values = fake.inserts[0].values as Record<string, unknown>;
  assert.ok(values.publishedAt instanceof Date);
  const { publishedAt, ...rest } = values;
  void publishedAt;
  assert.equal(fake.inserts[0].table, schema.resources);
  assert.deepEqual(rest, {
    universityId: UNIVERSITY_ID,
    subjectId: SUBJECT_ID,
    uploadedBy: USER_ID,
    title: "Cours de mathématiques",
    format: "pdf",
    fileKey: "university-a/resource-a.pdf",
    fileSizeBytes: 1024,
    status: "published",
  });
});

test("createAssignment publishes immediately when publish is true", async () => {
  const fake = createMemoryDatabase([{ id: SUBJECT_ID }], [{ id: "assignment-a" }]);

  assert.deepEqual(
    await createAssignment(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "Devoir de mathématiques",
      fileKey: "university-a/assignment-a.pdf",
      fileSizeBytes: 2048,
      publish: true,
    }, fake.database),
    { ok: true, id: "assignment-a" },
  );
  assert.equal(fake.inserts.length, 1);
  const values = fake.inserts[0].values as Record<string, unknown>;
  assert.ok(values.publishedAt instanceof Date);
  const { publishedAt, ...rest } = values;
  void publishedAt;
  assert.equal(fake.inserts[0].table, schema.assignments);
  assert.deepEqual(rest, {
    universityId: UNIVERSITY_ID,
    subjectId: SUBJECT_ID,
    uploadedBy: USER_ID,
    title: "Devoir de mathématiques",
    fileKey: "university-a/assignment-a.pdf",
    fileSizeBytes: 2048,
    status: "published",
  });
});

test("createAssignment rejects an empty title", async () => {
  const fake = createMemoryDatabase([{ id: SUBJECT_ID }], []);

  assert.deepEqual(
    await createAssignment(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "   ",
      fileKey: "assignment.pdf",
      fileSizeBytes: 1024,
    }, fake.database),
    { ok: false, reason: "invalid_title" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createAssignment rejects invalid file metadata", async () => {
  const invalidFiles = [
    { fileKey: " ", fileSizeBytes: 1024 },
    { fileKey: "f".repeat(501), fileSizeBytes: 1024 },
    { fileKey: "assignment.pdf", fileSizeBytes: 0 },
    { fileKey: "assignment.pdf", fileSizeBytes: 1.5 },
  ];

  for (const file of invalidFiles) {
    const fake = createMemoryDatabase([{ id: SUBJECT_ID }], []);
    assert.deepEqual(
      await createAssignment(UNIVERSITY_ID, USER_ID, {
        subjectId: SUBJECT_ID,
        title: "Devoir",
        ...file,
      }, fake.database),
      { ok: false, reason: "invalid_file" },
    );
    assert.deepEqual(fake.inserts, []);
  }
});

test("upload mutations reject a missing subject", async () => {
  const fake = createMemoryDatabase([], []);

  assert.deepEqual(
    await createResource(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "Cours",
      format: "pdf",
      fileKey: "course.pdf",
      fileSizeBytes: 1024,
    }, fake.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(
    await createAssignment(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "Devoir",
      fileKey: "assignment.pdf",
      fileSizeBytes: 1024,
    }, fake.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createResource rejects an empty title", async () => {
  const fake = createMemoryDatabase([{ id: SUBJECT_ID }], []);

  assert.deepEqual(
    await createResource(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "   ",
      format: "pdf",
      fileKey: "course.pdf",
      fileSizeBytes: 1024,
    }, fake.database),
    { ok: false, reason: "invalid_title" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createResource rejects an unsupported format", async () => {
  const fake = createMemoryDatabase([{ id: SUBJECT_ID }], []);

  assert.deepEqual(
    await createResource(UNIVERSITY_ID, USER_ID, {
      subjectId: SUBJECT_ID,
      title: "Cours",
      format: "invalid",
      fileKey: "course.pdf",
      fileSizeBytes: 1024,
    }, fake.database),
    { ok: false, reason: "invalid_format" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createResource rejects invalid file metadata", async () => {
  const invalidFiles = [
    { fileKey: " ", fileSizeBytes: 1024 },
    { fileKey: "f".repeat(501), fileSizeBytes: 1024 },
    { fileKey: "course.pdf", fileSizeBytes: 0 },
    { fileKey: "course.pdf", fileSizeBytes: 1.5 },
  ];

  for (const file of invalidFiles) {
    const fake = createMemoryDatabase([{ id: SUBJECT_ID }], []);
    assert.deepEqual(
      await createResource(UNIVERSITY_ID, USER_ID, {
        subjectId: SUBJECT_ID,
        title: "Cours",
        format: "pdf",
        ...file,
      }, fake.database),
      { ok: false, reason: "invalid_file" },
    );
    assert.deepEqual(fake.inserts, []);
  }
});

test("inferResourceFormat recognizes supported file extensions without case sensitivity", () => {
  assert.equal(inferResourceFormat("cours.PDF"), "pdf");
  assert.equal(inferResourceFormat("document.docx"), "docx");
  assert.equal(inferResourceFormat("presentation.PPTX"), "pptx");
  assert.equal(inferResourceFormat("audio.mp3"), "audio");
  assert.equal(inferResourceFormat("audio.wav"), "audio");
  assert.equal(inferResourceFormat("audio.m4a"), "audio");
  assert.equal(inferResourceFormat("video.mp4"), "video");
  assert.equal(inferResourceFormat("video.webm"), "video");
  assert.equal(inferResourceFormat("pdf"), "other");
  assert.equal(inferResourceFormat("archive.zip"), "other");
});
