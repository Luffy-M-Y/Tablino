export function resolvePartnershipRoute({ hasSession, role, status } = {}) {
  if (!hasSession) {
    return "signin";
  }

  if (role === "university_admin") {
    if (status === "approved") {
      return "partnership";
    }
    if (status === "pending") {
      return "pending";
    }
    if (status === "active") {
      return "home";
    }
    return "forbidden";
  }

  if (role === "super_admin") {
    return "home";
  }

  return "forbidden";
}

