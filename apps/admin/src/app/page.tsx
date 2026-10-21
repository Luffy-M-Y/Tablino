import { requireAdminAccess } from "@/lib/authorization";
import Link from "next/link";

export default async function AdminPage() {
  await requireAdminAccess();

  return (
    <main>
      <h1>Tablino Admin</h1>
      <p>Dashboard en construction.</p>
      <nav aria-label="Administration">
        <ul>
          <li><Link href="/structure">Structure</Link></li>
        </ul>
      </nav>
    </main>
  );
}
