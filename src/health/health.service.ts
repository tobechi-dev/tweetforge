import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HealthResponse } from "./interfaces/health-response.interface";
import { ServiceHealth } from "./interfaces/service-health.interface";
import { HealthState } from "./interfaces/health-status.enum";

const PROBE_TIMEOUT_MS = 5_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly config: ConfigService) {}

  async check(): Promise<HealthResponse> {
    const [github, huggingface, discord] = await Promise.all([
      this.checkGithub(),
      this.checkHuggingFace(),
      this.checkDiscord(),
    ]);

    const services = { github, huggingface, discord };
    const healthy = Object.values(services).every((s) => s.state === HealthState.OPERATIONAL);

    return {
      healthy,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.version,
      environment: this.config.get<string>("NODE_ENV") ?? "development",
      services,
    };
  }

  /* -------------------------- GitHub -------------------------- */

  private async checkGithub(): Promise<ServiceHealth> {
    const token = this.config.get<string>("GITHUB_TOKEN");
    const username = this.config.get<string>("GITHUB_USERNAME");

    if (!token || !username) {
      return this.unconfigured("GitHub API", "GITHUB_TOKEN or GITHUB_USERNAME missing");
    }

    // /user is cheap and validates the token itself
    return this.probe("GitHub API", "https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "TweetForge-HealthCheck",
      },
    });
  }

  /* ----------------------- Hugging Face ----------------------- */

  private async checkHuggingFace(): Promise<ServiceHealth> {
    const token = this.config.get<string>("HF_API_TOKEN");
    if (!token) {
      return this.unconfigured("Hugging Face", "HF_API_TOKEN missing");
    }

    // /api/whoami-v2 validates the token and is cheap
    return this.probe("Hugging Face", "https://huggingface.co/api/whoami-v2", {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /* ------------------------- Discord -------------------------- */

  private async checkDiscord(): Promise<ServiceHealth> {
    const url = this.config.get<string>("DISCORD_WEBHOOK_URL");
    if (!url) {
      return this.unconfigured("Discord webhook", "DISCORD_WEBHOOK_URL missing");
    }

    // Validate the URL shape before we probe — this is the exact bug
    // that produced the 405: a malformed webhook URL.
    if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) {
      return {
        label: "Discord webhook",
        configured: true,
        reachable: false,
        state: HealthState.ERROR,
        message: "Webhook URL shape is invalid (expected /api/webhooks/{id}/{token})",
        checkedAt: new Date().toISOString(),
      };
    }

    // GET on a webhook URL returns 200 with the webhook object.
    // (POST would actually send a message — never probe with POST.)
    return this.probe("Discord webhook", url, { method: "GET" });
  }

  /* -------------------------- helpers ------------------------- */

  private async probe(label: string, url: string, init: RequestInit = {}): Promise<ServiceHealth> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const start = Date.now();

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          label,
          configured: true,
          reachable: true,
          state: HealthState.OPERATIONAL,
          latencyMs,
          checkedAt: new Date().toISOString(),
        };
      }

      // 429 is degraded, not error
      const state = res.status === 429 ? HealthState.DEGRADED : HealthState.ERROR;

      return {
        label,
        configured: true,
        reachable: false,
        state,
        message: `HTTP ${res.status} ${res.statusText}`,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const message =
        err instanceof Error
          ? err.name === "AbortError"
            ? `Timed out after ${PROBE_TIMEOUT_MS}ms`
            : err.message
          : "Unknown probe error";

      this.logger.warn(`Health probe failed for ${label}: ${message}`);

      return {
        label,
        configured: true,
        reachable: false,
        state: HealthState.ERROR,
        message,
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private unconfigured(label: string, message: string): ServiceHealth {
    return {
      label,
      configured: false,
      reachable: false,
      state: HealthState.UNCONFIGURED,
      message,
      checkedAt: new Date().toISOString(),
    };
  }
}
