export declare const UNIVERSITY_FINDER_MAX_RESULTS: number;
export declare const UNIVERSITY_FINDER_MAX_QUERY_LENGTH: number;

export type FinderUniversity = {
  name: string;
  acronym: string;
  locality: string | null;
};

export declare function normalizeFinderText(value: unknown): string;
export declare function filterUniversities<T extends FinderUniversity>(universities: readonly T[], query: string): T[];
