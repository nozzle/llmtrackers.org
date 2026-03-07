import type { AppEnv, EnqueueSummary, UpdateQueueMessage } from "../types";
import { createGitHubContext, listCompanyFiles } from "./github";

function createUpdateMessage(
  slug: string,
  filePath: string,
  triggeredBy: UpdateQueueMessage["triggeredBy"],
): UpdateQueueMessage {
  return {
    slug,
    filePath,
    triggeredBy,
    requestedAt: new Date().toISOString(),
  };
}

export async function enqueueAllCompanyUpdates(
  env: AppEnv,
  triggeredBy: UpdateQueueMessage["triggeredBy"],
): Promise<EnqueueSummary> {
  const github = await createGitHubContext(env);
  const companies = await listCompanyFiles(github);
  const messages = companies.map(({ name, path }) =>
    createUpdateMessage(name.replace(/\.yaml$/, ""), path, triggeredBy),
  );

  if (messages.length > 0) {
    await env.UPDATE_QUEUE.sendBatch(messages.map((body) => ({ body })));
  }

  return {
    enqueued: messages.length,
    slugs: messages.map((message) => message.slug),
  };
}

export async function enqueueSingleCompanyUpdate(
  env: AppEnv,
  slug: string,
  triggeredBy: UpdateQueueMessage["triggeredBy"],
): Promise<EnqueueSummary> {
  await env.UPDATE_QUEUE.send(
    createUpdateMessage(slug, `data/companies/${slug}.yaml`, triggeredBy),
  );

  return { enqueued: 1, slugs: [slug] };
}

export async function handleScheduledUpdate(env: AppEnv, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil(
    enqueueAllCompanyUpdates(env, "cron").then((summary) => {
      console.log(`Enqueued ${summary.enqueued} company update jobs`);
    }),
  );

  await Promise.resolve();
}
