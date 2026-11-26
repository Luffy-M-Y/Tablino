export function isFileId(value: unknown): value is string;
export function isServableFileKey(fileKey: unknown, universityId: string): fileKey is string;
export function fileKeyExtension(fileKey: unknown): string | null;
export function buildDownloadFileName(title: unknown, extension: unknown): string;
export function downloadProgressPercent(received: number, total: number): number | null;
