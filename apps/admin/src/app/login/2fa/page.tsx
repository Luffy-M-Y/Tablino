import Link from "next/link";
import { cookies, headers } from "next/headers";
import {
  buildTotpUri,
  decryptTotpSecret,
  getAdmin2faPendingCookieConfig,
  readTotpEncryptionKey,
  verifyAdmin2faPendingToken,
} from "@tablino/auth";
import { getAdminTotpState } from "@tablino/db";
import { AuthShell, authCardClass, secondaryButtonClass } from "@/components/auth-ui";
import { buildQrSvgPath, formatTotpSecretForDisplay } from "@/lib/totp-qr.mjs";
import { TwoFactorForm, type TwoFactorView } from "./two-factor-form";

export default async function AdminTwoFactorPage() {
  const raw = (await cookies()).get(getAdmin2faPendingCookieConfig().name)?.value;
  const host = (await headers()).get("host");
  let userId: string | null = null;
  try {
    userId = verifyAdmin2faPendingToken(raw, host);
  } catch {
    userId = null;
  }

  let view: TwoFactorView | null = null;
  if (userId !== null) {
    const state = await getAdminTotpState({ userId });
    if (state.ok && state.status === "enabled") {
      view = { kind: "code" };
    } else if (state.ok && state.status === "none") {
      view = { kind: "enroll-start" };
    } else if (state.ok) {
      const key = readTotpEncryptionKey();
      const secret = key === null ? null : decryptTotpSecret(state.secretEncrypted, key);
      const qr = secret === null ? null : buildQrSvgPath(buildTotpUri({ secret, accountName: state.email ?? "admin" }));
      view = secret === null || qr === null
        ? { kind: "enroll-start" }
        : { kind: "enroll", qrSize: qr.size, qrPath: qr.path, secret: formatTotpSecretForDisplay(secret) };
    }
  }

  return (
    <AuthShell title="Double authentification">
      <section className={authCardClass}>
        {view === null ? (
          <div className="space-y-4">
            <p className="text-sm text-[color:var(--color-muted-foreground)]">
              &Eacute;tape expir&eacute;e (5 minutes). Reconnectez-vous.
            </p>
            <Link href="/login" className={secondaryButtonClass}>
              Retour &agrave; la connexion
            </Link>
          </div>
        ) : (
          <TwoFactorForm view={view} />
        )}
      </section>
    </AuthShell>
  );
}
