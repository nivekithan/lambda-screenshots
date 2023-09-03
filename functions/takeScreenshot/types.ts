import z from "zod";
import { TakeScreenshotEventSchema } from "./src";

export type TakeScreenshotHanderEvent = z.infer<
  typeof TakeScreenshotEventSchema
>;

export type TakeScreenshotHandlerPayload =
  | {
      ok: true;
      screenshotUrl: string;
    }
  | { ok: false; error: string };
