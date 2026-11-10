export const AUTH_CENTRAL_SIGNIN_ACTION: "/api/auth/signin/google";
export const AUTH_CENTRAL_SIGNIN_METHOD: "post";
export const AUTH_CENTRAL_CALLBACK_URL: "/auth-central/transfer";
export const AUTH_CENTRAL_CSRF_FIELD_NAME: "csrfToken";
export const AUTH_CENTRAL_CALLBACK_URL_FIELD_NAME: "callbackUrl";
export const AUTH_CENTRAL_SIGNIN_ERROR: "Session expirée";

export type AuthCentralSigninPage =
  | { kind: "expired"; message: typeof AUTH_CENTRAL_SIGNIN_ERROR }
  | {
      kind: "signin";
      action: typeof AUTH_CENTRAL_SIGNIN_ACTION;
      method: typeof AUTH_CENTRAL_SIGNIN_METHOD;
      callbackUrl: typeof AUTH_CENTRAL_CALLBACK_URL;
      csrfFieldName: typeof AUTH_CENTRAL_CSRF_FIELD_NAME;
      callbackUrlFieldName: typeof AUTH_CENTRAL_CALLBACK_URL_FIELD_NAME;
    };

export function getAuthCentralSigninPage(
  cookieValue: string | undefined,
  options: { now: Date; secret: string | undefined },
): AuthCentralSigninPage;
