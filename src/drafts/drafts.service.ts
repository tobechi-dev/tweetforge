import { Injectable, NotFoundException } from '@nestjs/common';
import { TweetDraft } from '../twitter/interfaces/tweet-draft.interface';

@Injectable()
export class DraftsService {
  private recentDrafts: TweetDraft[] = [];

  store(drafts: TweetDraft[]): void {
    this.recentDrafts = [...drafts, ...this.recentDrafts].slice(0, 10);
  }

  getRecentDrafts(): TweetDraft[] {
    return this.recentDrafts;
  }

  incrementCopyCount(id: string) {
    const draft = this.recentDrafts.find((draft) => draft.id === id);

    if (!draft) {
      throw new NotFoundException(`Draft ${id} not found`);
    }

    draft.copyCount = (draft.copyCount ?? 0) + 1;

    return {
      success: true,
      copyCount: draft.copyCount,
    };
  }
}
