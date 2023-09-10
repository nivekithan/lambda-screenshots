import { Handler } from "aws-lambda";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { takeScreenshot } from "./screenshot";
import z from "zod";
import { TakeScreenshotHandlerPayload } from "../types";
import { PuppeteerScreenRecorder } from "puppeteer-screen-recorder";

const localPathOfChromimum = "/etc/profiles/per-user/nivekithan/bin/chromium";

export const TakeScreenshotEventSchema = z.object({ url: z.string().url() });

export const main: Handler = async (
  event: unknown
): Promise<TakeScreenshotHandlerPayload> => {
  try {
    console.log(event);
    const { url } = TakeScreenshotEventSchema.parse(event);

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: process.env.IS_LOCAL
        ? localPathOfChromimum
        : await chromium.executablePath(),
      headless: chromium.headless,
    });

    const screenshotUrl = await takeScreenshot({ url }, browser);

    const pages = await browser.pages();

    for (let i = 0; i < pages.length; i++) {
      await pages[i].close();
    }

    return {
      ok: true,
      screenshotUrl,
    };
  } catch (err) {
    console.log(err);

    if (err instanceof Error) {
      return { ok: false, error: err.message };
    }

    return { ok: false, error: String(err) };
  }
};
