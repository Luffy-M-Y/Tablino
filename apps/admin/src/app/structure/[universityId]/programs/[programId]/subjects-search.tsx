"use client";

import { useMemo, useState } from "react";
import { AdminCard, AdminSearchField } from "@/components/admin-ui";
import { normalizeSearchValue } from "@/lib/search-normalization.mjs";
import { deleteSubjectAction, renameSubjectAction } from "../../actions";
import { DeleteControl, RenameControl } from "../../structure-edit-controls";

type Subject = {
  id: string;
  name: string;
};

type Props = {
  universityId: string;
  subjects: Subject[];
};

export function SubjectsSearch({ universityId, subjects }: Props) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchValue(query);
  const matchingSubjects = useMemo(
    () => subjects.filter((subject) => normalizeSearchValue(subject.name).includes(normalizedQuery)),
    [normalizedQuery, subjects],
  );

  if (subjects.length === 0) {
    return <p>Aucune matière.</p>;
  }

  return (
    <div>
      <AdminSearchField
        id="subject-search"
        label="Rechercher une matière"
        placeholder="Rechercher une matière…"
        value={query}
        onChange={setQuery}
        resultCount={matchingSubjects.length}
      />
      {matchingSubjects.length === 0 ? (
        <p className="mt-4">Aucune matière trouvée.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {matchingSubjects.map((subject) => (
            <li key={subject.id}>
              <AdminCard className="p-4">
                {subject.name}
                <div className="mt-3 flex items-center gap-2">
                  <RenameControl
                    action={renameSubjectAction}
                    universityId={universityId}
                    idField="subjectId"
                    idValue={subject.id}
                    currentName={subject.name}
                    maxLength={255}
                    label="Modifier le nom de la matière"
                  />
                  <DeleteControl
                    action={deleteSubjectAction}
                    universityId={universityId}
                    fields={{ subjectId: subject.id }}
                    itemName={subject.name}
                    label="Supprimer la matière"
                  />
                </div>
              </AdminCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
