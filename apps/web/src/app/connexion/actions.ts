"use server";

import { authenticateStudent, createStudentSession } from "@tablino/db";
import { getSessionCookieConfig } from "@tablino/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUniversityId } from "@/lib/university";

export type LoginActionState = { message: string | null };

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const result = await authenticateStudent(await getCurrentUniversityId(), {
    email: readStringField(formData, "email"),
    password: readStringField(formData, "password"),
  });
  if (!result.ok) return { message: "Email ou mot de passe incorrect." };

  const session = await createStudentSession(result.userId);
  const cookieConfig = getSessionCookieConfig("web");
  const cookieStore = await cookies();
  cookieStore.set(cookieConfig.name, session.sessionToken, {
    ...cookieConfig.options,
    expires: session.expires,
  });
  redirect("/");
}
