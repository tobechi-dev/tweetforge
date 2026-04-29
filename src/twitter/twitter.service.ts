import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TweetDraft, TweetGenerationRequest } from './interfaces/tweet-draft.interface';
import { ParsedGitHubActivity } from '../github/interfaces/github-event.interface';
import { enforceCharLimit, getCharCountColor } from '../common/utils/char-limit.util';

@Injectable()
export class TwitterService {
  private readonly logger = new Logger(TwitterService.name);
  private readonly PRIMARY_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
  private readonly FALLBACK_MODEL = 'HuggingFaceH4/zephyr-7b-beta';
  private readonly MAX_RETRIES = 2;
  private readonly CHAR_LIMIT = 280;

  constructor(private readonly configService: ConfigService) {}

  async generateTweets(request: TweetGenerationRequest): Promise<TweetDraft[]> {
    const { activities, username } = request;

    if (activities.length === 0) {
      this.logger.warn('No activities provided, generating template-based drafts');
      return this.generateTemplateBasedDrafts([], username);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      const model = attempt === 0 ? this.PRIMARY_MODEL : this.FALLBACK_MODEL;
      try {
        this.logger.log(`Generating tweets with model: ${model} (attempt ${attempt + 1})`);
        return await this.generateWithAI(activities, username, model);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Model ${model} failed: ${error.message}`);
        if (attempt < this.MAX_RETRIES - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    this.logger.error('All AI models failed, falling back to templates', lastError);
    return this.generateTemplateBasedDrafts(activities, username);
  }

  private async generateWithAI(
    activities: ParsedGitHubActivity[],
    username: string,
    model: string,
  ): Promise<TweetDraft[]> {
    const apiToken = this.configService.get<string>('HF_API_TOKEN');
    if (!apiToken) {
      throw new HttpException('HF_API_TOKEN not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const activitySummary = this.buildActivitySummary(activities);
    const prompt = this.buildPrompt(activitySummary, username);

    this.logger.debug(`Sending request to Hugging Face API for model: ${model}`);

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
            do_sample: true,
            return_full_text: false,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const generatedText = this.extractGeneratedText(result);
    const drafts = this.parseGeneratedTweets(generatedText, activities);

    if (drafts.length === 0) {
      throw new Error('No valid drafts generated from AI response');
    }

    return drafts;
  }

  private extractGeneratedText(result: any): string {
    if (Array.isArray(result) && result[0]?.generated_text) {
      return result[0].generated_text;
    }
    if (result.generated_text) {
      return result.generated_text;
    }
    throw new Error('Unexpected API response format');
  }

  private buildActivitySummary(activities: ParsedGitHubActivity[]): string {
    return activities
      .map((a) => `- [${a.type}] ${a.description} (${a.repo})`)
      .join('\n');
  }

  private buildPrompt(activitySummary: string, username: string): string {
    return `<s>[INST] You are a developer sharing coding progress. Based on these GitHub activities from @${username}:

${activitySummary}

Generate 2-3 tweet drafts that:
- Are under 280 characters each
- Have a casual, confident developer tone (not corporate speak)
- Include 1 actionable tip or insight when relevant
- Add 1-2 relevant hashtags (#buildinpublic #webdev #javascript #typescript #coding)
- Focus on accomplishments, not just what was done

Return ONLY the tweet drafts, one per line. No numbering, no quotes, no explanations. [/INST]`;
  }

  private parseGeneratedTweets(
    text: string,
    activities: ParsedGitHubActivity[],
  ): TweetDraft[] {
    const lines = text
      .split('\n')
      .map((line) => this.sanitizeTweet(line))
      .filter((line) => line.length > 20 && line.length <= this.CHAR_LIMIT);

    const repo = activities[0]?.repo || 'unknown';
    const timestamp = new Date().toISOString();

    return lines.slice(0, 3).map((content, index) => ({
      id: `draft-${Date.now()}-${index}`,
      content,
      charCount: content.length,
      repo,
      timestamp,
      status: 'pending' as const,
      copyCount: 0,
    }));
  }

  private sanitizeTweet(text: string): string {
    let cleaned = text
      .replace(/^[\s\d\.\-\*\"\'\#]+/, '')
      .replace(/[\"\'`]+$/, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .replace(/[\*\_]{2,}(.*?)[\*\_]{2,}/g, '$1')
      .replace(/[\*\_](.*?)[\*\_]/g, '$1')
      .trim();

    return enforceCharLimit(cleaned, this.CHAR_LIMIT);
  }

  private generateTemplateBasedDrafts(
    activities: ParsedGitHubActivity[],
    username: string,
  ): TweetDraft[] {
    const timestamp = new Date().toISOString();

    if (activities.length === 0) {
      return [
        {
          id: `draft-${Date.now()}-0`,
          content: `Just shipped some code today! 🚀 Always learning, always building. #buildinpublic #webdev`,
          charCount: 93,
          repo: 'various',
          timestamp,
          status: 'pending',
          copyCount: 0,
        },
      ];
    }

    return activities.slice(0, 3).map((activity, index) => {
      const actionMap: Record<string, string> = {
        commit: 'Pushed commits',
        pr_merge: 'Merged a pull request',
        pr_open: 'Opened a pull request',
        issue_close: 'Closed an issue',
        release: 'Published a new release',
        create_tag: 'Created a new tag',
      };

      const action = actionMap[activity.type] || 'Made progress';
      const repoName = activity.repo.split('/')[1] || activity.repo;
      const tip = activity.type === 'commit' ? ' Pro tip: Small, frequent commits keep your workflow smooth.' : '';

      let content = `${action} on ${repoName}! ${activity.description.substring(0, 100)} #buildinpublic #webdev${tip}`;

      content = enforceCharLimit(content, this.CHAR_LIMIT);

      return {
        id: `draft-${Date.now()}-${index}`,
        content,
        charCount: content.length,
        repo: activity.repo,
        timestamp,
        status: 'pending',
        copyCount: 0,
      };
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
