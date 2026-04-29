import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { GithubModule } from '../github/github.module';
import { TwitterModule } from '../twitter/twitter.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    GithubModule,
    TwitterModule,
    DiscordModule,
  ],
  providers: [SchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
