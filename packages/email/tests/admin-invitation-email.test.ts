import assert from "node:assert/strict";
import test from "node:test";
import {
  sendAdminInvitationAlertEmail,
  sendAdminInvitationEmail,
} from "../src/index";

async function captureEmail(
  send: () => Promise<void>,
): Promise<{ subject: string; htmlContent: string; textContent: string }> {
  const previousApiKey = process.env.BREVO_API_KEY;
  const previousSender = process.env.BREVO_SENDER_EMAIL;
  const previousFetch = globalThis.fetch;
  const captured: {
    payload?: { subject: string; htmlContent: string; textContent: string };
  } = {};
  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "sender@example.test";
  globalThis.fetch = async (_input, init) => {
    captured.payload = JSON.parse(String(init?.body)) as {
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

test("invitation email includes the one-time warning in HTML and text", async () => {
  const payload = await captureEmail(() => sendAdminInvitationEmail(
    "reader@example.test",
    "https://sup-admin.example.test/admin-invitation/start?token=redacted",
    new Date("2026-11-16T12:00:00.000Z"),
    "super_admin_lector",
  ));

  assert.match(payload.htmlContent, /Ce lien ne peut être utilisé qu'une seule fois\./);
  assert.match(payload.textContent, /Ce lien ne peut être utilisé qu'une seule fois\./);
  assert.match(payload.htmlContent, /Lecteur super administrateur/);
});

test("invitation alert has no link or token and is addressed to its recipient", async () => {
  const payload = await captureEmail(() => sendAdminInvitationAlertEmail(
    "editor@example.test",
    {
      inviterEmail: "chief@example.test",
      invitedEmail: "new@example.test",
      role: "super_admin_editor",
      invitedAt: new Date("2026-11-14T12:00:00.000Z"),
    },
  ));

  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("http"), false);
  assert.equal(serialized.includes("token"), false);
  assert.match(payload.htmlContent, /Éditeur super administrateur/);
});
