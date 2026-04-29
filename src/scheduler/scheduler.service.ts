import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GithubService } from '../github/github.service';
import { TwitterService } from '../twitter/twitter.service';
import { DiscordService } from '../discord/discord.service';
import { ConfigService } from '@nestjs/config';
import { TweetDraft } from '../twitter/interfaces/tweet-draft.interface';
import { ParsedGitHubActivity } from '../github/interfaces/github-event.interface';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private stats = {
    totalDrafts: 0,
    successfulRuns: 0,
    totalRuns: 0,
    lastRun: null as string | null,
    eventsToday: 0,
  };
  private recentDrafts: TweetDraft[] = [];
  private recentActivity: ParsedGitHubActivity[] = [];

  constructor(
    private readonly githubService: GithubService,
    private readonly twitterService: TwitterService,
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailyDraftGeneration() {
    this.logger.log('Starting daily tweet draft generation...');
    await this.runPipeline();
  }

  async runPipeline(): Promise<{ success: boolean; message: string; drafts?: TweetDraft[] }> {
    try {
      this.stats.totalRuns++;
      const startTime = Date.now();

      const activities = await this.githubService.fetchRecentActivity();
      this.stats.eventsToday = activities.length;
      this.recentActivity = activities;

      this.logger.log(`Fetched ${activities.length} activities from GitHub`);

      if (activities.length === 0) {
        const message = 'No GitHub activity in the last 24 hours';
        this.logger.warn(message);
        return { success: true, message };
      }

      const username = this.configService.get<string>('GITHUB_USERNAME');
      const drafts = await this.twitterService.generateTweets({
        activities,
        username,
      });

      this.stats.totalDrafts += drafts.length;
      this.stats.successfulRuns++;
      this.stats.lastRun = new Date().toISOString();

      this.recentDrafts = [...drafts, ...this.recentDrafts].slice(0, 10);

      await this.discordService.sendDraftEmbed(drafts, activities);

      const duration = Date.now() - startTime;
      this.logger.log(`Pipeline completed in ${duration}ms. Generated ${drafts.length} drafts.`);

      return {
        success: true,
        message: `Generated ${drafts.length} tweet drafts in ${duration}ms`,
        drafts,
      };
    } catch (error) {
      this.logger.error('Pipeline failed', error);
      await this.discordService.sendErrorNotification(error, 'Daily Draft Generation');
      return {
        success: false,
        message: `Pipeline failed: ${error.message}`,
      };
    }
  }

  getStats() {
    const successRate =
      this.stats.totalRuns > 0
        ? (this.stats.successfulRuns / this.stats.totalRuns) * 100
        : 100;

    return {
      totalDrafts: this.stats.totalDrafts,
      successRate: Math.round(successRate * 100) / 100,
      lastRun: this.stats.lastRun,
      eventsToday: this.stats.eventsToday,
    };
  }

  getRecentDrafts() {
    return this.recentDrafts;
  }

  getRecentActivity() {
    return this.recentActivity;
  }

  getHealth() {
    return {
      github: true,
      huggingface: true,
      discord: true,
      status: 'operational' as const,
    };
  }
}
