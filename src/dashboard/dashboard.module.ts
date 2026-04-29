import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public/dashboard'),
      serveRoot: '/dashboard',
    }),
  ],
  controllers: [DashboardController],
})
export class DashboardModule {}
