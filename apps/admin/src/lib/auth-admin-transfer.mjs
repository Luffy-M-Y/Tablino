import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  verifyAuthAdminTransaction,
} from "./auth-admin-transaction.mjs";
import { isAuthAdminCentralHost } from "./admin-host.mjs";
import {
  buildAdminReturnUrl,
  buildAdminTransferRedirectUrl,
} from "./admin-return-url.mjs";

function failure() {
  return { ok: false };
}

export function getAuthAdminTransferCookieExpirations(sessionCookieConfig, secure) {
  const expires = new Date(0);
  return [
    {
      name: sessionCookieConfig.name,
      options: {
        ...sessionCookieConfig.options,
        expires,
        maxAge: 0,
      },
    },
    {
      name: AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        expires,
        maxAge: 0,
      },
    },
  ];
}

export async function runAuthAdminTransfer({
  host,
  centralHost,
  session,
  sessionToken,
  transactionCookie,
  secret,
  now,
  adminRootDomain,
  secure,
  lookupUniversitySlug,
  createTransferCode,
  deleteSession,
}) {
  if (!isAuthAdminCentralHost(host, centralHost)) return failure();

  const transactionUniversityId = verifyAuthAdminTransaction(transactionCookie, {
    now,
    secret,
  });
  const user = session?.user;
  if (
    !transactionUniversityId
    || !user
    || user.role !== "university_admin"
    || !user.id
    || user.universityId !== transactionUniversityId
    || typeof sessionToken !== "string"
    || sessionToken.length === 0
    || sessionToken.length > 500
  ) {
    return failure();
  }

  let slug;
  try {
    slug = await lookupUniversitySlug(transactionUniversityId);
  } catch {
    return failure();
  }
  if (
    typeof slug !== "string"
    || buildAdminReturnUrl({ slug, adminRootDomain, secure }) === null
  ) {
    return failure();
  }

  let code;
  try {
    code = await createTransferCode({
      universityId: transactionUniversityId,
      userId: user.id,
    });
  } catch {
    return failure();
  }

  const redirectUrl = buildAdminTransferRedirectUrl({
    slug,
    adminRootDomain,
    secure,
    code,
  });
  if (redirectUrl === null) return failure();

  let deletion;
  try {
    deletion = await deleteSession(sessionToken);
  } catch {
    return failure();
  }
  if (deletion?.deleted !== true) return failure();

  return { ok: true, redirectUrl };
}
