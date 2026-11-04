export type PartnershipRoute = "signin" | "pending" | "home" | "partnership" | "forbidden";

export type PartnershipRouteInput = {
  hasSession?: boolean;
  role?: string | null;
  status?: string | null;
};

export function resolvePartnershipRoute(input?: PartnershipRouteInput): PartnershipRoute;

