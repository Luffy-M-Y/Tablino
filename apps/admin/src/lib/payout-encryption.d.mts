export function isValidEncryptionKey(keyHex: unknown): boolean;
export function encryptPayoutNumber(plainText: string, keyHex: string | undefined): string;
export function decryptPayoutNumber(encryptedString: string, keyHex: string | undefined): string;
export function encryptPayoutNumberWithEnv(plainText: string): string;
export function decryptPayoutNumberWithEnv(encryptedString: string): string;

