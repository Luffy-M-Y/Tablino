export function buildAdminReturnUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
}): string | null;

export function buildSuperAdminReturnUrl(options: {
  adminRootDomain: string;
  secure: boolean;
}): string | null;

export function buildAdminLoginUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
}): string | null;

export function buildAdminGoogleExistingAccountUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
  token: string;
}): string | null;

export function buildSuperAdminGoogleExistingAccountUrl(options: {
  adminRootDomain: string;
  secure: boolean;
  token: string;
}): string | null;

export function buildAdminTransferRedirectUrl(options: {
  slug: string;
  adminRootDomain: string;
  secure: boolean;
  code: string;
}): string | null;

export function buildSuperAdminTransferRedirectUrl(options: {
  adminRootDomain: string;
  secure: boolean;
  code: string;
  flow?: string;
}): string | null;
