export interface TweetDraft {
  id: string;
  content: string;
  charCount: number;
  repo: string;
  timestamp: string;
  status: 'pending' | 'sent' | 'failed';
  copyCount?: number;
}

export interface TweetGenerationRequest {
  activities: ParsedGitHubActivity[];
  username: string;
}

export interface TweetGenerationResponse {
  drafts: TweetDraft[];
  rawActivity: ParsedGitHubActivity[];
}
