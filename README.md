# TweetForge

A NestJS-powered social media content generator that automates tweet draft creation from your GitHub activity.

## Features

- **Automated GitHub Activity Fetching**: Pulls your public GitHub events (commits, PRs, releases)
- **AI-Powered Tweet Generation**: Uses Hugging Face Inference API (Mistral-7B) to generate engaging tweet drafts
- **Discord Integration**: Delivers tweet drafts via rich Discord embeds
- **Scheduled Runs**: Daily cron job at 9:00 AM (configurable)
- **Beautiful Dashboard**: Monitor your drafts, activity, and system health at `/dashboard`

## Tech Stack

- NestJS with TypeScript
- Hugging Face Inference API (free tier)
- GitHub REST API (public, no auth required)
- @nestjs/schedule with node-cron
- Discord Webhook
- Tailwind CSS + Lucide Icons (dashboard)

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root:
   ```env
   GITHUB_USERNAME=your_github_username
   HF_API_TOKEN=your_huggingface_token
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   PORT=3000
   NODE_ENV=development
   ```

3. **Get a Hugging Face Token:**
   - Sign up at https://huggingface.co
   - Go to Settings → Access Tokens
   - Create a new token with "read" permissions

4. **Create a Discord Webhook:**
   - Open your Discord server settings
   - Go to Integrations → Webhooks
   - Create a new webhook and copy the URL

## Running the App

```bash
# Development
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

The dashboard will be available at `http://localhost:3000/dashboard`

## API Endpoints

- `GET  /api/stats` - Get dashboard statistics
- `GET  /api/drafts` - Get recent tweet drafts
- `GET  /api/activity` - Get recent GitHub activity
- `GET  /api/health` - Get system health status
- `POST /api/trigger` - Manually trigger the pipeline
- `POST /api/drafts/:id/copy` - Track copy count

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up -d

# Or build manually
docker build -t tweetforge .
docker run -p 3000:3000 --env-file .env tweetforge
```

## Project Structure

```
src/
├── github/           # GitHub API integration
├── twitter/          # Tweet generation with AI
├── discord/          # Discord webhook delivery
├── scheduler/        # Cron scheduling & pipeline
├── dashboard/        # Dashboard serving
├── common/           # Shared utilities & filters
└── config/           # Environment configuration
```

## License

MIT
