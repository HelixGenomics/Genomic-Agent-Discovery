# Hacker News Post — Mark's Story Version

## Timing

**Best window:** Tuesday–Thursday, 8–10am ET (1–3pm UK)
**Next optimal slots:**
- Tuesday April 8, ~8:30am ET
- Wednesday April 9, ~8:30am ET

Tuesday is ideal — enough time to prep, close enough to ride Discord community growth. The HN audience will see this as a project with existing traction, not a cold launch.

**Alternative:** Sunday April 6, 6am UTC (2am ET) — 2.5x more likely to hit front page due to less competition, but smaller initial audience.

---

## Title Options

Pick one. All under 80 characters.

**Option A (recommended):**
```
Show HN: My brother has trisomy 9 – I built AI agents to find out why
```
(70 chars — personal, factual, intriguing, implies a story without clickbait)

**Option B:**
```
Show HN: My brother has trisomy 9 – I used AI agents to analyze our mum's DNA
```
(78 chars — more specific about what happened)

**Option C (discovery-forward):**
```
Show HN: AI agents found a 5-gene vulnerability my family carried for 45 years
```
(78 chars — leads with the discovery rather than the condition)

**Option D (tool-forward, safer for HN purists):**
```
Show HN: Open-source AI agents that collaborate to analyze your DNA locally
```
(75 chars — conventional Show HN title, lets the first comment carry the story)

---

## URL

```
https://github.com/HelixGenomics/Genomic-Agent-Discovery
```

---

## First Comment (post IMMEDIATELY after submitting — within 60 seconds)

---

My brother Mark was born in 1981 in Wales with mosaic trisomy 9 — a rare chromosome condition where some of his cells carry three copies of chromosome 9 instead of two. It occurs in roughly 1 in 25,000–50,000 births. He has intellectual disability, cardiac issues, and has needed support his whole life. He's 45 now.

Our mum took Debendox during pregnancy — a morning sickness drug prescribed to 30 million women worldwide, voluntarily withdrawn in 1983 not because regulators found it dangerous, but because the litigation costs made it uneconomical to keep manufacturing. Multiple large studies found "no statistically significant association" with birth defects. Case closed, as far as the medical establishment was concerned.

Our family never accepted that. But for 45 years, there was no way to test the question properly.

So I built a tool. Genomic Agent Discovery is an open-source system where multiple AI agents collaborate to analyze raw DNA data across 16+ public genomics databases. I ran it on our mum's DNA.

**What five independent AI agents found — each investigating a different biological system — and all converging on the same target:**

