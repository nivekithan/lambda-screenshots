import { Browser, Page } from "puppeteer-core";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import { PassThrough, Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import crpyto from "node:crypto";
import { env } from "./env";
import { ScreenshotS3ObjMetadata } from "internal-types";

export async function takeScrollingScreenshot({
  url,
  browser,
}: {
  url: string;
  browser: Browser;
}) {
  const page = await browser.newPage();

  const recorder = new PuppeteerScreenRecorder(page as any);

  await page.goto(url);

  const videoStream = new PassThrough();
  await recorder.startStream(videoStream);

  const saveScreenshotPromise = saveScrollingScreenshot(videoStream, {
    url,
  });
  await animate(page);
  await recorder.stop();

  const videoUrl = await saveScreenshotPromise;
  return videoUrl;
}

async function animate(page: Page) {
  await wait(500);
  await page.evaluate(() => {
    // @ts-expect-error
    window.scrollBy({ top: 500, left: 0, behavior: "smooth" });
  });
  await wait(500);
  await page.evaluate(() => {
    // @ts-expect-error
    window.scrollBy({ top: 1000, left: 0, behavior: "smooth" });
  });
  await wait(500);
  await page.evaluate(() => {
    // @ts-expect-error
    window.scrollBy({ top: 1500, left: 0, behavior: "smooth" });
  });
  await wait(500);
  await page.evaluate(() => {
    // @ts-expect-error
    window.scrollBy({ top: 2000, left: 0, behavior: "smooth" });
  });
  await wait(1000);
}

async function wait(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function saveScrollingScreenshot(
  readable: Readable,
  { url }: { url: string },
) {
  const s3Client = new S3Client();

  const keyname = `${crpyto.randomUUID()}.mp4`;

  const parallelUpload = new Upload({
    client: s3Client,
    params: {
      Bucket: env.BUCKET_NAME,
      Key: keyname,
      Body: readable,
      Metadata: { url } satisfies ScreenshotS3ObjMetadata,
      ContentType: "video/mp4",
    },
  });

  await parallelUpload.done();

  const videoUrl = generatePublicUrlOfObject(keyname);

  return videoUrl;
}

function generatePublicUrlOfObject(keyName: string) {
  const objectUrl = `https://${env.BUCKET_NAME}.s3.${env.BUCKET_REGION_NAME}.amazonaws.com/${keyName}`;

  return objectUrl;
}
