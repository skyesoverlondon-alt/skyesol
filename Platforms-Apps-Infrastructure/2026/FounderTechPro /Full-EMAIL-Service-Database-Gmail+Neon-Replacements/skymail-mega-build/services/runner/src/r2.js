import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

export function createR2Client(config) {
  return new S3Client({
    region: config.r2Region,
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  });
}

export async function uploadFile(r2, bucket, key, filePath, contentType = 'application/octet-stream') {
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: contentType,
  }));
}

export async function downloadFile(r2, bucket, key, filePath) {
  const response = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(response.Body, createWriteStream(filePath));
}
