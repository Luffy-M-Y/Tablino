import assert from "node:assert/strict";
import test from "node:test";
import { getAdminSidebarPinPolicy } from "../src/lib/admin-sidebar-pinning.mjs";

test("lecteur ignore la préférence persistée et ne reçoit pas la commande d'épinglage", () => {
  assert.deepEqual(getAdminSidebarPinPolicy("super_admin_lector"), {
    loadStoredValue: false,
    showControl: false,
  });
});

test("les autres rôles gardent la préférence d'épinglage", () => {
  assert.deepEqual(getAdminSidebarPinPolicy("super_admin"), {
    loadStoredValue: true,
    showControl: true,
  });
  assert.deepEqual(getAdminSidebarPinPolicy("super_admin_editor"), {
    loadStoredValue: true,
    showControl: true,
  });
  assert.deepEqual(getAdminSidebarPinPolicy("university_admin"), {
    loadStoredValue: true,
    showControl: true,
  });
  assert.deepEqual(getAdminSidebarPinPolicy("unknown"), {
    loadStoredValue: false,
    showControl: false,
  });
});
