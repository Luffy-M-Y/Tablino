export const AUTH_CENTRAL_ROUTE_HEADER: "x-tablino-auth-central-route";

export function isAuthCentralHost(
  host: string | null,
  configuredHost: string | undefined,
): boolean;

export function isAuthCentralPath(pathname: string): boolean;

export function shouldBypassTenantResolution(
  host: string | null,
  pathname: string,
  configuredHost: string | undefined,
): boolean;
