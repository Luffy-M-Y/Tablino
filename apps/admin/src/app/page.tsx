import { requireAdminAccess } from "@/lib/authorization";

export default async function AdminPage() {
  await requireAdminAccess();

  return (
    <main>
      <h1>Tablino Admin</h1>
      <p>Dashboard en construction.</p>
    </main>
  );
}
