import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordWebhookPayload, DiscordEmbed } from './interfaces/discord-embed.interface';
import { TweetDraft } from '../twitter/interfaces/tweet-draft.interface';
import { ParsedGitHubActivity } from '../github/interfaces/github-event.interface';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendDraftEmbed(drafts: TweetDraft[], activities: ParsedGitHubActivity[]): Promise<void> {
    const webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');
    const date = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const embeds: DiscordEmbed[] = [
      {
        title: `🚀 Daily Tweet Drafts — ${date}`,
        color: 0x5865f2,
        fields: drafts.map((draft, index) => ({
          name: `Draft ${index + 1} (${draft.charCount}/280 chars)`,
          value: `\`\`\`\n${draft.content}\n\`\`\`\n*Repo: ${draft.repo}*`,
          inline: false,
        })),
        footer: {
          text: `Generated from GitHub activity • ${activities[0]?.repo || 'N/A'}`,
        },
        timestamp: new Date().toISOString(),
      },
    ];

    if (activities.length > 0) {
      const activitySummary = activities
        .map((a) => `[${a.type}] ${a.description}`)
        .join('\n');

      embeds.push({
        title: '📊 Raw GitHub Activity',
        color: 0x1da1f2,
        description: `\`\`\`\n${activitySummary.substring(0, 2000)}\n\`\`\``,
        footer: { text: `${activities.length} events in last 24h` },
      });
    }

    await this.sendWithRetry({ embeds }, 3);
  }

  async sendErrorNotification(error: Error, context: string): Promise<void> {
    const embed: DiscordEmbed = {
      title: '❌ TweetForge Error',
      color: 0xed4245,
      fields: [
        { name: 'Context', value: context, inline: true },
        { name: 'Error', value: `\`${error.message.substring(0, 500)}\``, inline: false },
      ],
      footer: { text: 'TweetForge Scheduler' },
      timestamp: new Date().toISOString(),
    };

    await this.sendWithRetry({ embeds: [embed] }, 2);
  }

  private async sendWithRetry(
    payload: DiscordWebhookPayload,
    maxRetries: number,
  ): Promise<void> {
    const webhookUrl = this.configService.get<string>('DISCORD_WEBHOOK_URL');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          this.logger.log(`Discord webhook sent successfully (attempt ${attempt})`);
          return;
        }

        const errorText = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${errorText}`);
      } catch (error) {
        this.logger.warn(`Discord webhook attempt ${attempt} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          this.logger.error('All Discord webhook retry attempts failed');
          throw error;
        }
      }
    }
  }
}
