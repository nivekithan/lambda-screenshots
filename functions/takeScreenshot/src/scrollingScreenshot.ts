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
  await animate({ page, wait: 1000, distance: 500 });
  await recorder.stop();

  const videoUrl = await saveScreenshotPromise;
  return videoUrl;
}

async function animate({
  page,
  distance,
  wait: waitTime,
}: {
  page: Page;
  wait: number;
  distance: number;
}) {
  const scrollHeight = await page.evaluate(() => {
    const scrollHeight = document.body.scrollHeight;
    return scrollHeight;
  });

  const chunks = Math.ceil(scrollHeight / distance);

  for (let i = 0; i < chunks; i++) {
    await wait(waitTime);
    const newTop = (i + 1) * distance;
    await page.evaluate(
      ({ top }: { top: number }) => {
        window.scrollBy({ left: 0, top, behavior: "smooth" });
      },
      { top: newTop },
    );
  }
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
