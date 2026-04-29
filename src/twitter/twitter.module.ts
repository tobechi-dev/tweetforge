import { Module } from '@nestjs/common';
import { TwitterService } from './twitter.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [TwitterService],
  exports: [TwitterService],
})
export class TwitterModule {}
