import {
  processAdminInvitationAlertOutbox,
  processAdminRevocationAlertOutbox,
} from "@tablino/db";
import {
  sendAdminInvitationAlertEmail,
  sendAdminRevocationAlertEmail,
} from "@tablino/email";
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
      let hasError = false;
      let invitation = { processed: 0, sent: 0, retried: 0, failed: 0 };
      try {
        invitation = await processAdminInvitationAlertOutbox(
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
        if (invitation.failed > 0 || invitation.retried > 0) {
          console.error(JSON.stringify({ code: "admin_invitation_alert_delivery_failed" }));
        }
      } catch {
        hasError = true;
        console.error(JSON.stringify({ code: "admin_invitation_outbox_processing_failed" }));
      }

      let revocation = { processed: 0, sent: 0, retried: 0, failed: 0 };
      try {
        revocation = await processAdminRevocationAlertOutbox(
          (alert) => sendAdminRevocationAlertEmail(
            alert.recipientEmail,
            {
              revokerEmail: alert.revokerEmail,
              revokedEmail: alert.revokedEmail,
              role: alert.revokedRole,
              revokedAt: alert.revokedAt,
            },
          ),
        );
        if (revocation.failed > 0 || revocation.retried > 0) {
          console.error(JSON.stringify({ code: "admin_revocation_alert_delivery_failed" }));
        }
      } catch {
        hasError = true;
        console.error(JSON.stringify({ code: "admin_revocation_outbox_processing_failed" }));
      }

      if (hasError) {
        throw new Error();
      }

      return {
        ...invitation,
        revocation,
      };
    },
  });

  if (result.status === 200 && result.body !== undefined) {
    return Response.json(result.body, { status: 200 });
  }
  return emptyResponse(result.status);
}
