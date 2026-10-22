import Link from "next/link";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramsSummary } from "@/lib/structure-queries";

function statusLabel(status: "draft" | "published") {
  return status === "published" ? "Publiée" : "Brouillon";
}

function statusClassName(status: "draft" | "published") {
  return status === "published"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-slate-100 text-slate-700";
}

export default async function ProgramsPage({
  params,
}: PageProps<"/structure/[universityId]/programs">) {
  const { universityId } = await params;
  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();

  const programs = await getProgramsSummary(universityId);

  return (
    <AdminPage
      title="Filières"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Filières" },
      ]}
    >
      {programs.length === 0 ? (
        <p>Aucune filière.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Link
              key={program.id}
              href={`/structure/${universityId}/programs/${program.id}`}
              className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]"
            >
              <h2 className="text-xl font-semibold">{program.name}</h2>
              <span className={statusClassName(program.status)}>{statusLabel(program.status)}</span>
              <p>{program.cyclesCount} cycles</p>
              <p>{program.subjectsCount} matières</p>
              <span>Ouvrir</span>
            </Link>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
