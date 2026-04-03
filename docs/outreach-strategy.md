# Outreach Strategy — Genomic Agent Discovery

Maximum visibility playbook for launching an open-source genomic analysis tool.

---

## TIER 1: Highest Impact (do these first)

### Hacker News — Show HN
- **Why:** Single highest-ROI platform for developer tools. HN drives more active installs and paid interest than Product Hunt for dev tools.
- **When:** Tuesday–Thursday, 8–11am ET (1–4pm UK). Low-competition alternative: Sunday 6am UTC (2.5x more likely to hit front page due to less competition).
- **Title:** `Show HN: AI agents collaborate to analyze your DNA across 12 databases locally` (78 chars)
- **Link to:** GitHub repo directly (not a landing page — HN prefers this)
- **First comment:** Post immediately. Explain the "why" and architecture. Ask for feedback on specific things (agent prompts, dedup heuristic, MCP pattern). Already written in `docs/hackernews-post.md`.
- **Critical:** Reply to every comment in the first 60 minutes. Early velocity is decisive. 3-10 early upvotes from real accounts in the first hour determines everything.
- **Don't:** Use hype words, marketing language, or emojis in the title. HN penalizes this.

### Product Hunt
- **Why:** Broad visibility, good for "Open Source" category. Multi-platform launches see 40% higher conversion.
- **When:** Launch at 12:01 AM PST. Tuesday–Thursday perform best.
- **Prep:** Create a Product Hunt page in advance. Add screenshots, the pipeline GIF, and a clear tagline. Get 5-10 people to follow the product page before launch.
- **Tagline:** "AI agents that collaborate to analyze your DNA — open source, runs locally"
- **First comment:** Same as HN — explain why you built it, ask for specific feedback.
- **Category:** Open Source, Developer Tools, Health, AI
- **Tip:** You can launch again after 6 months with a significant update.

### Twitter/X
- **Why:** Fast spread, especially in AI/biotech circles. Good for ongoing engagement.
- **When:** Same day as HN launch. Post the thread, then standalone tweets over the next week.
- **Hashtag rule:** 1-2 per tweet max. More than 2 gets penalized by 40%. Best hashtags: `#OpenSource` + one of `#Genomics`, `#AI`, `#Bioinformatics`, `#MCP`
- **Visual tweet:** Attach `gif-pipeline-running.gif` — visual content gets dramatically more engagement.
- **Tag:** @AnthropicAI (you use their MCP protocol), @ClaudeAI. They sometimes retweet MCP projects.
- **Posts:** Already written in `docs/twitter-posts.md`

---

## TIER 2: High Impact (do within first week)

### Discord Community
- **Why:** Own your community. No risk of bans. Direct engagement with interested users.
- **Server:** https://helixsequencing.com/discord
- **Promote the Discord link** in all other platform posts as the central community hub.

### Dev.to
- **Why:** Large developer community, strong for open-source. Good for technical write-ups. Posts get indexed by Google quickly.
- **Format:** Write an article about the MCP agent communication architecture. Title like "How I Built a Multi-Agent System Where AI Agents Collaborate to Analyze Your Genome"
- **Include:** Architecture diagram, code snippets of the MCP tool definitions, the pipeline GIF
- **Tags:** `#opensource`, `#ai`, `#javascript`, `#beginners` (beginners tag gets massive reach on Dev.to)
- **Canonical URL:** Point to a version on your own blog/site if you have one

### LinkedIn
- **Why:** Reaches PMs, founders, biotech people who won't see HN.
- **When:** Tuesday–Thursday morning. First 60-90 minutes determine 70% of reach.
- **Format:** Personal story post. "I had my 23andMe raw file sitting in my downloads for years..." Lead with the human angle, not the tech.
- **Rules (2026 algorithm):**
  - Comments count 2x as much as likes
  - Reply to first 20-30 comments within 1 hour
  - Don't ask for likes/comments explicitly (penalized since March 2026 "Authenticity Update")
  - Add one verifiable link per major claim
  - Dwell time is the #1 metric — make people stop scrolling

