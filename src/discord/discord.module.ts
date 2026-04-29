import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';
import { ConfigModule } from '../config/config.module';
import { TwitterModule } from '../twitter/twitter.module';

@Module({
  imports: [ConfigModule, TwitterModule],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
