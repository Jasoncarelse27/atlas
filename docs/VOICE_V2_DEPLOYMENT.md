# Voice V2 Deployment Guide

## Overview

Voice V2 is a WebSocket-based real-time voice conversation system deployed to Fly.io for unlimited connection duration.

## Architecture

- **Client**: React app with WebSocket client (`voiceCallServiceV2.ts`)
- **Server**: Node.js WebSocket server on Fly.io (`api/voice-v2/server.mjs`)
- **Services**: Deepgram STT, Claude Haiku LLM, OpenAI TTS
- **Database**: Supabase (session metrics, transcripts)

## Prerequisites

### 1. Install Fly.io CLI

```bash
# macOS
brew install flyctl

# Or download from https://fly.io/docs/hands-on/install-flyctl/
```

### 2. Login to Fly.io

```bash
flyctl auth login
```

### 3. Create Fly.io App (one-time setup)

```bash
cd api/voice-v2
flyctl apps create atlas-voice-v2
```

## Environment Variables

### Required Secrets

Set these secrets in Fly.io before deploying:

```bash
flyctl secrets set \
  SUPABASE_URL="https://rbwabemtucdkytvvpzvk.supabase.co" \
  SUPABASE_ANON_KEY="your-anon-key" \
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  DEEPGRAM_API_KEY="your-deepgram-key" \
  ANTHROPIC_API_KEY="your-claude-key" \
  OPENAI_API_KEY="your-openai-key" \
  --app atlas-voice-v2
```

### Frontend Configuration

Add to `.env.production`:

```bash
VITE_VOICE_V2_URL=wss://atlas-voice-v2.fly.dev
VITE_VOICE_V2_ENABLED=true
```

## Deployment

### Automatic Deployment

```bash
cd api/voice-v2
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment

```bash
cd api/voice-v2
flyctl deploy --app atlas-voice-v2
```

## Monitoring

### View Logs

```bash
flyctl logs --app atlas-voice-v2
```

### View Dashboard

```bash
flyctl dashboard --app atlas-voice-v2
```

### Health Check

```bash
curl https://atlas-voice-v2.fly.dev/health
```

## Cost Limits & Budget Protection

### Session Limits

- **Max Cost Per Session**: $5.00
- **Max Session Duration**: 30 minutes
- **Budget Warning**: Triggered at 80% ($4.00)

### Pricing Breakdown

- **Deepgram STT**: $0.0043/minute
- **Claude Haiku**: $0.25/1M input tokens, $1.25/1M output tokens
- **OpenAI TTS**: $15/1M characters

### Monitoring Costs

All sessions are automatically saved to the `voice_sessions` table in Supabase with detailed cost breakdowns:

```sql
SELECT 
  user_id,
  SUM(total_cost) as total_spent,
  COUNT(*) as session_count,
  AVG(duration_ms) as avg_duration_ms
FROM voice_sessions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_spent DESC;
```

## Troubleshooting

### Connection Fails

1. Check WebSocket URL is correct (wss://, not https://)
2. Verify Fly.io app is running: `flyctl status --app atlas-voice-v2`
3. Check logs: `flyctl logs --app atlas-voice-v2`

### Authentication Errors

1. Verify user has valid Supabase session
2. Check auth token is being sent in `session_start` message
3. Verify `SUPABASE_ANON_KEY` is set correctly

### Audio Issues

1. Verify microphone permissions in browser
2. Check audio chunk size is 1600 (100ms at 16kHz)
3. Verify Deepgram API key is valid

### Budget Exceeded

1. Check user's session history in `voice_sessions` table
2. Review cost breakdown per session
3. Consider adjusting `MAX_COST_PER_SESSION` if needed

## Rollback Procedure

### Rollback to Previous Version

```bash
# View deployment history
flyctl releases --app atlas-voice-v2

# Rollback to previous release
flyctl releases rollback <release-id> --app atlas-voice-v2
```

### Emergency Shutdown

```bash
# Scale to 0 machines (stop all instances)
flyctl scale count 0 --app atlas-voice-v2

# Resume service
flyctl scale count 1 --app atlas-voice-v2
```

## Performance Tuning

### Scaling

```bash
# Scale up for high traffic
flyctl scale count 2 --app atlas-voice-v2

# Scale down for low traffic
flyctl scale count 1 --app atlas-voice-v2
```

### Resource Allocation

Edit `fly.toml` to adjust CPU/memory:

```toml
[compute]
  cpu_kind = "shared"
  cpus = 2  # Increase for better performance
  memory_mb = 1024  # Increase if OOM errors
```

## Security Checklist

- [x] JWT authentication on all connections
- [x] Rate limiting (3 sessions per user)
- [x] Audio chunk size validation
- [x] Budget limits ($5 per session)
- [x] Session duration limits (30 minutes)
- [x] RLS policies on `voice_sessions` table
- [x] Service role key stored as Fly.io secret
- [x] HTTPS/WSS connections only

## Support

For issues or questions:

1. Check logs: `flyctl logs --app atlas-voice-v2`
2. Review Supabase logs for database errors
3. Check Deepgram/Claude/OpenAI API status
4. Review session metrics in `voice_sessions` table

## References

- Fly.io Docs: https://fly.io/docs/
- Deepgram API: https://developers.deepgram.com/
- Claude API: https://docs.anthropic.com/
- OpenAI TTS API: https://platform.openai.com/docs/guides/text-to-speech

