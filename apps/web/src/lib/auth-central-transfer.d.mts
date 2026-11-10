export function buildTransferRedirectUrl(options: {
  slug: string;
  rootDomain: string;
  secure: boolean;
  code: string;
}): string | null;
