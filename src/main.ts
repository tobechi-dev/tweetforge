import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { Logger } from '@nestjs/common';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 TweetForge is running on: http://localhost:${port}`);
  logger.log(`📊 Dashboard available at: http://localhost:${port}/dashboard`);
}
bootstrap();
