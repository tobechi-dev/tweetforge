import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParsedGitHubActivity, GitHubEvent } from './interfaces/github-event.interface';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchRecentActivity(): Promise<ParsedGitHubActivity[]> {
    const username = this.configService.get<string>('GITHUB_USERNAME');
    this.logger.log(`Fetching GitHub activity for user: ${username}`);

    try {
      const response = await fetch(
        `https://api.github.com/users/${username}/events/public`,
        {
          headers: {
            'User-Agent': 'TweetForge/1.0',
            Accept: 'application/vnd.github.v3+json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const events: GitHubEvent[] = await response.json();
      return this.parseEvents(events);
    } catch (error) {
      this.logger.error('Failed to fetch GitHub activity', error);
      throw error;
    }
  }

  private parseEvents(events: GitHubEvent[]): ParsedGitHubActivity[] {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return events
      .filter((event) => new Date(event.created_at) > last24h)
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
      case 'PushEvent':
        const commits = event.payload.commits || [];
        return {
          ...base,
          type: 'commit',
          description: `Pushed ${commits.length} commit(s) to ${event.repo.name}`,
        };
      case 'PullRequestEvent':
        if (event.payload.action === 'closed' && event.payload.pull_request?.merged) {
          return {
            ...base,
            type: 'pr_merge',
            description: `Merged PR: ${event.payload.pull_request.title}`,
          };
        }
        return null;
      case 'IssuesEvent':
        if (event.payload.action === 'closed') {
          return {
            ...base,
            type: 'issue_close',
            description: `Closed issue: ${event.payload.issue.title}`,
          };
        }
        return null;
      case 'ReleaseEvent':
        return {
          ...base,
          type: 'release',
          description: `Released ${event.payload.release?.tag_name || 'new version'}`,
        };
      default:
        return null;
    }
  }
}
