export const AUTH_ADMIN_SIGNIN_ACTION: "/api/auth/signin/google";
export const AUTH_ADMIN_SIGNIN_METHOD: "post";
export const AUTH_ADMIN_CALLBACK_URL: "/auth-admin/signin";
export const AUTH_ADMIN_CSRF_FIELD_NAME: "csrfToken";
export const AUTH_ADMIN_CALLBACK_URL_FIELD_NAME: "callbackUrl";
export const AUTH_ADMIN_SIGNIN_ERROR: string;

export type AuthAdminSigninPage =
  | { kind: "expired"; message: string }
  | {
      kind: "signin";
      action: typeof AUTH_ADMIN_SIGNIN_ACTION;
      method: typeof AUTH_ADMIN_SIGNIN_METHOD;
      callbackUrl: typeof AUTH_ADMIN_CALLBACK_URL;
      csrfFieldName: typeof AUTH_ADMIN_CSRF_FIELD_NAME;
      callbackUrlFieldName: typeof AUTH_ADMIN_CALLBACK_URL_FIELD_NAME;
    };

export function getAuthAdminSigninPage(
  cookieValue: string | undefined,
  options: { now: Date; secret: string | undefined },
): AuthAdminSigninPage;
