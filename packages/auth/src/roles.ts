import { schema } from "@tablino/db";

export type AuthRole = (typeof schema.roleEnum.enumValues)[number];
