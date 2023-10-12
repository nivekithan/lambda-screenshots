import {
  ActionFunctionArgs,
  MetaFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { Field } from "~/components/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { conform, useForm } from "@conform-to/react";
import { parse } from "@conform-to/zod";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { env } from "~/lib/env.server";
import {
  TakeScreenshotHanderEvent,
  TakeScreenshotHandlerPayload,
} from "take-screenshot";

export const meta: MetaFunction = () => {
  return [
    { title: "Screenshot" },
    { name: "description", content: "Generate screenshot of any function" },
  ];
};

const CreateScreenshotSchema = z.object({
  url: z.string().url(),
});

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();

  const submission = parse(formData, { schema: CreateScreenshotSchema });

  if (!submission.value || submission.intent !== "submit") {
    return json({ lastSubmission: submission }, { status: 400 });
  }

  const { url } = submission.value;

  const payload = await getScreenshotUrl(url);

  if (payload.ok) {
    return redirect(payload.screenshotUrl);
  }

  console.log(payload);
  submission.value = null;

  if (!submission.error["url"]) {
    submission.error["url"] = [];
  }

  submission.error["url"].push(payload.error);

  return json({ lastSubmission: submission }, { status: 400 });
}

export default function Index() {
  const actionData = useActionData<typeof action>();

  const [form, { url }] = useForm({
    lastSubmission: actionData?.lastSubmission,
    noValidate: true,
    onValidate({ formData }) {
      return parse(formData, { schema: CreateScreenshotSchema });
    },
  });

  return (
    <main className="grid place-items-center min-h-screen">
      <Card>
        <CardHeader>
          <CardTitle>Generate Screenshot </CardTitle>
          <CardDescription>
            Make sure the website is publicly accessible from the internet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form method="POST" {...form.props} className="flex flex-col gap-y-4">
            <Field
              name="url"
              labelProps={{ children: "Website URL:" }}
              inputProps={{ ...conform.input(url) }}
              error={url.error}
            />
            <Button type="submit">Generate Screenshot</Button>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}

async function getScreenshotUrl(url: string) {
  const client = new LambdaClient();

  const invokeCommand = new InvokeCommand({
    FunctionName: env.TAKE_SCREENSHOT_ARN,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify({ url } satisfies TakeScreenshotHanderEvent),
  });

  const response = await client.send(invokeCommand);

  if (response.FunctionError) {
    console.log({ functionError: response.FunctionError });
  }

  const responseBody = new TextDecoder().decode(response.Payload);
  const payload = JSON.parse(responseBody) as TakeScreenshotHandlerPayload;

  return payload;
}
