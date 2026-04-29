import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedGitHubActivity, GitHubEvent, GitHubEventType } from './interfaces/github-event.interface';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly GITHUB_API = 'https://api.github.com';
  private rateLimitRemaining = 60;
  private rateLimitResetTime: Date | null = null;

  constructor(private readonly configService: ConfigService) {}

  async fetchRecentActivity(): Promise<ParsedGitHubActivity[]> {
    const username = this.configService.get<string>('GITHUB_USERNAME');
    if (!username) {
      throw new HttpException('GITHUB_USERNAME not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.logger.log(`Fetching GitHub activity for user: ${username}`);

    try {
      const url = `${this.GITHUB_API}/users/${username}/events/public`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TweetForge/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      this.updateRateLimitInfo(response);

      if (response.status === 403 && this.rateLimitRemaining === 0) {
        const resetTime = this.rateLimitResetTime?.toLocaleTimeString();
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}`);
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const events: GitHubEvent[] = await response.json();
      const activities = this.parseEvents(events);

      this.logger.log(`Parsed ${activities.length} meaningful activities from ${events.length} events`);
      return activities;
    } catch (error) {
      this.logger.error('Failed to fetch GitHub activity', error.stack);
      throw error;
    }
  }

  private updateRateLimitInfo(response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');

    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitResetTime = new Date(parseInt(reset, 10) * 1000);
    }
  }

  private parseEvents(events: GitHubEvent[]): ParsedGitHubActivity[] {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return events
      .filter((event) => {
        const eventDate = new Date(event.created_at);
        return eventDate > last24h && event.public;
      })
      .map((event) => this.parseEvent(event))
      .filter((activity): activity is ParsedGitHubActivity => activity !== null);
  }

  private parseEvent(event: GitHubEvent): ParsedGitHubActivity | null {
    const base = {
      id: event.id,
      repo: event.repo.name,
      timestamp: event.created_at,
    };

    switch (event.type) {
      case GitHubEventType.PushEvent: {
        const commits = event.payload.commits || [];
        const commitMessages = commits
          .slice(0, 3)
          .map((c: any) => c.message.split('\n')[0])
          .join(', ');
        return {
          ...base,
          type: 'commit',
          description: `Pushed ${commits.length} commit(s): ${commitMessages || 'various changes'}`,
        };
      }

      case GitHubEventType.PullRequestEvent: {
        if (event.payload.action === 'closed' && event.payload.pull_request?.merged) {
          return {
            ...base,
            type: 'pr_merge',
            description: `Merged PR #${event.payload.pull_request.number}: ${event.payload.pull_request.title}`,
          };
        }
        if (event.payload.action === 'opened') {
          return {
            ...base,
            type: 'pr_open',
            description: `Opened PR #${event.payload.pull_request.number}: ${event.payload.pull_request.title}`,
          };
        }
        return null;
      }

      case GitHubEventType.IssuesEvent: {
        if (event.payload.action === 'closed') {
          return {
            ...base,
            type: 'issue_close',
            description: `Closed issue #${event.payload.issue.number}: ${event.payload.issue.title}`,
          };
        }
        return null;
      }

      case GitHubEventType.ReleaseEvent: {
        return {
          ...base,
          type: 'release',
          description: `Released ${event.payload.release?.tag_name || 'new version'}: ${event.payload.release?.name || ''}`,
        };
      }

      case GitHubEventType.CreateEvent: {
        if (event.payload.ref_type === 'tag') {
          return {
            ...base,
            type: 'create_tag',
            description: `Created tag ${event.payload.ref}`,
          };
        }
        return null;
      }

      default:
        return null;
    }
  }

  getRateLimitInfo() {
    return {
      remaining: this.rateLimitRemaining,
      resetTime: this.rateLimitResetTime,
    };
  }
}
