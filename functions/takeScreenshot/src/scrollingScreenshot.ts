import { Browser, Page } from "puppeteer-core";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";
import { PassThrough, Readable } from "node:stream";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import crpyto from "node:crypto";
import { env } from "./env";
import { ScreenshotS3ObjMetadata } from "internal-types";
import bezier from "bezier-easing";

export async function takeScrollingScreenshot({
  url,
  browser,
}: {
  url: string;
  browser: Browser;
}) {
  const page = await browser.newPage();

  console.log("Creating recorder");
  const recorder = new PuppeteerScreenRecorder(page as any, {
    ffmpeg_Path: env.IS_LOCAL
      ? "/home/nivekithan/.nix-profile/bin/ffmpeg"
      : "/opt/bin/ffmpeg",
  });
  console.log("Created recorder");

  await page.goto(url);

  const videoStream = new PassThrough();
  await recorder.startStream(videoStream);

  const saveScreenshotPromise = saveScrollingScreenshot(videoStream, {
    url,
  });
  await animate({
    page,
    wait: 500,
    distance: 1000,
    scrollDuration: 1500,
  });
  await recorder.stop();
  console.log("Finished recordiing");

  const videoUrl = await saveScreenshotPromise;
  return videoUrl;
}

async function animate({
  page,
  distance,
  wait: waitTime,
  querySelector,
  scrollDuration,
}: {
  page: Page;
  wait: number;
  distance: number;
  querySelector?: string;
  scrollDuration: number;
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
    const scrollStartedAt = new Date().getTime();
    const easing = bezier(0.23, 1.0, 0.32, 1.0);

    while (true) {
      const timeNow = new Date().getTime();

      if (timeNow - scrollStartedAt > scrollDuration) {
        break;
      }

      const timeRatio = (timeNow - scrollStartedAt) / scrollDuration;
      const newScrollBy = i * distance + distance * easing(timeRatio);

      await page.evaluate(
        ({
          distance,
          querySelector,
        }: {
          distance: number;
          querySelector?: string;
        }) => {
          const seletedElement = querySelector
            ? document.querySelector(querySelector)
            : null;

          const element = seletedElement ? seletedElement : window;
          element.scroll({ left: 0, top: distance });
        },
        { distance: newScrollBy, querySelector },
      );
    }
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
  console.log("Saved recording of screenshot");

  const videoUrl = generatePublicUrlOfObject(keyname);

  return videoUrl;
}

function generatePublicUrlOfObject(keyName: string) {
  const objectUrl = `https://${env.CLOUDFRONT_DISTRIBUTION}/${keyName}`;

  return objectUrl;
}
