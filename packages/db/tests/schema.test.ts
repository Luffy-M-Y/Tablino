import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  adminInvitationAlertOutbox,
  adminInvitationAudit,
  adminInvitationCodes,
  adminTotp,
  adminTotpRecoveryCodes,
  levels,
  programs,
} from "../src/schema";

test("program status is non-null and defaults to draft", () => {
  const status = getTableConfig(programs).columns.find((column) => column.name === "status");
  assert.ok(status);
  assert.equal(status.notNull, true);
  assert.equal(status.default, "draft");
});

test("levels no longer expose the legacy order column", () => {
  assert.equal(
    getTableConfig(levels).columns.some((column) => column.name === "order"),
    false,
  );
});

test("invitation outbox stores no invitation token or URL", () => {
  const columns = getTableConfig(adminInvitationAlertOutbox).columns.map(
    (column) => column.name,
  );
  assert.ok(columns.includes("audit_id"));
  assert.ok(columns.includes("recipient_email"));
  assert.equal(columns.includes("token"), false);
  assert.equal(columns.includes("token_hash"), false);
  assert.equal(columns.includes("invitation_url"), false);
});

test("invitation audit and OTP tables contain the required fields", () => {
  const auditColumns = getTableConfig(adminInvitationAudit).columns.map(
    (column) => column.name,
  );
  const codeColumns = getTableConfig(adminInvitationCodes).columns.map(
    (column) => column.name,
  );

  assert.ok(auditColumns.includes("invited_by_user_id"));
  assert.ok(auditColumns.includes("invited_email"));
  assert.ok(auditColumns.includes("role"));
  assert.ok(auditColumns.includes("client_ip"));
  assert.ok(codeColumns.includes("code_hash"));
  assert.ok(codeColumns.includes("password_hash"));
  assert.equal(codeColumns.includes("password"), false);
});

test("admin TOTP tables keep only encrypted secrets and hashed recovery codes", () => {
  const totp = getTableConfig(adminTotp);
  const totpColumns = totp.columns.map((column) => column.name);
  assert.equal(totp.name, "admin_totp");
  assert.ok(totpColumns.includes("secret_encrypted"));
  assert.equal(totpColumns.includes("secret"), false);
  assert.equal(totp.columns.find((column) => column.name === "user_id")?.primary, true);
  assert.equal(totp.foreignKeys[0]?.onDelete, "cascade");

  const recovery = getTableConfig(adminTotpRecoveryCodes);
  const recoveryColumns = recovery.columns.map((column) => column.name);
  assert.ok(recoveryColumns.includes("code_hash"));
  assert.equal(recoveryColumns.includes("code"), false);
  assert.equal(recovery.foreignKeys[0]?.onDelete, "cascade");
  assert.deepEqual(recovery.uniqueConstraints.map((constraint) => constraint.name), ["admin_totp_recovery_codes_user_hash_uq"]);
});
