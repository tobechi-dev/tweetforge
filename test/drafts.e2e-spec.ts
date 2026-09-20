import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DraftsService } from '../src/drafts/drafts.service';

describe('Drafts E2E Tests', () => {
  let app: INestApplication<App>;
  let draftsService: DraftsService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    draftsService = moduleFixture.get(DraftsService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/drafts should return recent drafts', () => {
    return request(app.getHttpServer())
      .get('/api/drafts')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('POST /api/drafts/:id/copy should increment copy count', async () => {
    const draft = {
      id: 'test-draft-1',
      content: 'This is a test tweet',
      charCount: 24,
      repo: 'test/repo',
      timestamp: new Date().toISOString(),
      status: 'pending' as const,
      copyCount: 0,
    };

    draftsService.store([draft]);

    await request(app.getHttpServer())
      .post(`/api/drafts/${draft.id}/copy`)
      .expect(201)
      .expect((res) => {
        expect(res.body).toEqual({
          success: true,
          copyCount: 1,
        });
      });

    const drafts = draftsService.getRecentDrafts();

    expect(drafts[0].copyCount).toBe(1);
  });

  it('POST /api/drafts/:id/copy should return 404 for unknown draft', () => {
    return request(app.getHttpServer())
      .post('/api/drafts/does-not-exist/copy')
      .expect(404);
  });
});
