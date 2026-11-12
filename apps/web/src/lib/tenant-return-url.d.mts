export function buildTenantUrl(options: {
  slug: string;
  rootDomain: string;
  secure: boolean;
  path: string;
}): string | null;

export function getTenantReturnUrl(options: {
  slug: string;
  rootDomain: string;
  secure: boolean;
}): string | null;
