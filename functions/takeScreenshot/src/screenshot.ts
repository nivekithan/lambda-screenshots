import { Browser } from "puppeteer-core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env";
import crypto from "node:crypto";
import { ScreenshotS3ObjMetadata } from "internal-types";
import { PassThrough } from "node:stream";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import { pipeline } from "node:stream/promises";

export type ScreenshotParams = {
  url: string;
};

export async function takeScreenshot(
  { url }: ScreenshotParams,
  browser: Browser
) {
  const newPage = await browser.newPage();

  const recorder = new PuppeteerScreenRecorder(newPage as any);

  await newPage.goto(url);

  const passThroughStream = new PassThrough();

  setTimeout(async () => {
    await recorder.stop();
  });

  const videoUrl = await pipeline(passThroughStream, (stream) =>
    saveScrollingScreenshot(stream, { url })
  );

  return videoUrl;
}

async function saveScrollingScreenshot(
  stream: ReadableStream,
  { url }: { url: string }
) {
  const s3Client = new S3Client();

  const keyName = `${crypto.randomUUID()}.mp4`;

  const putObjectCommand = new PutObjectCommand({
    Bucket: env.BUCKET_NAME,
    Key: keyName,
    Body: stream,
    Metadata: { url } satisfies ScreenshotS3ObjMetadata,
    ContentType: "video/mp4	",
  });

  await s3Client.send(putObjectCommand);

  const videoUrl = generatePublicUrlOfObject(keyName);

  return videoUrl;
}

export async function saveScreenshot(buffer: Buffer, { url }: { url: string }) {
  const s3Client = new S3Client();

  const keyName = `${crypto.randomUUID()}.png`;

  const putObjectCommand = new PutObjectCommand({
    Bucket: env.BUCKET_NAME,
    Key: keyName,
    Body: buffer,
    Metadata: {
      url,
    } satisfies ScreenshotS3ObjMetadata,
    ContentType: "image/png",
  });

  await s3Client.send(putObjectCommand);

  const imageUrl = generatePublicUrlOfObject(keyName);

  return imageUrl;
}

function generatePublicUrlOfObject(keyName: string) {
  const objectUrl = `https://${env.BUCKET_NAME}.s3.${env.BUCKET_REGION_NAME}.amazonaws.com/${keyName}`;

  return objectUrl;
}
