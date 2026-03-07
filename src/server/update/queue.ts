import type { AppEnv, UpdateQueueMessage } from "../types";
import { createGitHubContext } from "./github";
import { processCompanyUpdate } from "./process";

export async function handleUpdateQueueBatch(
  batch: MessageBatch<UpdateQueueMessage>,
  env: AppEnv
): Promise<void> {
  const github = await createGitHubContext(env);
  const seen = new Set<string>();

  for (const message of batch.messages) {
    const dedupeKey = `${message.body.slug}:${message.body.filePath}`;
    if (seen.has(dedupeKey)) {
      console.log(`Skipping duplicate queue message for ${dedupeKey}`);
      message.ack();
      continue;
    }
    seen.add(dedupeKey);

    try {
      const result = await processCompanyUpdate(env, message.body, github);
      if (result.status === "error") {
        console.error(`Permanent update error for ${result.slug}: ${result.error}`);
      }
      message.ack();
    } catch (error) {
      console.error("Failed to process update queue message", message.body, error);
      message.retry();
    }
  }
}