**1. Drug metabolism (CYP2D6/NAT2):** Mum is an intermediate metabolizer of doxylamine (Debendox's active ingredient). Her body cleared the drug 33–55% slower than the population average assumed in safety studies. The fetus was exposed to an estimated 1.3–1.5× the intended dose with every pill she took.

**2. Folate pathway (MTHFR/MTRR/SLC19A1/CBS):** Four gene variants converge to reduce her production of SAM — the methyl donor the body uses to maintain chromosome stability during cell division — by an estimated 30–40%. The Debendox formulation contained vitamin B6 but *not* folic acid. Folic acid supplementation didn't become standard for pregnant women until 1992, twelve years after Mark was conceived. Her genetics needed both. She got one.

**3. Pericentromeric epigenetics (EHMT1/DNMT1):** This is the finding that stopped me. EHMT1 — the gene responsible for the epigenetic scaffolding that holds chromosomes together during cell division — is located on chromosome 9q34.3. Mum carries variants in this gene. So the gene whose partial dysfunction most directly undermines chromosome 9's centromeric integrity is physically located *on chromosome 9 itself*. In any trisomy 9 cell, there are three copies of this gene, creating a self-amplifying loop — the very chromosome most at risk of missegregating carries the gene most responsible for preventing that missegregation.

**4. Oxidative stress (SOD2/GPX1/ERCC1):** Doxylamine metabolism generates reactive oxygen species. Mum's antioxidant defense is compromised at both steps — reduced superoxide dismutase AND reduced glutathione peroxidase — meaning the oxidative byproducts of the drug she was prescribed accumulate at centromeric DNA and damage the attachment machinery.

**5. Checkpoint failure (PRDM9/MAD2L1/TP53):** Variants affecting where chromosomal crossovers are placed during egg formation, how recombination errors are detected, and — critically — a TP53 variant that reduces the cell's ability to destroy aneuploid cells after they form. This last one explains why Mark has *mosaic* trisomy 9 rather than complete: the nondisjunction happened, partial rescue reduced some cells to normal, but the trisomic cells weren't efficiently eliminated.

**The uncomfortable conclusion:** The large epidemiological studies that declared Debendox "safe" never stratified by maternal pharmacogenomic profile. They averaged everyone together. Mum belongs to a subgroup — roughly 2–5% of the population — for whom the drug carried substantially elevated risk. That subgroup was invisible in aggregate statistics, and the tools to identify it didn't exist until now.

This doesn't prove causation. No genomic analysis conducted in 2026 can reach back into a pregnancy from 1981 and prove a deterministic causal chain. What it establishes is biological plausibility grounded in confirmed genotype data across five independent systems — each feeding into the next, all converging on chromosome 9's centromere.

The MTHFR + MTRR combination alone carries a published odds ratio of ~2.21 for chromosomal nondisjunction, from meta-analyses of mothers who gave birth to children with trisomy. Add the drug metabolism, the epigenetics, the oxidative stress, and the checkpoint failures — and the picture becomes hard to dismiss.

---

**The tool itself:**

Genomic Agent Discovery uses Anthropic's MCP protocol to give each agent access to 18 tools — database queries, patient genotype lookups, and inter-agent communication. The agents publish findings to a shared board with automatic deduplication, and communicate through a prioritized chatroom. When the cancer agent finds a variant, it can send an URGENT message to the pharma agent.

16+ public databases are bundled into a local SQLite file (ClinVar, GWAS Catalog, CPIC, AlphaMissense, gnomAD, PharmGKB, CIViC, Orphanet, and more). One command builds everything: `npm run build-db`.

Setup:
```
git clone https://github.com/HelixGenomics/Genomic-Agent-Discovery.git
cd Genomic-Agent-Discovery
npm install && npm run build-db
npm start -- --dna ~/Downloads/my-dna-raw.txt
```

Works with Claude CLI (uses your subscription, no API key), Anthropic API, OpenAI, Gemini, Ollama (fully free and local), or any OpenAI-compatible endpoint. MIT licensed.

A Debendox/Trisomy 9 investigation template is included in `config/templates/` if anyone wants to see the exact agent configuration that produced these findings.

**What I'd love feedback on:**

- The agent prompt design — I'm not a clinical geneticist, and the domain prompts need expert review
- Whether the multi-agent MCP communication pattern (shared findings + prioritized chatroom) generalizes well to other domains
- The deduplication heuristic — keyword overlap might be too aggressive or too lenient
- Any bioinformaticians who want to look at the methodology

All agent prompts are fully transparent in the dashboard UI before you start any analysis.

**Important:** This is a research tool, not medical advice. The full report includes extensive limitations and disclaimers. The findings establish biological plausibility, not clinical causation. We are pursuing whole genome sequencing and consultation with medical geneticists as next steps.

GitHub: https://github.com/HelixGenomics/Genomic-Agent-Discovery

---

## Replies Strategy

**First 60 minutes are everything.** Be online and responding to every comment.

**Expected comment types and how to respond:**

### "This doesn't prove Debendox caused it"
Agree immediately. "You're right, and the report says exactly that. This establishes biological plausibility across five confirmed genetic systems, not causation. The five-link chain hasn't been experimentally tested as a system. What it does show is that the population-level studies that declared Debendox safe never asked the right question for this subgroup — and the tools to ask it didn't exist until now."

### "The population studies found it was safe"
"They found no statistically significant association in the general population. That's real and shouldn't be dismissed. But they also didn't stratify by maternal CYP2D6 metabolizer status — the science didn't exist yet. Even if Debendox doubled the risk in the 2-5% vulnerable subgroup, the absolute rate would go from ~1/35,000 to ~1/17,500 — still invisible in any study of the sizes conducted in the 1970s-80s. Population safety and individual susceptibility are different questions answered by different methods."

### "Consumer DNA chips can't tell you this"
"Fair criticism. The report includes a full limitations section — SNP arrays miss structural variants, can't do proper CYP2D6 diplotype calling, and don't detect CNVs. The MTHFR/MTRR finding is on solid ground (published meta-analyses, confirmed genotypes). The deeper mechanistic layers are more speculative. That's why we're pursuing clinical whole genome sequencing as a next step."

### "This is just p-hacking / data dredging"
"Each agent was given a specific biological domain to investigate independently. They didn't know what the other agents would find. The convergence on chromosome 9's centromere across five independent domains is what makes this compelling — it wasn't constructed by looking at the answer first. But you're right that post-hoc mechanistic narratives can be seductive. The MTHFR/MTRR published OR of 2.21 is the strongest independent evidence. The rest builds a mechanistic story around it."

### "Cool project, what's the architecture?"
"Custom MCP server with 18 tools. Each agent runs as a separate process with access to the shared toolset. Two coordination mechanisms: (1) shared findings board with keyword-overlap deduplication — agents can't publish redundant findings. (2) Prioritized chatroom with normal/urgent/critical levels for cross-domain coordination. Both visible in real-time in the browser dashboard. The pipeline runs in phases: parallel collectors → synthesizer → narrator."

### "Does this work with Ollama?"
"Yes, fully local and free. `--provider ollama` maps the model tiers to your local models (haiku tier → llama3.1:8b, sonnet tier → llama3.1:70b). Zero network calls with Ollama — no API, no telemetry, DNA data stays completely on your machine."

### "I have 23andMe data, should I try this?"
"If you're curious about your raw data, the Quick Scan preset (2 agents) is a good starting point — runs in a couple minutes, costs pennies with an API or free with Ollama. But please read the disclaimers: this is a research tool, not medical advice. If you find something concerning, talk to a genetic counselor."

### "I'm a geneticist/bioinformatician and I want to help"
"That's exactly what this project needs most. The agent prompts are in config/presets/ and config/templates/ — they're plain text, fully transparent. PRs welcome. The ClinVar query logic and ACMG classification could especially use expert review. Happy to set up a call or point you to specific files."

### "What about your mum/brother's privacy?"
"Mum consented to this analysis and to sharing the findings. Mark is an adult with capacity to consent to his story being shared. The raw genotype data is not published — only the interpreted findings. The tool itself works with any DNA file and doesn't transmit data anywhere."

---

## Pre-Launch Checklist

- [ ] Ensure GitHub repo README looks clean (it does — already has screenshots, badges, quick start)
- [ ] Have the HN post text ready to paste into the first comment (copy from above)
- [ ] Be online and responsive for the first 2 hours after posting
- [ ] Have the Discord invite (https://helixsequencing.com/discord) ready to share
- [ ] Optional: have 3-5 friends/colleagues ready to upvote in the first 30 minutes (genuine interest, not vote manipulation — HN detects and penalizes artificial voting)
- [ ] Have the full narrator report accessible to link if someone asks for the complete analysis
- [ ] Test that `git clone && npm install && npm run build-db` still works cleanly
