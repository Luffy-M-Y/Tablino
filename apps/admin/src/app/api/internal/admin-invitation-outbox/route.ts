import { processAdminInvitationAlertOutbox } from "@tablino/db";
import { sendAdminInvitationAlertEmail } from "@tablino/email";
import { runAdminInvitationOutboxRoute } from "@/lib/admin-invitation-outbox-auth.mjs";

export const runtime = "nodejs";

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

async function rejectNonPostRequest(request: Request): Promise<Response> {
  const result = await runAdminInvitationOutboxRoute({
    method: request.method,
    authorization: request.headers.get("authorization"),
    configuredSecret: process.env.ADMIN_INVITATION_OUTBOX_SECRET,
    processOutbox: async () => {},
  });
  return emptyResponse(result.status);
}

export async function GET(request: Request): Promise<Response> {
  return rejectNonPostRequest(request);
}

export async function HEAD(request: Request): Promise<Response> {
  return rejectNonPostRequest(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return rejectNonPostRequest(request);
}

export async function PUT(request: Request): Promise<Response> {
  return rejectNonPostRequest(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return rejectNonPostRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return rejectNonPostRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  const result = await runAdminInvitationOutboxRoute({
    method: request.method,
    authorization: request.headers.get("authorization"),
    configuredSecret: process.env.ADMIN_INVITATION_OUTBOX_SECRET,
    processOutbox: async () => {
      const result = await processAdminInvitationAlertOutbox(
        (alert) => sendAdminInvitationAlertEmail(
          alert.recipientEmail,
          {
            inviterEmail: alert.inviterEmail,
            invitedEmail: alert.invitedEmail,
            role: alert.role,
            invitedAt: alert.invitedAt,
          },
        ),
      );
      if (result.failed > 0 || result.retried > 0) {
        console.error(JSON.stringify({ code: "admin_invitation_alert_delivery_failed" }));
      }
    },
  });
  return emptyResponse(result.status);
}
