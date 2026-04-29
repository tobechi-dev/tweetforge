import { Controller, Get } from '@nestjs/common';
import { GithubService } from './github.service';

@Controller('api/github')
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Get('activity')
  async getActivity() {
    return this.githubService.fetchRecentActivity();
  }
}
