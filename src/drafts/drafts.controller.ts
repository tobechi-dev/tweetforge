import { Controller, Get, Param, Post } from '@nestjs/common';
import { DraftsService } from './drafts.service';
import { TweetDraft } from '../twitter/interfaces/tweet-draft.interface';

@Controller('api/drafts')
export class DraftsController {
  constructor(private readonly draftsService: DraftsService) {}

  @Get()
  getDrafts(): TweetDraft[] {
    return this.draftsService.getRecentDrafts();
  }

  @Post(':id/copy')
  incrementCopyCount(@Param('id') id: string) {
    return this.draftsService.incrementCopyCount(id);
  }
}
