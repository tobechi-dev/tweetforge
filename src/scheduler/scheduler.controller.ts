import { Controller, Get, Post, Body } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { TweetDraft } from '../twitter/interfaces/tweet-draft.interface';

@Controller('api')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger')
  async triggerPipeline() {
    return this.schedulerService.runPipeline();
  }

  @Get('stats')
  getStats() {
    return this.schedulerService.getStats();
  }

  @Get('drafts')
  getDrafts(): TweetDraft[] {
    return this.schedulerService.getRecentDrafts();
  }

  @Get('activity')
  getActivity() {
    return this.schedulerService.getRecentActivity();
  }

  @Get('health')
  getHealth() {
    return this.schedulerService.getHealth();
  }

  @Post('drafts/:id/copy')
  async incrementCopyCount() {
    return { success: true };
  }
}
