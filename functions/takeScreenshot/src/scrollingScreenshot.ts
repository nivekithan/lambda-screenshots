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

  const recorder = new PuppeteerScreenRecorder(page as any, { fps: 60 });

  await page.goto(url);

  const videoStream = new PassThrough();
  await recorder.startStream(videoStream);

  const saveScreenshotPromise = saveScrollingScreenshot(videoStream, {
    url,
  });
  await animate({
    page,
    wait: 400,
    distance: 500,
  });
  await recorder.stop();

  const videoUrl = await saveScreenshotPromise;
  return videoUrl;
}

async function animate({
  page,
  distance,
  wait: waitTime,
  querySelector,
}: {
  page: Page;
  wait: number;
  distance: number;
  querySelector?: string;
}) {
  const scrollHeight = await page.evaluate(
    ({ querySelector }: { querySelector?: string }) => {
      const selectedElement = querySelector
        ? document.querySelector(querySelector)
        : null;
      const element = selectedElement ? selectedElement : document.body;

      const scrollHeight = element.scrollHeight;
      return scrollHeight;
    },
    { querySelector },
  );

  console.log({ scrollHeight });

  const chunks = Math.ceil(scrollHeight / distance);

  for (let i = 0; i < chunks; i++) {
    await wait(waitTime);
    const newTop = (i + 1) * distance;
    await page.evaluate(
      ({ top, querySelector }: { top: number; querySelector?: string }) => {
        const seletedElement = querySelector
          ? document.querySelector(querySelector)
          : null;

        const element = seletedElement ? seletedElement : window;
        element.scrollBy({ left: 0, top, behavior: "smooth" });
      },
      { top: newTop, querySelector },
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
  const objectUrl = `https://${env.CLOUDFRONT_DISTRIBUTION}/${keyName}`;

  return objectUrl;
}
