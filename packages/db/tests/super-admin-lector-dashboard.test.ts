import assert from "node:assert/strict";
import test from "node:test";
import { projectSuperAdminLectorDashboard } from "../src/super-admin-lector-dashboard";

test("projection retourne seulement les champs autorisés", () => {
  const pendingStatus: Parameters<typeof projectSuperAdminLectorDashboard>[0]["statusRows"][number] = {
    status: "pending",
    total: 2,
  };
  const university: Parameters<typeof projectSuperAdminLectorDashboard>[0]["universities"][number] = {
    name: "Université Alpha",
    acronym: "UA",
    status: "active",
  };
  const input: Parameters<typeof projectSuperAdminLectorDashboard>[0] = {
    statusRows: [
      pendingStatus,
      { status: "approved", total: "3" },
      { status: "active", total: 4 },
    ],
    universities: [university],
    totalStudents: "17",
    totalPaid: "45000",
  };
  Object.assign(pendingStatus, { secret: "not exposed" });
  Object.assign(university, {
    id: "not exposed",
    studentsCount: 900,
    revenue: 123,
  });
  Object.assign(input, { paymentRows: [{ id: "not exposed" }] });

  const projected = projectSuperAdminLectorDashboard(input);

  assert.deepEqual(projected, {
    statusTotals: { pending: 2, approved: 3, active: 4 },
    universities: [{ name: "Université Alpha", acronym: "UA", status: "active" }],
    totalStudents: 17,
    totalPaid: 45000,
  });
});

test("projection initialise les statuts absents à zéro et normalise les valeurs invalides", () => {
  assert.deepEqual(
    projectSuperAdminLectorDashboard({
      statusRows: [],
      universities: [],
      totalStudents: null,
      totalPaid: "invalid",
    }),
    {
      statusTotals: { pending: 0, approved: 0, active: 0 },
      universities: [],
      totalStudents: 0,
      totalPaid: 0,
    },
  );
});
