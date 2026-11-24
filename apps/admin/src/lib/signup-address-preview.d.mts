export type SignupAddressDomains = {
  studentRootDomain: string;
  adminRootDomain: string;
};

export type SignupAddressPreview =
  | { ok: true; slug: string; students: string; admin: string }
  | { ok: false };

export function buildSignupAddressPreview(
  acronym: string,
  locality: string | null | undefined,
  domains: SignupAddressDomains | null,
): SignupAddressPreview;
