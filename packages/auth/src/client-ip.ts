import { isIP } from "node:net";

export function getCloudflareClientIp(headers: Headers): string | null {
  const clientIp = headers.get("cf-connecting-ip")?.trim() ?? "";
  if (!clientIp || isIP(clientIp) === 0) return null;
  return clientIp.toLowerCase();
}
