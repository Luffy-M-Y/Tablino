import assert from "node:assert/strict";
import test from "node:test";
import { sendUniversityApprovalAlertEmail } from "../../email/src/index";

test("sendUniversityApprovalAlertEmail sends alert email with link when approvalsUrl is provided", async () => {
  const originalApiKey = process.env.BREVO_API_KEY;
  const originalSenderEmail = process.env.BREVO_SENDER_EMAIL;
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_SENDER_EMAIL = "noreply@tablino.com";

  let capturedBody: any = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ messageId: "msg-123" }), { status: 201 });
  }) as typeof fetch;

  try {
    await sendUniversityApprovalAlertEmail(
      "superadmin@tablino.com",
      { name: "Université Alpha", acronym: "UA" },
      "https://admin.tablino.com/approvals",
    );

    assert.ok(capturedBody);
    assert.equal(capturedBody.subject, "Nouvelle université à valider");
    assert.deepEqual(capturedBody.to, [{ email: "superadmin@tablino.com" }]);

    const htmlContent = capturedBody.htmlContent as string;
    const textContent = capturedBody.textContent as string;

    assert.ok(htmlContent.includes("Université Alpha (UA)"));
    assert.ok(htmlContent.includes('<a href="https://admin.tablino.com/approvals">Examiner et valider la demande</a>'));
    assert.ok(textContent.includes("Université Alpha (UA)"));
    assert.ok(textContent.includes("Lien d'accès : https://admin.tablino.com/approvals"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = originalApiKey;
    }
    if (originalSenderEmail === undefined) {
      delete process.env.BREVO_SENDER_EMAIL;
    } else {
      process.env.BREVO_SENDER_EMAIL = originalSenderEmail;
    }
  }
});

test("sendUniversityApprovalAlertEmail sends alert email without link when approvalsUrl is absent", async () => {
  const originalApiKey = process.env.BREVO_API_KEY;
  const originalSenderEmail = process.env.BREVO_SENDER_EMAIL;
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_SENDER_EMAIL = "noreply@tablino.com";

  let capturedBody: any = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ messageId: "msg-123" }), { status: 201 });
  }) as typeof fetch;

  try {
    await sendUniversityApprovalAlertEmail(
      "superadmin@tablino.com",
      { name: "Université Beta", acronym: null },
      null,
    );

    assert.ok(capturedBody);
    const htmlContent = capturedBody.htmlContent as string;
    const textContent = capturedBody.textContent as string;

    assert.ok(htmlContent.includes("Université Beta"));
    assert.ok(!htmlContent.includes("<a href="));
    assert.ok(htmlContent.includes("Veuillez vous connecter à la console d'administration pour examiner et valider cette demande."));
    assert.ok(!textContent.includes("Lien d'accès :"));
    assert.ok(textContent.includes("Veuillez vous connecter à la console d'administration pour examiner et valider cette demande."));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = originalApiKey;
    }
    if (originalSenderEmail === undefined) {
      delete process.env.BREVO_SENDER_EMAIL;
    } else {
      process.env.BREVO_SENDER_EMAIL = originalSenderEmail;
    }
  }
});

test("sendUniversityApprovalAlertEmail escapes special characters in approvalsUrl", async () => {
  const originalApiKey = process.env.BREVO_API_KEY;
  const originalSenderEmail = process.env.BREVO_SENDER_EMAIL;
  process.env.BREVO_API_KEY = "test-key";
  process.env.BREVO_SENDER_EMAIL = "noreply@tablino.com";

  let capturedBody: any = null;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ messageId: "msg-123" }), { status: 201 });
  }) as typeof fetch;

  try {
    await sendUniversityApprovalAlertEmail(
      "superadmin@tablino.com",
      { name: "Université Gamma" },
      "https://admin.tablino.com/approvals?param=1&foo=<script>alert('xss')</script>",
    );

    assert.ok(capturedBody);
    const htmlContent = capturedBody.htmlContent as string;

    assert.ok(htmlContent.includes("&amp;foo=&lt;script&gt;"));
    assert.ok(!htmlContent.includes("<script>"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.BREVO_API_KEY;
    } else {
      process.env.BREVO_API_KEY = originalApiKey;
    }
    if (originalSenderEmail === undefined) {
      delete process.env.BREVO_SENDER_EMAIL;
    } else {
      process.env.BREVO_SENDER_EMAIL = originalSenderEmail;
    }
  }
});
