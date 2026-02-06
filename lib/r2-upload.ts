import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let r2Client: S3Client | null = null;

const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

const getR2Client = (): S3Client => {
  if (!r2Client) {
    const missing = R2_ENV_KEYS.filter((k) => !process.env[k]);
    if (missing.length) {
      throw new Error(
        `R2 client requires env: ${R2_ENV_KEYS.join(", ")}. Missing: ${missing.join(", ")}`,
      );
    }
    const accountId = process.env.R2_ACCOUNT_ID as string;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID as string;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY as string;
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return r2Client;
};

const toBuffer = (body: Uint8Array | Buffer | ArrayBuffer): Buffer => {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  return Buffer.from(body);
};

export const buildR2PublicUrl = (fileKey: string): string => {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("R2 public URL requires env: R2_PUBLIC_BASE_URL");
  }
  return `${baseUrl.replace(/\/$/, "")}/${fileKey}`;
};

export const uploadObjectToR2 = async (params: {
  fileKey: string;
  body: Uint8Array | Buffer | ArrayBuffer;
  contentType: string;
  contentDisposition?: string;
}): Promise<string> => {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2 upload requires env: R2_BUCKET_NAME");
  }
  const uploadCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: params.fileKey,
    Body: toBuffer(params.body),
    ContentType: params.contentType,
    ...(params.contentDisposition
      ? { ContentDisposition: params.contentDisposition }
      : {}),
  });

  await getR2Client().send(uploadCommand);
  return buildR2PublicUrl(params.fileKey);
};

export const generateR2FileKey = (params: {
  userId: string;
  fileName: string;
  prefix?: string;
}): string => {
  const fileExtension = params.fileName.split(".").pop() || "bin";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const prefix = params.prefix ?? "uploads";
  return `${prefix}/${params.userId}/${timestamp}-${random}.${fileExtension}`;
};
