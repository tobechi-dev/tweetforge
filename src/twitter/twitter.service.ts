import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TweetDraft, TweetGenerationRequest } from './interfaces/tweet-draft.interface';
import { ParsedGitHubActivity } from '../github/interfaces/github-event.interface';

@Injectable()
export class TwitterService {
  private readonly logger = new Logger(TwitterService.name);
  private readonly PRIMARY_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
  private readonly FALLBACK_MODEL = 'HuggingFaceH4/zephyr-7b-beta';

  constructor(private readonly configService: ConfigService) {}

  async generateTweets(request: TweetGenerationRequest): Promise<TweetDraft[]> {
    const { activities, username } = request;

    if (activities.length === 0) {
      return this.generateTemplateBasedDrafts([], username);
    }

    try {
      return await this.generateWithAI(activities, username, this.PRIMARY_MODEL);
    } catch (error) {
      this.logger.warn(`Primary model failed, trying fallback: ${error.message}`);
      try {
        return await this.generateWithAI(activities, username, this.FALLBACK_MODEL);
      } catch (fallbackError) {
        this.logger.error('Both AI models failed, using template-based drafts');
        return this.generateTemplateBasedDrafts(activities, username);
      }
    }
  }

  private async generateWithAI(
    activities: ParsedGitHubActivity[],
    username: string,
    model: string,
  ): Promise<TweetDraft[]> {
    const apiToken = this.configService.get<string>('HF_API_TOKEN');
    const activitySummary = this.buildActivitySummary(activities);

    const prompt = this.buildPrompt(activitySummary, username);

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            return_full_text: false,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const result = await response.json();
    const generatedText = result[0]?.generated_text || '';
    return this.parseGeneratedTweets(generatedText, activities);
  }

  private buildActivitySummary(activities: ParsedGitHubActivity[]): string {
    return activities
      .map((a) => `- ${a.type}: ${a.description} (${a.repo})`)
      .join('\n');
  }

  private buildPrompt(activitySummary: string, username: string): string {
    return `<s>[INST] You are a developer writing tweets about your coding activity.

Based on these GitHub activities from @${username}:

${activitySummary}

Generate 2-3 tweet drafts that:
- Are under 280 characters each
- Have a casual, confident developer tone (not corporate)
- Include 1 actionable tip or insight when relevant
- Add 1-2 relevant hashtags (#buildinpublic #webdev #javascript #typescript #coding)
- Focus on what was accomplished

Return ONLY the tweet drafts, one per line, no numbering or bullets. [/INST]`;
  }

  private parseGeneratedTweets(
    text: string,
    activities: ParsedGitHubActivity[],
  ): TweetDraft[] {
    const lines = text
      .split('\n')
      .map((line) => this.sanitizeTweet(line))
      .filter((line) => line.length > 10);

    return lines.slice(0, 3).map((content, index) => ({
      id: `draft-${Date.now()}-${index}`,
      content,
      charCount: content.length,
      repo: activities[0]?.repo || 'unknown',
      timestamp: new Date().toISOString(),
      status: 'pending' as const,
      copyCount: 0,
    }));
  }

  private sanitizeTweet(text: string): string {
    let cleaned = text
      .replace(/^["'\-\*\d\.\s]+/, '')
      .replace(/["']$/, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .trim();

    if (cleaned.length > 280) {
      cleaned = cleaned.substring(0, 277) + '...';
    }

    return cleaned;
  }

  private generateTemplateBasedDrafts(
    activities: ParsedGitHubActivity[],
    username: string,
  ): TweetDraft[] {
    if (activities.length === 0) {
      return [
        {
          id: `draft-${Date.now()}-0`,
          content: `Just shipped some code today! 🚀 Working on improving my skills. #buildinpublic #webdev`,
          charCount: 89,
          repo: 'various',
          timestamp: new Date().toISOString(),
          status: 'pending',
          copyCount: 0,
        },
      ];
    }

    return activities.slice(0, 3).map((activity, index) => {
      const actionMap = {
        commit: 'Pushed some commits',
        pr_merge: 'Merged a pull request',
        issue_close: 'Closed an issue',
        release: 'Published a new release',
      };

      const action = actionMap[activity.type] || 'Made progress';
      const content = `${action} on ${activity.repo.split('/')[1]}! ${activity.description} #buildinpublic #webdev`;

      return {
        id: `draft-${Date.now()}-${index}`,
        content: content.substring(0, 280),
        charCount: Math.min(content.length, 280),
        repo: activity.repo,
        timestamp: new Date().toISOString(),
        status: 'pending',
        copyCount: 0,
      };
    });
  }
}
