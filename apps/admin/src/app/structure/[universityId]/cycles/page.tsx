import { Layers } from "lucide-react";
import AdminPage from "@/components/admin-page";
import { AdminCard, AdminEmptyState, adminFieldClass } from "@/components/admin-ui";
import { assertCurrentUniversity } from "@/lib/current-university";
import { getStructureOverview } from "@/lib/structure-queries";
import { createCycleAction, deleteCycleAction, renameCycleAction } from "../actions";
import { StructureActionForm } from "../structure-action-form";
import { DeleteControl, RenameControl } from "../structure-edit-controls";

export default async function CyclesPage({
  params,
}: PageProps<"/structure/[universityId]/cycles">) {
  const { universityId } = await params;
  await assertCurrentUniversity(universityId);
  const overview = await getStructureOverview(universityId);

  return (
    <AdminPage
      icon={Layers}
      title="Cycles"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Cycles" },
      ]}
    >
      <AdminCard aria-labelledby="cycles-catalog-heading">
        <h2 id="cycles-catalog-heading" className="text-xl font-semibold">Cycles</h2>
        {overview.cycles.length === 0 ? (
          <AdminEmptyState variant="inset" icon={Layers} title="Aucun cycle" description="Ajoutez un premier cycle avec le formulaire ci-dessous." />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {overview.cycles.map((cycle) => (
              <li key={cycle.id}>
                <AdminCard className="space-y-2">
                  <h3 className="text-xl font-semibold">{cycle.name}</h3>
                  <p>{cycle.shortCode}</p>
                  <div className="flex items-center gap-2">
                    <RenameControl
                      action={renameCycleAction}
                      universityId={universityId}
                      idField="cycleId"
                      idValue={cycle.id}
                      currentName={cycle.name}
                      maxLength={100}
                      label="Modifier le nom du cycle"
                    />
                    <DeleteControl
                      action={deleteCycleAction}
                      universityId={universityId}
                      fields={{ cycleId: cycle.id }}
                      itemName={cycle.name}
                      label="Supprimer le cycle"
                    />
                  </div>
                </AdminCard>
              </li>
            ))}
          </ul>
        )}
        <h3>Ajouter un cycle</h3>
        <StructureActionForm action={createCycleAction} buttonLabel="Ajouter un cycle">
          <input type="hidden" name="universityId" value={universityId} />
          <div>
            <label htmlFor="new-cycle-name">Nom</label>
            <input id="new-cycle-name" name="name" type="text" minLength={1} maxLength={100} required className={adminFieldClass} />
          </div>
          <div>
            <label htmlFor="new-cycle-short-code">Code court</label>
            <input id="new-cycle-short-code" name="shortCode" type="text" minLength={1} maxLength={10} pattern="[A-Za-z]{1,10}" required className={adminFieldClass} />
          </div>
        </StructureActionForm>
      </AdminCard>
    </AdminPage>
  );
}
