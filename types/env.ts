// Envrionment variables for TakeScreenshot lambda functions
export type TakeScreenshotEnv = {
  // S3 bucket where we store generated screenshot images
  BUCKET_NAME: string;

  // AWS region in which s3 bucket is deployed;
  BUCKET_REGION_NAME: string;

  // cloudfront distribution
  CLOUDFRONT_DISTRIBUTION: string;

  IS_LOCAL?: boolean;
};

// Metadata for objects stored in Screenshot S3 bucket
export type ScreenshotS3ObjMetadata = {
  url: string;
};

// Environment variables for Site
export type SiteEnv = {
  TAKE_SCREENSHOT_ARN: string;
};
