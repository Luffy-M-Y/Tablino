import { requireAdminAccess } from "@/lib/authorization";
import Link from "next/link";
import AdminPage from "@/components/admin-page";

export default async function HomePage() {
  await requireAdminAccess();

  return (
    <AdminPage title="Accueil" breadcrumbs={[{ label: "Accueil" }]}>
      <p>Dashboard en construction.</p>
      <nav aria-label="Administration">
        <ul>
          <li><Link href="/structure">Structure</Link></li>
        </ul>
      </nav>
    </AdminPage>
  );
}
