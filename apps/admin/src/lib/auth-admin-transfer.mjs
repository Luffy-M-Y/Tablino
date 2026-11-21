import {
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  parseAuthAdminTransaction,
} from "./auth-admin-transaction.mjs";
import { isAuthAdminCentralHost } from "./admin-host.mjs";
import {
  buildAdminReturnUrl,
  buildAdminTransferRedirectUrl,
  buildSuperAdminTransferRedirectUrl,
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
  createInvitationTransferCode,
  createSuperLoginTransferCode,
  deleteSession,
}) {
  if (!isAuthAdminCentralHost(host, centralHost)) return failure();

  const transaction = parseAuthAdminTransaction(transactionCookie, {
    now,
    secret,
  });
  if (!transaction) return failure();

  const user = session?.user;
  if (
    !user
    || !user.id
    || user.role === "super_admin"
    || typeof sessionToken !== "string"
    || sessionToken.length === 0
    || sessionToken.length > 500
  ) {
    return failure();
  }

  let code;
  let redirectUrl;

  if (transaction.flow === "university") {
    if (
      user.role !== "university_admin"
      || user.universityId !== transaction.universityId
    ) {
      return failure();
    }

    let slug;
    try {
      slug = await lookupUniversitySlug(transaction.universityId);
    } catch {
      return failure();
    }
    if (
      typeof slug !== "string"
      || buildAdminReturnUrl({ slug, adminRootDomain, secure }) === null
    ) {
      return failure();
    }

    try {
      code = await createTransferCode({
        universityId: transaction.universityId,
        userId: user.id,
      });
    } catch {
      return failure();
    }
    if (typeof code !== "string" || code.length === 0) return failure();

    redirectUrl = buildAdminTransferRedirectUrl({
      slug,
      adminRootDomain,
      secure,
      code,
    });
    if (redirectUrl === null) return failure();
  } else if (transaction.flow === "super_login") {
    if (
      (user.role !== "super_admin_editor" && user.role !== "super_admin_lector")
      || user.universityId !== null
    ) {
      return failure();
    }
    if (typeof createSuperLoginTransferCode !== "function") return failure();

    try {
      code = await createSuperLoginTransferCode({
        transactionId: transaction.transactionId,
        userId: user.id,
      });
    } catch {
      return failure();
    }
    if (typeof code !== "string" || code.length === 0) return failure();

    redirectUrl = buildSuperAdminTransferRedirectUrl({
      adminRootDomain,
      secure,
      code,
      flow: "super_login",
    });
    if (redirectUrl === null) return failure();
  } else if (transaction.flow === "invitation") {
    if (
      (user.role !== "super_admin_editor" && user.role !== "super_admin_lector")
      || user.universityId !== null
    ) {
      return failure();
    }
    if (typeof createInvitationTransferCode !== "function") return failure();

    try {
      code = await createInvitationTransferCode({
        invitationId: transaction.invitationId,
        transactionId: transaction.transactionId,
        userId: user.id,
      });
    } catch {
      return failure();
    }
    if (typeof code !== "string" || code.length === 0) return failure();

    redirectUrl = buildSuperAdminTransferRedirectUrl({
      adminRootDomain,
      secure,
      code,
      flow: "invitation",
    });
    if (redirectUrl === null) return failure();
  } else {
    return failure();
  }

  let deletion;
  try {
    deletion = await deleteSession(sessionToken);
  } catch {
    return failure();
  }
  if (deletion?.deleted !== true) return failure();

  return { ok: true, redirectUrl };
}
