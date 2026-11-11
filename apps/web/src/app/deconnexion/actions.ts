"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieConfig } from "@tablino/auth";
import { deleteStudentSession } from "@tablino/db";

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const config = getSessionCookieConfig("web");
  const token = cookieStore.get(config.name)?.value;
  if (token !== undefined && token !== "") {
    try {
      await deleteStudentSession(token);
    } catch {
      // Le cookie est effacé dans tous les cas.
    }
  }
  cookieStore.set(config.name, "", { ...config.options, maxAge: 0 });
  redirect("/connexion");
}
