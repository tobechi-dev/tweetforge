import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { GithubService } from '../github/github.service';
import { TwitterService } from '../twitter/twitter.service';
import { DiscordService } from '../discord/discord.service';
import { ConfigService } from '@nestjs/config';
import { DraftsService } from '../drafts/drafts.service';

describe('SchedulerService', () => {
  let service: SchedulerService;

  const githubService = {
    fetchRecentActivity: jest.fn(),
  };

  const twitterService = {
    generateTweets: jest.fn(),
  };

  const discordService = {
    sendDraftEmbed: jest.fn(),
    sendErrorNotification: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const draftsService = {
    store: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: GithubService,
          useValue: githubService,
        },
        {
          provide: TwitterService,
          useValue: twitterService,
        },
        {
          provide: DiscordService,
          useValue: discordService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: DraftsService,
          useValue: draftsService,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should generate, store, and send drafts successfully', async () => {
    const activities = [
      {
        type: 'push',
        repo: 'tweetforge',
      },
    ];

    const drafts = [
      {
        id: 'draft-1',
        content: 'Built something cool today.',
        charCount: 30,
        repo: 'tweetforge',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ];

    githubService.fetchRecentActivity.mockResolvedValue(activities);
    configService.get.mockReturnValue('tobechi-dev');
    twitterService.generateTweets.mockResolvedValue(drafts);
    discordService.sendDraftEmbed.mockResolvedValue(undefined);

    const result = await service.runPipeline();

    expect(result.success).toBe(true);
    expect(result.drafts).toEqual(drafts);

    expect(githubService.fetchRecentActivity).toHaveBeenCalledTimes(1);

    expect(configService.get).toHaveBeenCalledWith('GITHUB_USERNAME');

    expect(twitterService.generateTweets).toHaveBeenCalledWith({
      activities,
      username: 'tobechi-dev',
    });

    expect(draftsService.store).toHaveBeenCalledWith(drafts);

    expect(discordService.sendDraftEmbed).toHaveBeenCalledWith(
      drafts,
      activities,
    );
  });

  it('should return early when there is no GitHub activity', async () => {
    githubService.fetchRecentActivity.mockResolvedValue([]);

    const result = await service.runPipeline();

    expect(result).toEqual({
      success: true,
      message: 'No GitHub activity in the last 24 hours',
    });

    expect(twitterService.generateTweets).not.toHaveBeenCalled();
    expect(draftsService.store).not.toHaveBeenCalled();
    expect(discordService.sendDraftEmbed).not.toHaveBeenCalled();
  });

  it('should notify Discord when the pipeline fails', async () => {
    const error = new Error('GitHub API failed');

    githubService.fetchRecentActivity.mockRejectedValue(error);
    discordService.sendErrorNotification.mockResolvedValue(undefined);

    const result = await service.runPipeline();

    expect(result.success).toBe(false);
    expect(result.message).toBe('Pipeline failed: GitHub API failed');

    expect(discordService.sendErrorNotification).toHaveBeenCalledWith(
      error,
      'Daily Draft Generation',
    );
  });

  it('should update stats and recent activity after a successful run', async () => {
    const activities = [
      {
        type: 'push',
        repo: 'tweetforge',
      },
    ];

    const drafts = [
      {
        id: 'draft-1',
        content: 'Built something cool today.',
        charCount: 30,
        repo: 'tweetforge',
        timestamp: new Date().toISOString(),
        status: 'pending',
      },
    ];

    githubService.fetchRecentActivity.mockResolvedValue(activities);
    configService.get.mockReturnValue('tobechi-dev');
    twitterService.generateTweets.mockResolvedValue(drafts);
    discordService.sendDraftEmbed.mockResolvedValue(undefined);

    await service.runPipeline();

    expect(service.getRecentActivity()).toEqual(activities);

    expect(service.getStats()).toEqual(
      expect.objectContaining({
        totalDrafts: 1,
        successRate: 100,
        eventsToday: 1,
      }),
    );
  });
});
