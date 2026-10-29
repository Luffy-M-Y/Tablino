import { hasStudentAccess } from "@/lib/authorization";
import { SearchBox } from "./SearchBox";

export async function SearchMenu() {
  const allowed = await hasStudentAccess();
  if (!allowed) return null;
  return <SearchBox />;
}
