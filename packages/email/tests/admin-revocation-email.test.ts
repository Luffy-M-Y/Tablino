import assert from "node:assert/strict";
import test from "node:test";
import { sendAdminRevocationAlertEmail } from "../src/index";

async function captureEmail(
  send: () => Promise<void>,
): Promise<{ to: Array<{ email: string }>; subject: string; htmlContent: string; textContent: string }> {
  const previousApiKey = process.env.BREVO_API_KEY;
  const previousSender = process.env.BREVO_SENDER_EMAIL;
  const previousFetch = globalThis.fetch;
  const captured: {
    payload?: { to: Array<{ email: string }>; subject: string; htmlContent: string; textContent: string };
  } = {};
  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.test";
  globalThis.fetch = async (_input, init) => {
    captured.payload = JSON.parse(String(init?.body)) as {
      to: Array<{ email: string }>;
      subject: string;
      htmlContent: string;
      textContent: string;
    };
    return new Response(null, { status: 201 });
  };

  try {
    await send();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = previousApiKey;
    if (previousSender === undefined) delete process.env.BREVO_SENDER_EMAIL;
    else process.env.BREVO_SENDER_EMAIL = previousSender;
  }

  if (captured.payload === undefined) throw new Error("Email payload was not captured.");
  return captured.payload;
}

test("revocation alert is addressed to recipient and contains revoker, revoked, role and timestamp", async () => {
  const date = new Date("2026-11-21T15:30:00.000Z");
  const payload = await captureEmail(() => sendAdminRevocationAlertEmail(
    "chief@example.test",
    {
      revokerEmail: "chief@example.test",
      revokedEmail: "editor@example.test",
      role: "super_admin_editor",
      revokedAt: date,
    },
  ));

  assert.deepEqual(payload.to, [{ email: "chief@example.test" }]);
  assert.equal(payload.subject, "Révocation d'un compte d'administration Tablino");
  assert.match(payload.htmlContent, /chief@example\.test/);
  assert.match(payload.htmlContent, /editor@example\.test/);
  assert.match(payload.htmlContent, /Éditeur super administrateur/);
  assert.match(payload.textContent, /chief@example\.test/);
  assert.match(payload.textContent, /editor@example\.test/);
  assert.match(payload.textContent, /Éditeur super administrateur/);
});

test("revocation alert supports lector role label via role property", async () => {
  const date = new Date("2026-11-21T15:30:00.000Z");
  const payload = await captureEmail(() => sendAdminRevocationAlertEmail(
    "editor@example.test",
    {
      revokerEmail: "chief@example.test",
      revokedEmail: "lector@example.test",
      role: "super_admin_lector",
      revokedAt: date,
    },
  ));

  assert.match(payload.htmlContent, /Lecteur super administrateur/);
  assert.match(payload.textContent, /Lecteur super administrateur/);
});

test("revocation alert contains NO link, NO href, and NO token", async () => {
  const payload = await captureEmail(() => sendAdminRevocationAlertEmail(
    "chief@example.test",
    {
      revokerEmail: "chief@example.test",
      revokedEmail: "editor@example.test",
      role: "super_admin_editor",
      revokedAt: new Date("2026-11-21T12:00:00.000Z"),
    },
  ));

  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("http"), false);
  assert.equal(serialized.includes("<a"), false);
  assert.equal(serialized.includes("href"), false);
  assert.equal(serialized.includes("token"), false);
});

test("revocation alert escapes HTML special characters in emails", async () => {
  const payload = await captureEmail(() => sendAdminRevocationAlertEmail(
    "admin@example.test",
    {
      revokerEmail: "revoker<script>@example.test",
      revokedEmail: "target&alert@example.test",
      role: "super_admin_editor",
      revokedAt: new Date("2026-11-21T12:00:00.000Z"),
    },
  ));

  assert.match(payload.htmlContent, /revoker&lt;script&gt;@example\.test/);
  assert.match(payload.htmlContent, /target&amp;alert@example\.test/);
  assert.doesNotMatch(payload.htmlContent, /<script>/);
});

test("revocation alert throws on invalid role", async () => {
  await assert.rejects(
    () => sendAdminRevocationAlertEmail(
      "admin@example.test",
      {
        revokerEmail: "chief@example.test",
        revokedEmail: "other@example.test",
        role: "super_admin" as any,
        revokedAt: new Date(),
      },
    ),
    /Rôle de révocation invalide/,
  );
});
