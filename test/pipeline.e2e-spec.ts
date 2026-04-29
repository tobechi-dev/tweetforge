import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Pipeline E2E Tests', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/stats should return stats object', () => {
    return request(app.getHttpServer())
      .get('/api/stats')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('totalDrafts');
        expect(res.body).toHaveProperty('successRate');
        expect(res.body).toHaveProperty('lastRun');
        expect(res.body).toHaveProperty('eventsToday');
      });
  });

  it('GET /api/drafts should return array', () => {
    return request(app.getHttpServer())
      .get('/api/drafts')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('GET /api/health should return health status', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('github');
        expect(res.body).toHaveProperty('huggingface');
        expect(res.body).toHaveProperty('discord');
        expect(res.body).toHaveProperty('status');
      });
  });

  it('POST /api/trigger should return success status', () => {
    return request(app.getHttpServer())
      .post('/api/trigger')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('message');
      });
  });
});
