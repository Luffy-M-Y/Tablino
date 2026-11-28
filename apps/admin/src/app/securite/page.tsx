import { ShieldCheck } from "lucide-react";
import { buildTotpUri, decryptTotpSecret, readTotpEncryptionKey } from "@tablino/auth";
import { getAdminTotpState } from "@tablino/db";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { requireAdminPermission } from "@/lib/authorization";
import { buildQrSvgPath, formatTotpSecretForDisplay } from "@/lib/totp-qr.mjs";
import { TotpEnrollForm, type TotpEnrollView } from "./totp-enroll-form";

export default async function AdminSecurityPage() {
  const user = await requireAdminPermission("adminHome");
  const state = await getAdminTotpState({ userId: user.id });
  if (!state.ok) forbidden();

  let view: TotpEnrollView;
  if (state.status === "enabled") {
    view = { kind: "enabled" };
  } else if (state.status === "none") {
    view = { kind: "none" };
  } else {
    const key = readTotpEncryptionKey();
    const secret = key === null ? null : decryptTotpSecret(state.secretEncrypted, key);
    const qr = secret === null
      ? null
      : buildQrSvgPath(buildTotpUri({ secret, accountName: state.email ?? "admin" }));
    view = secret === null || qr === null
      ? { kind: "unreadable" }
      : { kind: "pending", qrSize: qr.size, qrPath: qr.path, secret: formatTotpSecretForDisplay(secret) };
  }

  return (
    <AdminPage
      icon={ShieldCheck}
      title="Sécurité du compte"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Sécurité du compte" },
      ]}
    >
      <TotpEnrollForm view={view} />
    </AdminPage>
  );
}
