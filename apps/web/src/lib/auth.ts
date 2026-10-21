import { createAuthOptions } from "@tablino/auth";
import { getCurrentUniversityId } from "./university";

export const authOptions = createAuthOptions({
  surface: "web",
  getCurrentUniversityId,
});
