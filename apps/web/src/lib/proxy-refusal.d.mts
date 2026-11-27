export function decideProxyRefusal(input: {
  host: string | null;
  pathname: string;
  rootDomain: string | undefined;
  authCentralHost: string | undefined;
}): 404 | null;
