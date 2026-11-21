import assert from "node:assert/strict";
import test from "node:test";
import { getAdminRevocationRows } from "../src/lib/admin-revocation-view.mjs";

test("getAdminRevocationRows: super_admin actor can revoke editor and lector but not another super_admin nor self", () => {
  const actor = {
    id: "actor-super-admin-id",
    role: "super_admin",
    hasPassword: true,
  };

  const admins = [
    {
      id: "actor-super-admin-id",
      email: "chef@example.com",
      role: "super_admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "other-super-admin-id",
      email: "colleague@example.com",
      role: "super_admin",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "editor-id",
      email: "editor@example.com",
      role: "super_admin_editor",
      createdAt: new Date("2026-01-03T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "lector-id",
      email: "lector@example.com",
      role: "super_admin_lector",
      createdAt: new Date("2026-01-04T00:00:00Z"),
      hasPassword: false,
    },
  ];

  const result = getAdminRevocationRows(actor, admins);

  assert.equal(result.actorHasPassword, true);
  assert.equal(result.rows.length, 4);

  // Self
  assert.deepEqual(result.rows[0], {
    id: "actor-super-admin-id",
    email: "chef@example.com",
    roleLabel: "Super administrateur",
    isSelf: true,
    canRevoke: false,
  });

  // Other super_admin
  assert.deepEqual(result.rows[1], {
    id: "other-super-admin-id",
    email: "colleague@example.com",
    roleLabel: "Super administrateur",
    isSelf: false,
    canRevoke: false,
  });

  // Editor
  assert.deepEqual(result.rows[2], {
    id: "editor-id",
    email: "editor@example.com",
    roleLabel: "Éditeur super administrateur",
    isSelf: false,
    canRevoke: true,
  });

  // Lector
  assert.deepEqual(result.rows[3], {
    id: "lector-id",
    email: "lector@example.com",
    roleLabel: "Lecteur super administrateur",
    isSelf: false,
    canRevoke: true,
  });
});

test("getAdminRevocationRows: super_admin_editor actor can revoke lector but not editor, super_admin, nor self", () => {
  const actor = {
    id: "editor-actor-id",
    role: "super_admin_editor",
    hasPassword: true,
  };

  const admins = [
    {
      id: "super-admin-id",
      email: "chef@example.com",
      role: "super_admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "editor-actor-id",
      email: "me-editor@example.com",
      role: "super_admin_editor",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "other-editor-id",
      email: "peer-editor@example.com",
      role: "super_admin_editor",
      createdAt: new Date("2026-01-03T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "lector-id",
      email: "lector@example.com",
      role: "super_admin_lector",
      createdAt: new Date("2026-01-04T00:00:00Z"),
      hasPassword: false,
    },
  ];

  const result = getAdminRevocationRows(actor, admins);

  assert.equal(result.actorHasPassword, true);

  // super_admin -> canRevoke false
  assert.equal(result.rows[0].canRevoke, false);

  // self -> isSelf true, canRevoke false
  assert.equal(result.rows[1].isSelf, true);
  assert.equal(result.rows[1].canRevoke, false);

  // peer editor -> canRevoke false
  assert.equal(result.rows[2].canRevoke, false);

  // lector -> canRevoke true
  assert.equal(result.rows[3].canRevoke, true);
});

test("getAdminRevocationRows: super_admin_lector actor cannot revoke anyone", () => {
  const actor = {
    id: "lector-actor-id",
    role: "super_admin_lector",
    hasPassword: false,
  };

  const admins = [
    {
      id: "super-admin-id",
      email: "chef@example.com",
      role: "super_admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "editor-id",
      email: "editor@example.com",
      role: "super_admin_editor",
      createdAt: new Date("2026-01-02T00:00:00Z"),
      hasPassword: true,
    },
    {
      id: "lector-actor-id",
      email: "lector@example.com",
      role: "super_admin_lector",
      createdAt: new Date("2026-01-03T00:00:00Z"),
      hasPassword: false,
    },
  ];

  const result = getAdminRevocationRows(actor, admins);

  assert.equal(result.actorHasPassword, false);
  for (const row of result.rows) {
    assert.equal(row.canRevoke, false);
  }
});

test("getAdminRevocationRows: actorHasPassword deduced from matching row when actor.hasPassword is not provided", () => {
  const actor = {
    id: "actor-id",
    role: "super_admin",
  };

  const adminsWithPassword = [
    {
      id: "actor-id",
      email: "actor@example.com",
      role: "super_admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      hasPassword: true,
    },
  ];

  const result1 = getAdminRevocationRows(actor, adminsWithPassword);
  assert.equal(result1.actorHasPassword, true);

  const adminsWithoutPassword = [
    {
      id: "actor-id",
      email: "actor@example.com",
      role: "super_admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      hasPassword: false,
    },
  ];

  const result2 = getAdminRevocationRows(actor, adminsWithoutPassword);
  assert.equal(result2.actorHasPassword, false);

  const result3 = getAdminRevocationRows(actor, []);
  assert.equal(result3.actorHasPassword, false);
});

test("getAdminRevocationRows: never exposes password or hash in output", () => {
  const actor = {
    id: "actor-id",
    role: "super_admin",
    hasPassword: true,
  };

  const admins = [
    {
      id: "actor-id",
      email: "actor@example.com",
      role: "super_admin",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      hasPassword: true,
      passwordHash: "secret-hash",
    },
  ];

  const result = getAdminRevocationRows(actor, admins);

  assert.equal(Object.prototype.hasOwnProperty.call(result, "password"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "passwordHash"), false);

  for (const row of result.rows) {
    assert.equal(Object.prototype.hasOwnProperty.call(row, "password"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, "passwordHash"), false);
    assert.deepEqual(Object.keys(row).sort(), ["canRevoke", "email", "id", "isSelf", "roleLabel"].sort());
  }
});
