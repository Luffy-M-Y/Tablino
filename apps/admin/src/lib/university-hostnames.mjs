function isDomainRoot(value) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return false;
  }

  const match = /^(?<hostname>[a-z0-9.-]+)(?::(?<port>\d{1,5}))?$/i.exec(value);
  if (!match?.groups) return false;

  const { hostname, port } = match.groups;
  if (hostname.startsWith(".") || hostname.endsWith(".") || hostname.includes("..")) {
    return false;
  }

  const labels = hostname.split(".");
  if (labels.some((label) => (
    label.length === 0
    || label.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  ))) {
    return false;
  }

  return port === undefined || (Number(port) >= 1 && Number(port) <= 65535);
}

export function buildUniversityHostnames(slug, studentRootDomain, adminRootDomain) {
  if (
    typeof slug !== "string"
    || slug.length > 57
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)
  ) {
    throw new TypeError("Slug universitaire invalide.");
  }
  if (!isDomainRoot(studentRootDomain) || !isDomainRoot(adminRootDomain)) {
    throw new TypeError("Domaine racine universitaire invalide.");
  }

  return {
    students: `${slug}.${studentRootDomain}`,
    admin: `${slug}-admin.${adminRootDomain}`,
  };
}
