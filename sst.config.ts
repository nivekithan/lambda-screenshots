import { SSTConfig } from "sst";
import { Function, RemixSite } from "sst/constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Bucket, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { SiteEnv, TakeScreenshotEnv } from "./types/env";
import { Duration, RemovalPolicy } from "aws-cdk-lib/core";
import {
  CloudFrontWebDistribution,
  OriginAccessIdentity,
} from "aws-cdk-lib/aws-cloudfront";

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

      const originAccessIdentity = new OriginAccessIdentity(
        stack,
        "screenshot-bucket-id",
        {},
      );

      const screenshotBucket = new Bucket(stack, "screenshotBucket", {
        objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
        removalPolicy: RemovalPolicy.DESTROY,
      });

      screenshotBucket.grantRead(originAccessIdentity);

      const cloudfrontDistribution = new CloudFrontWebDistribution(
        stack,
        "screenshot-distribution",
        {
          originConfigs: [
            {
              s3OriginSource: {
                s3BucketSource: screenshotBucket,
                originAccessIdentity: originAccessIdentity,
              },
              connectionTimeout: Duration.seconds(9),

              behaviors: [
                {
                  isDefaultBehavior: true,
                },
              ],
            },
          ],
        },
      );

      const ffmpegLayer = lambda.LayerVersion.fromLayerVersionArn(
        stack,
        "ffmpeg-layer",
        "arn:aws:lambda:ap-south-1:044171910974:layer:ffmpeg:1",
      );

      const takeScreenshotFunction = new Function(stack, "takeScreenshot", {
        handler: "./functions/takeScreenshot/src/index.main",
        runtime: "nodejs18.x",
        description:
          "Lambda functions which takes screenshot of pictures using puppeteer",
        timeout: 120,
        layers: [layerChromium, ffmpegLayer],
        url: true,
        nodejs: {
          esbuild: {
            external: ["@sparticuz/chromium"],
            define: { "process.env.FLUENTFFMPEG_COV": "0" },
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
          CLOUDFRONT_DISTRIBUTION:
            cloudfrontDistribution.distributionDomainName,
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
        timeout: 59,
      });

      stack.addOutputs({
        siteUrl: remixSite.url,
        takeScreenshotUrl: takeScreenshotFunction.url,
        cloudfrontUrl: cloudfrontDistribution.distributionDomainName,
      });
    });
  },
} satisfies SSTConfig;
