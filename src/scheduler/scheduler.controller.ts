import { Controller, Get, Post, Body } from '@nestjs/common';
import { SchedulerService } from './scheduler.service'

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

  @Get('activity')
  getActivity() {
    return this.schedulerService.getRecentActivity();
  }

}