---

## TIER 3: Medium Impact (do within first 2 weeks)

### Hashnode
- **Why:** Developer-focused blogging platform with built-in community discovery. Automatically promotes articles. Best for step-by-step technical guides.
- **Format:** Tutorial-style: "Build Your Own Genomic Analysis Pipeline with AI Agents"
- **Tip:** Cross-post from Dev.to with canonical URL set correctly

### Medium
- **Why:** Broadest audience. Reaches non-developers (biotech investors, PMs, science journalists).
- **Where:** Submit to publications like "Towards Data Science", "Better Programming", "The Startup"
- **Format:** More narrative, less code. "What If AI Agents Could Read Your DNA?"

### GitHub Awesome Lists (submit PRs)
- **danielecook/Awesome-Bioinformatics** — curated list of bioinformatics software. Fork, add your tool, submit PR.
- **ZhihaoXie/awesome-bioinformatics-tools** — another curated list
- **sindresorhus/awesome** — the master awesome list (harder to get into)
- **GitHub Topics:** Make sure your repo has topics: `bioinformatics`, `genomics`, `mcp`, `ai-agents`, `dna-analysis`, `open-source`

### Lobste.rs
- **Why:** High-quality technical community, less noisy than HN.
- **How to get invite:** Submit to the invitation queue at lobste.rs with your GitHub profile. If your project was already posted there by someone else, you can ask for an invite in their chat. Being an author of submitted content makes getting invited easy.

### Newsletters
- Reach out to authors of:
  - **TLDR** (tldr.tech) — massive dev newsletter
  - **Console.dev** — specifically curates open-source tools
  - **Changelog** (changelog.com) — open-source news
  - **Bioinformatics Weekly** — niche but targeted
  - **Import AI** — AI newsletter by Jack Clark

---

## TIER 4: Long Tail (ongoing)

### Discord & Slack Communities
- **Bioinformatics Discord** — general bioinformatics community
- **Anthropic Discord** — share MCP projects
- **MLOps Community Slack** — AI/ML engineering
- **Data Talks Club Slack** — data science community

### YouTube
- Record a 5-minute demo video showing the pipeline running. Screen recording of the dashboard with voiceover. Good for embedding in all other posts.

### Biostars.org
- Q&A forum for bioinformatics. Post as a tool announcement or answer existing questions about DNA analysis tools.

### Cross-posting from Dev.to
- Dev.to has built-in canonical URL support. Write once, cross-post to Hashnode and Medium with canonical set to Dev.to. All three platforms get content, none penalizes for duplicate.

---

## Timing Playbook

| Day | Action |
|-----|--------|
| **Day 1 (Tue-Thu, morning)** | HN Show HN + Twitter thread |
| **Day 1 (afternoon)** | Product Hunt launch (if prepped) or save for Day 2 |
| **Day 2** | LinkedIn post + promote Discord server |
| **Day 3** | Dev.to article |
| **Day 4-5** | Hashnode cross-post + Medium submission to publications |
| **Week 1** | Submit PRs to Awesome lists + GitHub Topics |
| **Week 1-2** | Email newsletters (Console.dev, TLDR, Changelog) |
| **Week 2+** | Discord/Slack communities + Biostars + YouTube demo |

---

## Key Messages to Hit Everywhere

1. **One-command setup** — `npm install && npm run build-db && npm start`
2. **12 databases in one SQLite** — ClinVar, GWAS, AlphaMissense, CPIC, etc.
3. **Agents talk to each other** — custom MCP server, chatroom with priority levels, auto-deduplication
4. **Privacy-first** — runs locally, your DNA never leaves your machine
5. **Works with Ollama** — fully free, fully local, no API calls
6. **Transparent prompts** — every agent's instructions visible before analysis
7. **MIT licensed** — truly open source, not open-core
8. **Join the community** — Discord: https://helixsequencing.com/discord
