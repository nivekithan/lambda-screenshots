import { SSTConfig } from "sst";
import { Function, RemixSite } from "sst/constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { SiteEnv, TakeScreenshotEnv } from "./types/env";

const region = "ap-south-1";

export default {
  config(_input) {
    return {
      name: "screenshots",
      region,
    };
  },
  stacks(app) {
    app.stack(({ stack }) => {
      const layerChromium = new lambda.LayerVersion(stack, "chromiumLayers", {
        code: lambda.Code.fromAsset("layers/chromium"),
      });

      const screenshotBucket = new Bucket(stack, "screenshotBucket", {
        objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
        publicReadAccess: true,
      });

      const takeScreenshotFunction = new Function(stack, "takeScreenshot", {
        handler: "./functions/takeScreenshot/src/index.main",
        runtime: "nodejs18.x",
        description:
          "Lambda functions which takes screenshot of pictures using puppeteer",
        timeout: 2 * 60,
        layers: [layerChromium],
        url: true,

        nodejs: {
          esbuild: {
            external: ["@sparticuz/chromium"],
          },
        },

        initialPolicy: [
          new PolicyStatement({
            actions: ["s3:PutObject"],
            resources: [`${screenshotBucket.bucketArn}/*`],
          }),
        ],

        environment: {
          BUCKET_NAME: screenshotBucket.bucketName,
          BUCKET_REGION_NAME: region,
        } satisfies TakeScreenshotEnv,
      });

      const remixSite = new RemixSite(stack, "site", {
        path: "apps/ui-screenshot",
        permissions: [
          new PolicyStatement({
            actions: ["lambda:InvokeFunction"],
            resources: [takeScreenshotFunction.functionArn],
          }),
        ],
        environment: {
          TAKE_SCREENSHOT_ARN: takeScreenshotFunction.functionArn,
        } satisfies SiteEnv,
        timeout: 15,
      });

      stack.addOutputs({
        siteUrl: remixSite.url,
        takeScreenshotUrl: takeScreenshotFunction.url,
      });
    });
  },
} satisfies SSTConfig;
