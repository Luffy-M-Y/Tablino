import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  verifyAuthAdminTransaction,
} from "./auth-admin-transaction.mjs";

export const AUTH_ADMIN_SIGNIN_ACTION = "/api/auth/signin/google";
export const AUTH_ADMIN_SIGNIN_METHOD = "post";
export const AUTH_ADMIN_CALLBACK_URL = "/auth-admin/signin";
export const AUTH_ADMIN_CSRF_FIELD_NAME = "csrfToken";
export const AUTH_ADMIN_CALLBACK_URL_FIELD_NAME = "callbackUrl";
export const AUTH_ADMIN_SIGNIN_ERROR = "Session expirée. Recommencez la connexion.";

export function getAuthAdminSigninPage(cookieValue, { now, secret }) {
  if (!verifyAuthAdminTransaction(cookieValue, { now, secret })) {
    return { kind: "expired", message: AUTH_ADMIN_SIGNIN_ERROR };
  }

  return {
    kind: "signin",
    action: AUTH_ADMIN_SIGNIN_ACTION,
    method: AUTH_ADMIN_SIGNIN_METHOD,
    callbackUrl: AUTH_ADMIN_CALLBACK_URL,
    csrfFieldName: AUTH_ADMIN_CSRF_FIELD_NAME,
    callbackUrlFieldName: AUTH_ADMIN_CALLBACK_URL_FIELD_NAME,
  };
}
