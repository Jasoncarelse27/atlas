# Atlas Voice V2 - Project Kickoff Summary

**Date:** October 26, 2024  
**Decision:** Build V2 voice chat properly (ChatGPT-level quality)  
**Timeline:** 6-8 weeks  
**Target Launch:** December 15, 2024

---

## 🎯 Why V2?

### **V1 Reality Check:**
- **Tested latency:** 31 seconds (unshippable)
- **User feedback:** "Feels like a cheap voice note system"
- **Root cause:** REST API architecture can't deliver real-time performance
- **Verdict:** Don't ship V1, build V2 properly

### **V2 Goals:**
- ✅ < 2 second response time (ChatGPT competitive)
- ✅ Natural conversation flow (no "walkie-talkie" feel)
- ✅ 99%+ reliability
- ✅ Cost-effective ($0.18 per 10-min call vs $0.25 in V1)

---

## 📚 Documentation Created

### **1. Project Plan** (`docs/VOICE_V2_PROJECT_PLAN.md`)
**Contents:**
- Week-by-week breakdown (8 weeks)
- Success criteria (< 2.5s latency, 90%+ accuracy)
- Code examples (WebSocket client/server)
- Cost analysis (99.1% profit margin)
- Development priorities

### **2. Technical Spec** (`docs/VOICE_V2_TECHNICAL_SPEC.md`)
**Contents:**
- WebSocket protocol (message types, flow)
- System architecture diagram
- Component specifications (audio capture, playback, session manager)
- API integration specs (Deepgram, Claude, PlayHT)
- Database schema
- Performance monitoring
- Deployment strategy

### **3. V2 Roadmap** (`docs/VOICE_V2_ROADMAP.md`)
**Contents:**
- Performance gap analysis (V1 vs V2 vs ChatGPT)
- 4-phase implementation plan
- Timeline (Q1 2025)
- Cost breakdown
- Risk mitigation
- A/B testing strategy

### **4. Health Plan** (`docs/VOICE_FEATURES_HEALTH_PLAN.md`)
**Contents:**
- Feature inventory (voice notes, voice calls, TTS)
- Health scores (65-90%)
- 90-day action plan
- Business metrics
- Priority matrix

### **5. V1 Status** (`docs/VOICE_V1_STATUS.md`)
**Contents:**
- Current performance metrics (8.4s → 31s in real test)
- Architecture breakdown
- Bottleneck analysis
- Quick wins available (not worth implementing)
- Recommendation: Don't ship

---

## 🏗️ Project Structure Created

```
/Users/jasoncarelse/atlas/
├── api/
│   └── voice-v2/                    # NEW: Edge Function directory
│       ├── index.ts                 # Main WebSocket handler
│       ├── sessionManager.ts        # Session state management
│       ├── deepgramClient.ts        # Deepgram Streaming integration
│       ├── claudeClient.ts          # Claude streaming proxy
│       ├── ttsClient.ts             # PlayHT/ElevenLabs integration
│       └── types.ts                 # Shared TypeScript interfaces
│
├── src/
│   └── services/
│       └── voiceV2/                 # NEW: Client-side V2 services
│           ├── voiceCallServiceV2.ts  # Main V2 service
│           ├── audioCapture.ts        # Mic capture (16kHz PCM)
│           ├── audioPlayback.ts       # Audio playback (AudioWorklet)
│           └── types.ts               # Client-side types
│
└── docs/
    ├── VOICE_V1_STATUS.md           # V1 analysis (don't ship)
    ├── VOICE_V2_PROJECT_PLAN.md     # 8-week plan
    ├── VOICE_V2_ROADMAP.md          # High-level roadmap
    ├── VOICE_V2_TECHNICAL_SPEC.md   # Implementation details
    └── VOICE_FEATURES_HEALTH_PLAN.md # Overall health assessment
```

---

## 📅 Week 1 Tasks (Nov 1-8)

### **✅ Completed (Oct 26):**
- [x] V1 performance analysis (31s latency documented)
- [x] V2 project plan created
- [x] Technical specification written
- [x] Directory structure created
- [x] Documentation complete

### **🔲 To Do (Next Week):**
- [ ] Install dependencies (Deepgram SDK, PlayHT SDK)
- [ ] Create basic WebSocket echo test
- [ ] Implement Edge Function skeleton
- [ ] Set up development environment
- [ ] Create project board in GitHub
- [ ] Daily standup schedule
- [ ] Slack channel: #voice-v2

---

## 💰 Business Case

### **Cost Comparison:**

| Metric | V1 | V2 | Savings |
|--------|----|----|---------|
| **Per 10-min call** | $0.245 | $0.178 | 27% |
| **Monthly (500 users, 10 calls)** | $1,225 | $890 | $335/mo |
| **Latency** | 31s | < 2s | 93% faster |
| **User Experience** | "Cheap" | ChatGPT-quality | ∞ better |

### **ROI:**
- **Investment:** 6-8 weeks engineering time
- **Revenue Impact:** Voice calls drive 20%+ Free→Studio upgrades
- **Retention Impact:** 30% lower churn for Studio users with voice
- **Brand Impact:** Competitive with ChatGPT (market leader)

