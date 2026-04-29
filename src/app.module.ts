import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { GithubModule } from './github/github.module';
import { TwitterModule } from './twitter/twitter.module';
import { DiscordModule } from './discord/discord.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule,
    GithubModule,
    TwitterModule,
    DiscordModule,
    SchedulerModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
