import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { ScanCapture } from "../upload/scan-capture";

export default async function ScanPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  return (
    <AdminPage
      title="Scanner un document"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Scanner un document" },
      ]}
    >
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <ScanCapture />
      </section>
    </AdminPage>
  );
}
