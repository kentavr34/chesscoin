import config from "@/config";

// Lazy-loaded to avoid OOM on startup — @aws-sdk/client-s3 is ~50MB
let _client: any = null;

async function getS3Client() {
  if (!_client) {
    const { S3Client } = await import("@aws-sdk/client-s3");
    _client = new S3Client({
      endpoint: config.s3.endpoint || "https://s3.twcstorage.ru",
      region: config.s3.region || "ru-1",
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      forcePathStyle: true,
    });
  }
  return _client;
}

const BUCKET = config.s3.bucket;
const BASE_URL = `${config.s3.endpoint || "https://s3.twcstorage.ru"}/${BUCKET}`;

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read" as any,
    }),
  );
  return `${BASE_URL}/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export const s3Url = (key: string): string => `${BASE_URL}/${key}`;
