type SessionCookieConfig = {
  name: string;
  options: {
    httpOnly: boolean;
    sameSite: "lax";
    path: string;
    secure: boolean;
    domain?: string;
  };
};

type AdminSession = {
  user?: {
    id?: string;
    role?: string;
    universityId?: string | null;
  };
} | null;

export function getAuthAdminTransferCookieExpirations(
  sessionCookieConfig: SessionCookieConfig,
  secure: boolean,
): Array<{
  name: string;
  options: SessionCookieConfig["options"] & { expires: Date; maxAge: number };
}>;

export function runAuthAdminTransfer(options: {
  host: string | null;
  centralHost: string | undefined;
  session: AdminSession;
  sessionToken: string | undefined;
  transactionCookie: string | undefined;
  secret: string | undefined;
  now: Date;
  adminRootDomain: string | undefined;
  secure: boolean;
  lookupUniversitySlug: (universityId: string) => Promise<string | null>;
  createTransferCode: (input: {
    universityId: string;
    userId: string;
  }) => Promise<string>;
  deleteSession: (sessionToken: string) => Promise<{ deleted: boolean }>;
}): Promise<{ ok: true; redirectUrl: string } | { ok: false }>;
