"use server";

import { cookies } from "next/headers";
import { getSessionCookieConfig } from "@tablino/auth";
import { deleteStudentSession } from "@tablino/db";

export type LogoutActionResult = { redirectTo: "/connexion" };

export async function logoutAction(): Promise<LogoutActionResult> {
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
  return { redirectTo: "/connexion" };
}
