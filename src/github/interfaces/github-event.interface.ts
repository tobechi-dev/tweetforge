export interface GitHubEvent {
  id: string;
  type: GitHubEventType;
  repo: {
    name: string;
    url: string;
  };
  payload: Record<string, any>;
  created_at: string;
  public: boolean;
}

export enum GitHubEventType {
  PushEvent = 'PushEvent',
  PullRequestEvent = 'PullRequestEvent',
  IssuesEvent = 'IssuesEvent',
  ReleaseEvent = 'ReleaseEvent',
  CreateEvent = 'CreateEvent',
  DeleteEvent = 'DeleteEvent',
  ForkEvent = 'ForkEvent',
  WatchEvent = 'WatchEvent',
  IssueCommentEvent = 'IssueCommentEvent',
  PullRequestReviewEvent = 'PullRequestReviewEvent',
}

export interface ParsedGitHubActivity {
  id: string;
  type: string;
  repo: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
