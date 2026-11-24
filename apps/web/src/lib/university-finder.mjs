export const UNIVERSITY_FINDER_MAX_RESULTS = 8;
export const UNIVERSITY_FINDER_MAX_QUERY_LENGTH = 100;

// Minuscules, sans accents, mots séparés par une espace.
export function normalizeFinderText(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rankUniversity(university, tokens, compactQuery) {
  const acronym = normalizeFinderText(university.acronym).replace(/ /g, "");
  const words = [
    ...normalizeFinderText(university.acronym).split(" "),
    ...normalizeFinderText(university.name).split(" "),
    ...normalizeFinderText(university.locality).split(" "),
  ].filter((word) => word.length > 0);

  // Chaque mot saisi doit commencer un mot de l'université.
  const everyTokenMatches = tokens.every((token) => words.some((word) => word.startsWith(token)));
  if (!everyTokenMatches) return null;
  if (acronym === compactQuery) return 0;
  if (acronym.startsWith(tokens[0])) return 1;
  return 2;
}

export function filterUniversities(universities, query) {
  if (!Array.isArray(universities) || typeof query !== "string") return [];
  const normalized = normalizeFinderText(query.slice(0, UNIVERSITY_FINDER_MAX_QUERY_LENGTH));
  if (normalized.length === 0) return [];
  const tokens = normalized.split(" ");
  const compactQuery = tokens.join("");

  const ranked = [];
  universities.forEach((university, index) => {
    const rank = rankUniversity(university, tokens, compactQuery);
    if (rank !== null) ranked.push({ university, rank, index });
  });
  ranked.sort((left, right) => left.rank - right.rank || left.index - right.index);
  return ranked.slice(0, UNIVERSITY_FINDER_MAX_RESULTS).map((entry) => entry.university);
}
