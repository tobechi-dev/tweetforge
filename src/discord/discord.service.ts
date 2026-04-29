import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordWebhookPayload, DiscordEmbed, DiscordEmbedField } from './interfaces/discord-embed.interface';
import { TweetDraft } from '../twitter/interfaces/tweet-draft.interface';
import { ParsedGitHubActivity } from '../github/interfaces/github-event.interface';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;
  private queuedMessages: DiscordWebhookPayload[] = [];

  constructor(private readonly configService: ConfigService) {}

  async sendDraftEmbed(drafts: TweetDraft[], activities: ParsedGitHubActivity[]): Promise<void> {
    const webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new HttpException('DISCORD_WEBHOOK_URL not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const embeds: DiscordEmbed[] = [
      {
        title: `🚀 Daily Tweet Drafts — ${date}`,
        color: 0x5865f2,
        fields: this.buildDraftFields(drafts),
        footer: {
          text: `Generated from GitHub activity • ${activities[0]?.repo || 'N/A'}`,
          icon_url: 'https://github.com/favicon.ico',
        },
        timestamp: new Date().toISOString(),
      },
    ];

    if (activities.length > 0) {
      embeds.push(this.buildActivityEmbed(activities));
    }

    const payload: DiscordWebhookPayload = { embeds };
    await this.sendWithRetry(payload, webhookUrl);
  }

  private buildDraftFields(drafts: TweetDraft[]): DiscordEmbedField[] {
    return drafts.map((draft, index) => {
      const charColor = draft.charCount < 250 ? '🟢' : draft.charCount <= 280 ? '🟡' : '🔴';
      return {
        name: `Draft ${index + 1} ${charColor} (${draft.charCount}/280)`,
        value: `\`\`\`\n${draft.content}\n\`\`\`\n*Source: ${draft.repo}*`,
        inline: false,
      };
    });
  }

  private buildActivityEmbed(activities: ParsedGitHubActivity[]): DiscordEmbed {
    const activitySummary = activities
      .slice(0, 10)
      .map((a) => `• [${a.type}] ${a.description.substring(0, 100)}`)
      .join('\n');

    return {
      title: '📊 Raw GitHub Activity',
      color: 0x1da1f2,
      description: activitySummary.length > 2000
        ? activitySummary.substring(0, 1997) + '...'
        : activitySummary,
      footer: {
        text: `${activities.length} events in last 24h`,
        icon_url: 'https://github.com/favicon.ico',
      },
    };
  }

  async sendErrorNotification(error: Error, context: string): Promise<void> {
    const webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
    if (!webhookUrl) return;

    const embed: DiscordEmbed = {
      title: '❌ TweetForge Error',
      color: 0xed4245,
      fields: [
        {
          name: '📍 Context',
          value: `\`${context}\``,
          inline: true,
        },
        {
          name: '⚠️ Error',
          value: `\`\`\`${error.message.substring(0, 500)}\`\`\``,
          inline: false,
        },
      ],
      footer: {
        text: 'TweetForge Scheduler',
        icon_url: 'https://github.com/favicon.ico',
      },
      timestamp: new Date().toISOString(),
    };

    const payload: DiscordWebhookPayload = { embeds: [embed] };

    try {
      await this.sendWithRetry(payload, webhookUrl);
    } catch (sendError) {
      this.logger.error('Failed to send error notification to Discord', sendError);
      this.queueMessage(payload);
    }
  }

  private async sendWithRetry(payload: DiscordWebhookPayload, webhookUrl: string): Promise<void> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.debug(`Discord webhook attempt ${attempt}/${this.MAX_RETRIES}`);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.status === 204 || response.status === 200) {
          this.logger.log(`Discord webhook sent successfully (attempt ${attempt})`);
          return;
        }

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : this.BASE_DELAY_MS * attempt;
          this.logger.warn(`Rate limited. Retrying after ${delayMs}ms`);
          await this.delay(delayMs);
          continue;
        }

        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${errorText}`);
      } catch (error) {
        this.logger.warn(`Discord webhook attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.MAX_RETRIES) {
          const backoffMs = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await this.delay(backoffMs);
        } else {
          this.logger.error('All Discord webhook retry attempts failed');
          this.queueMessage(payload);
          throw error;
        }
      }
    }
  }

  private queueMessage(payload: DiscordWebhookPayload): void {
    this.queuedMessages.push(payload);
    this.logger.warn(`Message queued. Total queued: ${this.queuedMessages.length}`);
  }

  async flushQueue(): Promise<void> {
    if (this.queuedMessages.length === 0) return;

    this.logger.log(`Flushing ${this.queuedMessages.length} queued messages`);
    const webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
    if (!webhookUrl) return;

    const messages = [...this.queuedMessages];
    this.queuedMessages = [];

    for (const payload of messages) {
      try {
        await this.sendWithRetry(payload, webhookUrl);
      } catch (error) {
        this.logger.error('Failed to flush queued message', error);
        this.queuedMessages.push(payload);
      }
    }
  }

  getQueuedCount(): number {
    return this.queuedMessages.length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
