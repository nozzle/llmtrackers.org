export interface AppEnv {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  OPENAI_API_KEY?: string;
  MANUAL_TRIGGER_TOKEN?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  VITE_SITE_URL?: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  UPDATE_QUEUE: Queue<UpdateQueueMessage>;
  ASSETS: Fetcher;
}

export interface UpdateQueueMessage {
  slug: string;
  filePath: string;
  triggeredBy: "cron" | "manual";
  requestedAt: string;
}

export interface EnqueueSummary {
  enqueued: number;
  slugs: string[];
}
