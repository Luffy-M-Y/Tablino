import { isAuthCentralHost } from "./auth-central-host.mjs";
import { verifyAuthTransaction } from "./auth-transaction.mjs";

export function createGoogleUniversityResolver({
  getHost,
  getAuthCentralHost,
  getCookie,
  getSecret,
  getCurrentUniversityId,
  now = () => new Date(),
}) {
  return async function resolveGoogleUniversityId() {
    if (!isAuthCentralHost(await getHost(), getAuthCentralHost())) {
      return getCurrentUniversityId();
    }

    return verifyAuthTransaction(await getCookie(), {
      now: now(),
      secret: getSecret(),
    });
  };
}
