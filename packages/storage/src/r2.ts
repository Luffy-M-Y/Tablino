import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** Durée de validité d'un lien de téléchargement signé : 5 minutes. */
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/** Lit la configuration R2. Renvoie null si une variable manque ou si l'adresse n'est pas en https. */
export function readStorageConfig(env: Record<string, string | undefined> = process.env): StorageConfig | null {
  const endpoint = env.R2_ENDPOINT?.trim() ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = env.R2_BUCKET_NAME?.trim() ?? "";
  if (!endpoint.startsWith("https://") || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

export class StorageUnavailableError extends Error {
  constructor() {
    super("Stockage indisponible.");
    this.name = "StorageUnavailableError";
  }
}

let cached: { config: StorageConfig; client: S3Client } | null = null;

function getClient(): { config: StorageConfig; client: S3Client } {
  const config = readStorageConfig();
  if (config === null) throw new StorageUnavailableError();
  if (
    cached === null
    || cached.config.endpoint !== config.endpoint
    || cached.config.accessKeyId !== config.accessKeyId
    || cached.config.secretAccessKey !== config.secretAccessKey
    || cached.config.bucket !== config.bucket
  ) {
    cached = {
      config,
      client: new S3Client({
        region: "auto",
        endpoint: config.endpoint,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      }),
    };
  }
  return cached;
}

export async function putStoredObject(input: {
  key: string;
  body: Uint8Array;
  contentType: string;
  contentDisposition: string;
}): Promise<void> {
  const { config, client } = getClient();
  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    ContentDisposition: input.contentDisposition,
    // Refuse d'écraser un objet existant (clé déjà prise).
    IfNoneMatch: "*",
  }));
}

export async function deleteStoredObject(key: string): Promise<void> {
  const { config, client } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

export async function getStoredObjectDownloadUrl(key: string): Promise<string> {
  const { config, client } = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
}
