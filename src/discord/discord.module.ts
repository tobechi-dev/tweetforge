import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DiscordService } from './discord.service';
import { AllExceptionsFilter } from '../common/filters/http-exception.filter';
import { ConfigModule } from '../config/config.module';
import { TwitterModule } from '../twitter/twitter.module';

@Module({
  imports: [ConfigModule, TwitterModule],
  providers: [
    DiscordService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [DiscordService],
})
export class DiscordModule {}
