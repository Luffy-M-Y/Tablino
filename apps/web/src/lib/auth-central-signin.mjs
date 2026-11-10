import { verifyAuthTransaction } from "./auth-transaction.mjs";

export const AUTH_CENTRAL_SIGNIN_ACTION = "/api/auth/signin/google";
export const AUTH_CENTRAL_SIGNIN_METHOD = "post";
export const AUTH_CENTRAL_CALLBACK_URL = "/auth-central/transfer";
export const AUTH_CENTRAL_CSRF_FIELD_NAME = "csrfToken";
export const AUTH_CENTRAL_CALLBACK_URL_FIELD_NAME = "callbackUrl";
export const AUTH_CENTRAL_SIGNIN_ERROR = "Session expirée";

export function getAuthCentralSigninPage(cookieValue, { now, secret }) {
  if (!verifyAuthTransaction(cookieValue, { now, secret })) {
    return {
      kind: "expired",
      message: AUTH_CENTRAL_SIGNIN_ERROR,
    };
  }

  return {
    kind: "signin",
    action: AUTH_CENTRAL_SIGNIN_ACTION,
    method: AUTH_CENTRAL_SIGNIN_METHOD,
    callbackUrl: AUTH_CENTRAL_CALLBACK_URL,
    csrfFieldName: AUTH_CENTRAL_CSRF_FIELD_NAME,
    callbackUrlFieldName: AUTH_CENTRAL_CALLBACK_URL_FIELD_NAME,
  };
}
