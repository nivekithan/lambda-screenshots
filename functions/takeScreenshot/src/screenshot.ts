import { Browser } from "puppeteer-core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "./env";
import crypto from "node:crypto";
import { ScreenshotS3ObjMetadata } from "internal-types";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";

export type ScreenshotParams = {
  url: string;
};

export async function takeScreenshot(
  { url }: ScreenshotParams,
  browser: Browser,
) {
  const newPage = await browser.newPage();

  await newPage.goto(url);

  const screenshot = await newPage.screenshot({ encoding: "binary" });

  const imageUrl = await saveScreenshot(screenshot, { url });

  return imageUrl;
}

async function saveScreenshot(image: Buffer, { url }: { url: string }) {
  const s3Client = new S3Client();

  const keyName = `${crypto.randomUUID()}.png`;

  const putObjectCommand = new PutObjectCommand({
    Bucket: env.BUCKET_NAME,
    Key: keyName,
    Body: image,
    Metadata: { url } satisfies ScreenshotS3ObjMetadata,
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
