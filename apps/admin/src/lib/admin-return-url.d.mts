export function buildAdminReturnUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
}): string | null;

export function buildAdminTransferRedirectUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
  code: string;
}): string | null;