---

## 🎯 Success Metrics

### **Technical KPIs:**
- ✅ P50 latency: < 2.5 seconds
- ✅ P95 latency: < 4 seconds
- ✅ Call success rate: > 99%
- ✅ Transcription accuracy: > 90%

### **User Experience KPIs:**
- ✅ User satisfaction: > 85% "satisfied" or "very satisfied"
- ✅ Repeat usage: > 60% use voice 2+ times/week
- ✅ Zero "feels cheap" feedback

### **Business KPIs:**
- ✅ Voice drives 20%+ Free→Studio conversions
- ✅ Studio users with voice have 30% lower churn
- ✅ Voice is #1 cited feature in Studio surveys

---

## 🚀 Technology Stack

### **Client-Side:**
- **Audio Capture:** Web Audio API (16kHz PCM)
- **WebSocket:** Native browser WebSocket API
- **Audio Playback:** AudioWorklet (buffer-free)
- **State Management:** React hooks

### **Server-Side:**
- **Runtime:** Vercel Edge Functions (Deno)
- **WebSocket:** Deno.upgradeWebSocket
- **Session Storage:** In-memory Map (per Edge instance)
- **Database:** Supabase (PostgreSQL)

### **External APIs:**
- **STT:** Deepgram Streaming (Nova-2 model)
- **LLM:** Claude 3 Haiku (streaming)
- **TTS:** PlayHT Realtime 2.0 or ElevenLabs V2

---

## 🛡️ Risk Mitigation

### **Risk 1: Edge Function WebSocket Limits**
**Mitigation:** 
- Test with 100 concurrent connections
- Fallback to Fly.io if needed
- Monitor connection limits

### **Risk 2: Streaming API Reliability**
**Mitigation:**
- Retry logic with exponential backoff
- Health checks for all APIs
- Fallback to V1 REST if streaming fails

### **Risk 3: Development Timeline Slip**
**Mitigation:**
- Weekly progress reviews
- MVP-first approach (streaming STT → LLM → TTS)
- Nice-to-haves deferred to post-launch

---

## 📝 Next Steps

### **Immediate (This Week):**
1. **Review this summary** with the team
2. **Assign Week 1 tasks**
3. **Set up development environment**
4. **Create project board** (GitHub Projects or Linear)
5. **Schedule daily standups** (15 min, 10am)

### **Week 1 (Nov 1-8):**
1. Install dependencies
2. Create WebSocket echo test
3. Implement Edge Function skeleton
4. Test Deepgram Streaming connection
5. Document progress

### **Week 2-8:**
Follow `VOICE_V2_PROJECT_PLAN.md`

---

## 💬 Communication

### **Slack Channels:**
- **#voice-v2** - Daily updates, questions, blockers
- **#engineering** - Technical discussions
- **#product** - User feedback, feature requests

### **Meetings:**
- **Daily Standup:** 10am, 15 min
- **Weekly Review:** Fridays, 2pm, 1 hour
- **Demo Days:** End of Week 2, 4, 6

### **Documentation:**
- **Updates:** Commit to git after each task
- **Blockers:** Post in #voice-v2 immediately
- **Decisions:** Document in `docs/VOICE_V2_DECISIONS.md`

---

## 🎓 Lessons from V1

### **What We Learned:**
1. **REST APIs can't do real-time** - Need WebSockets
2. **Railway has cold starts** - Need Edge Functions
3. **Sequential processing is slow** - Need parallel streaming
4. **User expectations are high** - "Good enough" isn't good enough

### **What We're Doing Differently:**
1. **Start with architecture** - Design for < 2s from day 1
2. **Test early, test often** - Load test every week
3. **Ship when it's great** - No Beta labels, no excuses
4. **Monitor everything** - Real-time latency dashboards

---

## ✅ Action Items

### **For Engineering:**
- [ ] Review technical spec
- [ ] Set up local development environment
- [ ] Create project board
- [ ] Assign Week 1 tasks

### **For Product (Jason):**
- [ ] Review project plan
- [ ] Approve timeline
- [ ] Define acceptance criteria
- [ ] Plan Beta user recruitment

### **For Marketing:**
- [ ] Plan launch announcement
- [ ] Create "Coming Soon" messaging
- [ ] Prepare comparison materials (Atlas vs ChatGPT voice)

---

**Status:** Ready to start Week 1  
**Owner:** Engineering Team  
**Stakeholder:** Jason (Product)  
**Next Review:** November 1, 2024  
**Last Updated:** October 26, 2024, 8:45 PM

---

## 📖 Quick Reference

### **Key Documents:**
- `docs/VOICE_V2_PROJECT_PLAN.md` - Week-by-week plan
- `docs/VOICE_V2_TECHNICAL_SPEC.md` - Implementation details
- `docs/VOICE_V2_ROADMAP.md` - High-level timeline
- `docs/VOICE_V1_STATUS.md` - Why we're not shipping V1

### **Quick Commands:**
```bash
# Start development server
npm run dev

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  https://localhost:5175/api/voice-v2

# Deploy to staging
vercel --prod

# View logs
vercel logs
```

---

**Let's build the best voice AI chat experience! 🚀**

