import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import config from "@/config";

export const s3Client = new S3Client({
  endpoint: config.s3.endpoint || "https://s3.twcstorage.ru",
  region: config.s3.region || "ru-1",
  credentials: {
    accessKeyId: config.s3.accessKey,
    secretAccessKey: config.s3.secretKey,
  },
  forcePathStyle: true,
});

const BUCKET = config.s3.bucket;
const BASE_URL = `${config.s3.endpoint || "https://s3.twcstorage.ru"}/${BUCKET}`;

export const uploadToS3 = async (
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read" as any,
    }),
  );
  return `${BASE_URL}/${key}`;
};

export const deleteFromS3 = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
};

export const s3Url = (key: string): string => `${BASE_URL}/${key}`;
