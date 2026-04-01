import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import yaml from 'js-yaml'
import './App.css'
// ── Inline Setup Panel ────────────────────────────────────────────────────────

const PRESETS = [
  { id: 'quick-scan', icon: '⚡', name: 'Quick Scan', desc: 'Fast overview across all domains', cost: '$0.05–0.10', time: '2–4 min', color: '#06b6d4',
    agentList: [
      { id: 'general-scanner', label: 'General Health Scanner', model: 'haiku',
        prompt: `You are performing a rapid whole-genome health overview. Cover ALL major domains at a surface level rather than going deep on any one area.\n\nWORKFLOW:\n1. Start with get_all_pharmacogenomics for the full PGx panel\n2. Query the top 5-10 most clinically important genes per domain:\n   - Cancer: BRCA1, BRCA2, TP53, APC, MLH1\n   - Cardio: LDLR, APOB, PCSK9, SCN5A, MYH7\n   - Neuro: APOE, LRRK2, GBA\n   - Metabolic: HFE, TCF7L2, FTO\n   - Coagulation: F5, F2, MTHFR\n3. Check GWAS for any high-significance associations\n4. Note anything flagged as pathogenic or likely pathogenic\n\nFocus on ACTIONABLE findings. Skip common benign variants. Publish your 5 most important findings across all domains.` },
      { id: 'narrator', label: 'Quick Report Writer', model: 'haiku',
        prompt: `Write a concise genomic health overview based on the scan findings. Keep it short and practical.\n\nStructure:\n1. Key Findings (bullet points, most important first)\n2. Pharmacogenomics Summary (brief metabolizer table)\n3. Areas Flagged for Deeper Analysis\n4. Disclaimer\n\nIf nothing significant was found, say so clearly. Keep the entire report under 2 pages. No fluff.` },
    ]},
  { id: 'cancer-research', icon: '🔬', name: 'Cancer Research', desc: 'Deep cancer & tumor genetics', cost: '$0.50–2.00', time: '10–20 min', color: '#f43f5e',
    agentList: [
      { id: 'cancer-collector', label: 'Cancer & Tumor Genetics', model: 'haiku',
        prompt: `You are a cancer genomics specialist. Focus on: tumor suppressor genes (TP53, BRCA1/2, APC), DNA repair pathways (BRCA1, BRCA2, PALB2, RAD51), mismatch repair genes (MLH1, MSH2, MSH6, PMS2), and cancer predisposition syndromes (Lynch, Li-Fraumeni, FAP).\n\nUse query_gene to investigate key cancer genes. Use query_civic for clinical cancer variant evidence. Cross-reference with ClinVar and GWAS. Pay special attention to pathogenic and likely-pathogenic variants in high-penetrance cancer genes.\n\nPublish your 3-5 most significant findings.` },
      { id: 'dpyd-safety', label: 'DPYD Safety Agent', model: 'haiku',
        prompt: `You are a specialist in DPYD-related fluoropyrimidine toxicity. Investigate DPYD variants that cause severe or fatal toxicity to 5-fluorouracil and capecitabine.\n\nAnalyze: DPYD*2A (c.1905+1G>A), c.2846A>T, c.1679T>G (DPYD*13), c.1236G>A/HapB3. Classify as normal, intermediate, or poor metabolizer. Provide CPIC-based dosing recommendations.\n\nAlso check DPYS and TYMS variants. Publish 2-3 findings with clear clinical action items.` },
      { id: 'platinum-chemo', label: 'Platinum Chemotherapy', model: 'haiku',
        prompt: `Analyze genetic variants affecting response to platinum-based chemotherapy (cisplatin, carboplatin, oxaliplatin).\n\nFocus on: ERCC1/2 (nucleotide excision repair), GSTP1 (glutathione metabolism), ABCB1/ABCC2 (drug efflux), BRCA1/2 (homologous recombination, PARP inhibitor eligibility), XPC, XPD.\n\nNote any variants indicating increased sensitivity, resistance, or neuropathy risk. Publish 2-3 actionable findings.` },
      { id: 'immunotherapy', label: 'Immunotherapy Markers', model: 'haiku',
        prompt: `Analyze genetic markers relevant to cancer immunotherapy response.\n\nFocus on: HLA alleles (HLA-A, HLA-B, HLA-C — relevant to immune checkpoint response), CD274/PD-L1, CTLA4, JAK1/2, STAT3, tumor microenvironment genes.\n\nAssess whether the patient's immune genetics suggest likely response or resistance to checkpoint inhibitors (anti-PD-1, anti-CTLA4). Note any autoimmunity risk alleles relevant to irAE prediction.\n\nPublish 2-4 findings.` },
      { id: 'targeted-therapy', label: 'Targeted Therapy', model: 'haiku',
        prompt: `Investigate germline variants that may influence eligibility or response to targeted cancer therapies.\n\nFocus on: BRCA1/2 (PARP inhibitors — olaparib, rucaparib), ATM/CHEK2 (ATR inhibitors), PTEN (PI3K pathway), RET (RET inhibitors), NTRK fusions (entrectinib), MET amplification, FGFR alterations.\n\nAlso review any variants in AKT1, PIK3CA, and mTOR pathway genes. Publish 2-3 findings with specific targeted therapy relevance.` },
      { id: 'synthesizer', label: 'Cancer Synthesizer', model: 'sonnet',
        prompt: `You are a clinical cancer genomics synthesizer. Read ALL findings from the collector agents and:\n\n1. Identify multi-hit cancer risk patterns (e.g. BRCA2 VUS + CHEK2 pathogenic = compound risk)\n2. Cross-reference cancer risk with pharmacogenomics implications\n3. Assess hereditary cancer syndrome criteria (Lynch, HBOC, Li-Fraumeni, FAP)\n4. Identify variants qualifying for targeted therapy or clinical trials\n5. Prioritize findings by clinical actionability\n\nPublish a structured synthesis with clear risk stratification.` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a comprehensive cancer genetics report.\n\nStructure:\n1. Executive Summary (headline risk findings)\n2. High-Penetrance Gene Results (BRCA1/2, TP53, APC, MLH1, etc.)\n3. Moderate-Penetrance Genes (CHEK2, ATM, PALB2)\n4. Hereditary Cancer Syndrome Assessment\n5. Pharmacogenomics for Oncology Drugs\n6. DNA Repair & Treatment Sensitivity\n7. Recommended Next Steps (genetic counseling, additional testing)\n8. Methodology & Limitations\n\nIMPORTANT: This is NOT a diagnosis. Include appropriate disclaimers.` },
    ]},
  { id: 'cardiovascular', icon: '❤️', name: 'Cardiovascular', desc: 'Heart & vascular genetic risk', cost: '$0.30–1.00', time: '8–15 min', color: '#f97316',
    agentList: [
      { id: 'cardio-collector', label: 'Cardiovascular Genetics', model: 'haiku',
        prompt: `You are a cardiovascular genetics specialist. Focus on three major areas:\n\n1. LIPID METABOLISM: Familial hypercholesterolemia genes (LDLR, APOB, PCSK9), lipoprotein(a) (LPA), and statin response (HMGCR, SLCO1B1).\n\n2. STRUCTURAL HEART: Cardiomyopathy genes (MYH7, MYBPC3, TNNT2, TNNI3, LMNA, TTN), dilated cardiomyopathy, and ARVC genes (PKP2, DSP, DSG2).\n\n3. ARRHYTHMIAS: Long QT syndrome (KCNQ1, KCNH2, SCN5A), Brugada syndrome (SCN5A), and catecholaminergic polymorphic VT (RYR2).\n\nPublish your 3-5 most significant findings.` },
      { id: 'lipid-collector', label: 'Lipid & Cholesterol', model: 'haiku',
        prompt: `Specialist in lipid genetics. Investigate:\n\n1. Familial hypercholesterolemia (LDLR, APOB, PCSK9) — score FH likelihood\n2. Lipoprotein(a): LPA kringle repeat variants\n3. Statin response: SLCO1B1 (myopathy risk), HMGCR, CYP3A4/5\n4. HDL metabolism: ABCA1, APOA1, CETP, LIPC\n5. Hypertriglyceridemia: LPL, APOC2, APOA5, GPIHBP1\n\nClassify overall lipid genetic risk. Note any variants qualifying for PCSK9 inhibitor eligibility. Publish 3-4 findings.` },
      { id: 'arrhythmia-agent', label: 'Arrhythmia Risk', model: 'haiku',
        prompt: `Investigate genetic risk for cardiac arrhythmias.\n\nFocus on:\n1. Long QT syndromes (LQT1: KCNQ1, LQT2: KCNH2, LQT3: SCN5A)\n2. Brugada syndrome (SCN5A, GPD1L, CACNA1C)\n3. Catecholaminergic polymorphic VT (RYR2, CASQ2)\n4. Atrial fibrillation risk loci (KCNQ1, PITX2, ZFHX3)\n5. Short QT syndrome (KCNQ1, KCNH2, KCNJ2)\n6. Wolff-Parkinson-White (PRKAG2)\n\nNote any variants warranting cardiology referral or ICD consideration. Publish 2-4 findings.` },
      { id: 'coagulation-agent', label: 'Coagulation Factors', model: 'haiku',
        prompt: `Specialist in coagulation and thrombophilia genetics.\n\nFocus on:\n1. Factor V Leiden (F5 c.1691G>A) and prothrombin mutation (F2 c.20210G>A)\n2. MTHFR variants (C677T, A1298C) — homocysteine metabolism\n3. Natural anticoagulant deficiencies (SERPINC1/antithrombin, PROC/protein C, PROS1/protein S)\n4. Fibrinogen variants (FGG, FGA, FGB)\n5. Anticoagulant pharmacogenomics: VKORC1, CYP2C9 (warfarin dosing)\n6. Platelet function: ITGA2B, ITGB3 (aspirin response)\n\nPublish 3-4 findings with VTE risk stratification.` },
      { id: 'synthesizer', label: 'Cardio Synthesizer', model: 'sonnet',
        prompt: `Synthesize all cardiovascular findings into an integrated risk assessment.\n\n1. Combine structural, arrhythmia, lipid, and coagulation findings\n2. Assess overall cardiovascular genetic risk tier (low/moderate/high)\n3. Identify compound risk patterns (e.g. FH + thrombophilia = very high CVD risk)\n4. Prioritize findings requiring immediate cardiology referral\n5. Note pharmacogenomic implications for cardiovascular medications\n\nPublish up to 8 synthesized findings with clear risk stratification.` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a cardiovascular genetics report.\n\nStructure:\n1. Executive Summary (headline cardiovascular risk findings)\n2. Lipid Genetics (FH assessment, statin response, Lp(a))\n3. Structural Heart Genetics (cardiomyopathy, ARVC)\n4. Arrhythmia Risk (long QT, Brugada, CPVT)\n5. Coagulation & Thrombosis (Factor V Leiden, prothrombin)\n6. Blood Pressure & Vascular Risk\n7. Cardiovascular Drug Metabolism (statins, clopidogrel, warfarin)\n8. Recommended Next Steps\n\nNote which findings warrant follow-up with a cardiologist or genetic counselor. IMPORTANT: This is NOT medical advice.` },
    ]},
  { id: 'pharmacogenomics', icon: '💊', name: 'Pharmacogenomics', desc: 'Drug metabolism & interactions', cost: '$0.20–0.80', time: '6–12 min', color: '#8b5cf6',
    agentList: [
      { id: 'cyp-collector', label: 'CYP Enzyme Panel', model: 'haiku',
        prompt: `Comprehensive analysis of cytochrome P450 enzymes — the primary drug-metabolizing enzymes.\n\nInvestigate ALL CYP genes with clinical significance:\n- CYP2D6: codeine, tramadol, antidepressants, antipsychotics, tamoxifen\n- CYP2C19: clopidogrel, PPIs, antidepressants, antifungals\n- CYP2C9: warfarin, NSAIDs, phenytoin, sulfonylureas\n- CYP3A4/3A5: statins, immunosuppressants, benzodiazepines\n- CYP2B6: methadone, bupropion, efavirenz\n- CYP1A2: clozapine, caffeine, theophylline\n- CYP2A6: nicotine metabolism\n- CYP4F2: warfarin vitamin K metabolism\n\nClassify metabolizer status for each. Start with get_all_pharmacogenomics. Publish 4-5 findings covering the most prescribed drug categories.` },
      { id: 'drug-transporter', label: 'Drug Transporters', model: 'haiku',
        prompt: `Analyze drug transporter genes that control drug absorption, distribution, and elimination.\n\nFocus on:\n1. SLCO1B1 (OATP1B1): statin myopathy risk — especially simvastatin, atorvastatin\n2. ABCG2 (BCRP): rosuvastatin, methotrexate, chemotherapy\n3. ABCB1 (P-gp/MDR1): digoxin, antiretrovirals, many chemotherapeutics\n4. ABCC2 (MRP2): methotrexate, irinotecan, statins\n5. SLC22A1 (OCT1): metformin, morphine\n6. SLC22A2 (OCT2): metformin renal clearance\n\nPublish 3-4 findings with specific drug interaction implications.` },
      { id: 'pharma-collector', label: 'Pharmacogenomics Panel', model: 'haiku',
        prompt: `Comprehensive PGx panel analysis following CPIC guidelines. Cover all 34 CPIC pharmacogenes.\n\nStart with get_all_pharmacogenomics for the full panel, then investigate any abnormal metabolizer status.\n\nFor each abnormal result:\n1. Gene name and metabolizer status (star allele if available)\n2. ALL affected drugs with CPIC evidence level\n3. Specific clinical recommendations (dose adjustments, drug alternatives)\n4. Drug-drug interaction considerations\n\nPrioritize by how commonly the affected drugs are prescribed. Publish 3-5 findings.` },
      { id: 'synthesizer', label: 'PGx Synthesizer', model: 'sonnet',
        prompt: `Synthesize all pharmacogenomic findings into a unified drug interaction profile.\n\n1. Combine CYP enzyme, transporter, and CPIC panel findings\n2. Identify cross-gene drug interactions (e.g. CYP2D6 PM + CYP2C19 PM = increased TCA toxicity)\n3. Create a priority list of drugs requiring dose adjustment or avoidance\n4. Flag any life-threatening interactions (DPYD + fluoropyrimidines, TPMT + thiopurines)\n5. Assess polypharmacy risk for common drug combinations\n\nPublish 5-8 synthesized findings organized by drug category.` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a pharmacogenomics report for use with a doctor or pharmacist.\n\nStructure:\n1. Executive Summary (most important drug interactions)\n2. Metabolizer Status Table (gene | status | key drugs affected)\n3. High-Priority Alerts (drugs to avoid or dose-adjust)\n4. Drug Categories: Pain, Antidepressants, Cardiovascular, PPIs, Anticoagulants\n5. Drug-Drug Interaction Risks\n6. Recommended Actions (print for pharmacy, genetic counseling)\n7. Methodology & Limitations\n\nUse plain language. IMPORTANT: Not medical advice — recommend discussing with a healthcare provider.` },
    ]},
  { id: 'rare-disease', icon: '🧬', name: 'Rare Disease', desc: 'Rare & orphan disease panel', cost: '$0.40–1.50', time: '10–18 min', color: '#34D399',
    agentList: [
      { id: 'metabolic-collector', label: 'Metabolic Disorders', model: 'haiku',
        prompt: `Specialist in inborn errors of metabolism. Investigate:\n\n1. Lysosomal storage diseases: GBA (Gaucher), HEXA (Tay-Sachs), GAA (Pompe), GLA (Fabry), IDUA (Hurler)\n2. Organic acid disorders: ACADM (MCAD), PAH (PKU), BTD (biotinidase)\n3. Urea cycle: ASS1, OTC, CPS1, ARG1\n4. Mitochondrial: POLG, RRM2B, SLC25A4 (nuclear genes affecting mtDNA)\n5. Metal metabolism: ATP7B (Wilson's disease), HFE (hemochromatosis), CP (aceruloplasminemia)\n6. Peroxisomal: PEX1, ABCD1 (X-ALD)\n\nFocus on variants with population frequency < 1%. Publish 3-5 findings including high-priority VUS.` },
      { id: 'neuro-collector', label: 'Neurological Conditions', model: 'haiku',
        prompt: `Investigate rare neurological genetic conditions.\n\nFocus on:\n1. Movement disorders: LRRK2, PRKN, PINK1, SNCA (Parkinson's), HTT (Huntington's)\n2. Spinocerebellar ataxias: ATXN1-3, CACNA1A (SCA6)\n3. Hereditary spastic paraplegia: SPG genes (SPAST, ATL1, REEP1)\n4. Charcot-Marie-Tooth: PMP22, MPZ, GJB1, MFN2\n5. Epilepsy genes: SCN1A, SCN2A, KCNQ2, CDKL5, PCDH19\n6. Intellectual disability: MECP2, FMR1 (check for premutation expansions)\n7. ALS/MND: SOD1, C9orf72 expansion, TARDBP, FUS\n\nPublish 3-5 findings with clinical significance and inheritance pattern.` },
      { id: 'connective-tissue', label: 'Connective Tissue', model: 'haiku',
        prompt: `Investigate rare connective tissue and skeletal disorders.\n\nFocus on:\n1. Heritable aortic aneurysm: FBN1 (Marfan), TGFBR1/2 (Loeys-Dietz), COL3A1 (vEDS), ACTA2, MYH11\n2. Ehlers-Danlos syndromes: COL5A1/2 (classical), COL3A1 (vascular), TNXB (hypermobile)\n3. Skeletal dysplasias: COL1A1/2 (osteogenesis imperfecta), FGFR3 (achondroplasia), EXT1/2 (hereditary multiple exostoses)\n4. Stickler syndrome: COL2A1, COL11A1\n5. Epidermolysis bullosa: COL7A1, KRT5, KRT14\n\nNote any variants with significant aortic dissection/rupture risk. Publish 2-4 findings.` },
      { id: 'immunology-agent', label: 'Primary Immunodeficiency', model: 'haiku',
        prompt: `Investigate primary immunodeficiency diseases (PID) and innate immune gene variants.\n\nFocus on:\n1. Humoral: BTK (X-linked agammaglobulinemia), IGHM, IGLL1, CD79A/B, BLNK\n2. Combined: ADA, RAG1/2, DCLRE1C (Artemis), IL7R, JAK3, IL2RG (SCID genes)\n3. Phagocyte: CYBB, NCF1/2/4 (CGD), ELANE (neutropenia), G6PC3\n4. Complement: C1Q/R/S, C2, C3, C4, CFB, CFH, CFHR1-5\n5. Autoinflammatory: MEFV (FMF), NLRP3 (CAPS), MVK (HIDS), TNFRSF1A (TRAPS)\n6. Immunodysregulation: FOXP3, IL2RA, LRBA, CTLA4\n\nPublish 2-4 findings with infection susceptibility or autoimmunity risk implications.` },
      { id: 'rare-cancer', label: 'Rare Cancer Syndromes', model: 'haiku',
        prompt: `Investigate rare hereditary cancer syndromes beyond the common BRCA/Lynch spectrum.\n\nFocus on:\n1. PTEN hamartoma tumor syndrome (PTEN) — Cowden, Bannayan-Riley-Ruvalcaba\n2. MEN syndromes (MEN1, RET, CDKN1B) — pituitary, pancreatic, adrenal\n3. von Hippel-Lindau (VHL) — hemangioblastomas, RCC, pheochromocytoma\n4. Neurofibromatosis (NF1, NF2, SMARCB1) — neurofibromas, acoustic neuromas\n5. Tuberous sclerosis (TSC1, TSC2) — hamartomas across multiple organs\n6. Hereditary paraganglioma (SDHA/B/C/D, MAX, TMEM127)\n7. BAP1 tumor predisposition (BAP1) — uveal melanoma, mesothelioma\n8. Constitutional mismatch repair deficiency (biallelic MMR variants)\n\nPublish 2-4 findings with organ-specific surveillance recommendations.` },
      { id: 'synthesizer', label: 'Rare Disease Synthesizer', model: 'sonnet',
        prompt: `Synthesizing findings from a rare disease investigation requires careful, nuanced reasoning.\n\n1. Review ALL findings from all collector agents\n2. Look for PATTERNS across multiple variants pointing to a unifying diagnosis\n3. Assess compound heterozygosity potential (two variants in same recessive gene)\n4. Cross-reference VUS findings with phenotypic implications\n5. Identify which VUS findings warrant clinical confirmation\n6. Check if combinations of moderate-effect variants create clinically significant phenotypes\n\nFor each synthesized finding, state: confidence level, whether clinical confirmation is recommended, and what specialist should evaluate.\n\nPublish up to 10 synthesized findings.` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a comprehensive rare disease genetics report for use with a geneticist.\n\nStructure:\n1. Executive Summary\n2. Pathogenic & Likely Pathogenic Variants\n3. Variants of Uncertain Significance (VUS) — Prioritized\n   - High-priority VUS (strong computational evidence)\n   - Moderate-priority VUS (some evidence)\n4. Compound Heterozygosity Analysis\n5. Rare Disease Gene Panel Results by System\n6. Pharmacogenomics for Rare Disease Treatment\n7. Recommended Clinical Follow-Up (genetic counseling, confirmatory testing, specialist referrals)\n8. Methodology, Databases Used & Limitations\n\nFor VUS, explain WHY each is flagged. Include AlphaMissense scores, CADD scores, and population frequencies. IMPORTANT: VUS requires clinical confirmation. This report is for discussion with a qualified geneticist.` },
    ]},
  { id: 'custom', icon: '⚙️', name: 'Custom', desc: 'Build your own agent pipeline', cost: 'varies', time: 'varies', color: '#9ca3af',
    agentList: [] },
]

function SetupPanel({ onStarted }) {
  const [dnaPath, setDnaPath] = useState('')
  const [preset, setPreset] = useState('quick-scan')
  const [model, setModel] = useState('haiku')
  const [costLimit, setCostLimit] = useState('10')
  const [temperature, setTemperature] = useState('0.3')
  const [maxToolCalls, setMaxToolCalls] = useState('100')
  const [checkMessages, setCheckMessages] = useState('7')
  const [webSearch, setWebSearch] = useState(true)
  const [medHistory, setMedHistory] = useState('')
  const [saveMd, setSaveMd] = useState(true)
  const [mdOutputDir, setMdOutputDir] = useState('MD_DOCS')
  const [customAgents, setCustomAgents] = useState([
    { id: 'custom-agent-1', label: 'Custom Agent', model: 'haiku', prompt: '' }
  ])
  const [expandedPrompts, setExpandedPrompts] = useState({})
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [chipInfo, setChipInfo] = useState(null)
  const [chipLoading, setChipLoading] = useState(false)
  const [agentEdits, setAgentEdits] = useState({})
  const [dbStatus, setDbStatus] = useState(null)
  const [dbExpanded, setDbExpanded] = useState(false)
  const [importNotice, setImportNotice] = useState('')
  const fileRef = useRef(null)
  const importRef = useRef(null)
  function getAgentSetting(agentId, key, fallback) {
    return agentEdits[agentId]?.[key] ?? fallback
  }
  function setAgentSetting(agentId, key, value) {
    setAgentEdits(prev => ({ ...prev, [agentId]: { ...prev[agentId], [key]: value } }))
  }

  function togglePrompt(id) {
    setExpandedPrompts(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Fetch database status on mount
  useEffect(() => {
    fetch('/api/db-status').then(r => r.json()).then(setDbStatus).catch(() => {})
  }, [])

  // Export current config as template JSON
  function exportTemplate() {
    const selectedPreset = PRESETS.find(p => p.id === preset)
    const agents = preset === 'custom'
      ? customAgents.filter(a => a.id && a.prompt)
      : (selectedPreset?.agentList || []).map(a => ({
          ...a,
          prompt: agentEdits[a.id]?.prompt ?? a.prompt,
          model: agentEdits[a.id]?.model ?? a.model,
          maxToolCalls: agentEdits[a.id]?.maxToolCalls ?? undefined,
        }))
    const template = {
      helixTemplate: '1.0',
      name: selectedPreset?.name || 'Custom Template',
      description: selectedPreset?.desc || '',
      basePreset: preset,
      agents: agents.map(a => ({ id: a.id, label: a.label, model: a.model, role: a.role || (a.id.includes('narrator') ? 'narrator' : a.id.includes('synth') ? 'synthesizer' : 'collector'), prompt: a.prompt, maxToolCalls: a.maxToolCalls })),
      settings: { defaultModel: model, costLimit: parseFloat(costLimit), temperature: parseFloat(temperature), maxToolCalls: parseInt(maxToolCalls), checkMessages: parseInt(checkMessages), webSearch },
      medicalHistory: medHistory,
    }
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `helix-template-${preset}-${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  // Import a template JSON file
  // Convert a YAML preset to our template format
  function yamlPresetToTemplate(parsed, fileName) {
    const agents = []
    const phases = parsed?.pipeline?.phases || []
    for (const phase of phases) {
      for (const agent of (phase.agents || [])) {
        agents.push({
          id: agent.id,
          label: agent.label || agent.id,
          model: agent.model || 'haiku',
          role: agent.role || 'collector',
          prompt: agent.prompt || '',
          maxToolCalls: agent.max_tool_calls,
          focusGenes: agent.focus_genes,
          maxFindings: agent.max_findings,
        })
      }
    }
    return {
      helixTemplate: '1.0',
      name: fileName.replace(/\.(yaml|yml)$/i, '').replace(/[-_]/g, ' '),
      basePreset: 'custom',
      agents,
      settings: {
        defaultModel: parsed?.agent_defaults?.model || 'haiku',
        costLimit: parsed?.cost?.hard_limit_usd || 10,
        temperature: parsed?.agent_defaults?.temperature || 0.3,
        webSearch: parsed?.agent_defaults?.web_search ?? true,
      },
    }
  }

  function importTemplate(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        let t
        const text = reader.result
        // Detect YAML vs JSON
        if (file.name.match(/\.(yaml|yml)$/i) || text.trimStart().startsWith('#') || text.includes('pipeline:')) {
          const parsed = yaml.load(text)
          t = yamlPresetToTemplate(parsed, file.name)
        } else {
          t = JSON.parse(text)
        }
        if (!t.helixTemplate && !t.agents?.length) throw new Error('Not a valid template or preset file')
        // Check if it matches a built-in preset
        const matchPreset = PRESETS.find(p => p.id === t.basePreset && p.id !== 'custom')
        if (matchPreset && t.agents?.length) {
          setPreset(matchPreset.id)
          const edits = {}
          for (const agent of t.agents) {
            const original = matchPreset.agentList.find(a => a.id === agent.id)
            if (original) {
              const diff = {}
              if (agent.prompt && agent.prompt !== original.prompt) diff.prompt = agent.prompt
              if (agent.model && agent.model !== original.model) diff.model = agent.model
              if (agent.maxToolCalls) diff.maxToolCalls = agent.maxToolCalls
              if (Object.keys(diff).length) edits[agent.id] = diff
            }
          }
          setAgentEdits(edits)
        } else {
          setPreset('custom')
          setCustomAgents(t.agents?.map(a => ({ id: a.id, label: a.label || a.id, model: a.model || 'haiku', prompt: a.prompt || '', role: a.role })) || [])
        }
        if (t.settings) {
          if (t.settings.defaultModel) setModel(t.settings.defaultModel)
          if (t.settings.costLimit != null) setCostLimit(String(t.settings.costLimit))
          if (t.settings.temperature != null) setTemperature(String(t.settings.temperature))
          if (t.settings.maxToolCalls != null) setMaxToolCalls(String(t.settings.maxToolCalls))
          if (t.settings.checkMessages != null) setCheckMessages(String(t.settings.checkMessages))
          if (t.settings.webSearch != null) setWebSearch(t.settings.webSearch)
        }
        if (t.medicalHistory) setMedHistory(t.medicalHistory)
        setImportNotice(`Loaded: ${t.name || 'template'}`)
        setTimeout(() => setImportNotice(''), 4000)
      } catch (err) {
        setErr('Invalid template file: ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = '' // reset so same file can be re-imported
  }

  // Auto-run chip check when dnaPath changes
  useEffect(() => {
    if (!dnaPath || dnaPath.length < 3) { setChipInfo(null); return }
    const timer = setTimeout(async () => {
      setChipLoading(true); setChipInfo(null)
      try {
        const res = await fetch('/api/check-chip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dnaPath }),
        })
        const data = await res.json()
        if (res.ok) { setChipInfo(data); setErr('') }
        else setChipInfo(null)
      } catch { setChipInfo(null) }
      finally { setChipLoading(false) }
    }, 600)
    return () => clearTimeout(timer)
  }, [dnaPath])

  function onDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) setDnaPath(file.path || file.name)
  }

  async function startAnalysis() {
    if (!dnaPath.trim()) { setErr('Please enter or drop a DNA file path.'); return }
    setErr(''); setLoading(true)
    try {
      // Build per-agent overrides from single output dir
      const selectedPreset = PRESETS.find(p => p.id === preset)
      const agentList = preset === 'custom'
        ? customAgents.filter(a => a.id && a.prompt)
        : (selectedPreset?.agentList || [])
      const dir = mdOutputDir.trim().replace(/\/$/, '')
      const baseOverrides = saveMd
        ? Object.fromEntries(agentList.map(a => [a.id, { mdOutputPath: dir ? `${dir}/${a.id}.md` : `${a.id}.md` }]))
        : {}
      // Merge per-agent setting edits into overrides
      const agentOverrides = { ...baseOverrides }
      for (const [agentId, edits] of Object.entries(agentEdits)) {
        agentOverrides[agentId] = { ...agentOverrides[agentId], ...edits }
      }

      const res = await fetch('/api/start-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dnaPath: dnaPath.trim(),
          preset,
          settings: {
            defaultModel: model,
            costLimit: parseFloat(costLimit) || 10,
            temperature: parseFloat(temperature) || 0.3,
            maxToolCalls: parseInt(maxToolCalls) || 100,
            checkMessages: parseInt(checkMessages) || 7,
            webSearch,
            medicalHistory: medHistory,
          },
          agentOverrides,
          customAgents: preset === 'custom' ? customAgents.filter(a => a.id && a.prompt) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start')
      onStarted()
    } catch (e) {
      setErr(e.message)
      setLoading(false)
    }
  }

  return (
    <div className="setup-panel">
      <div className="setup-logo">
        <HelixLogo />
        <span>Helix Genomics</span>
      </div>
      <p className="setup-sub">Configure your analysis below, then hit Start.</p>

      {/* DNA File */}
      <div className="setup-section">
        <div className="setup-label">DNA File</div>
        <div
          className={`setup-drop${dnaPath ? ' has-file' : ''}`}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          {dnaPath
            ? <><span className="setup-drop-icon">✓</span><span className="setup-drop-name">{dnaPath.split('/').pop()}</span></>
            : <><span className="setup-drop-icon">↑</span><span>Drop DNA file here or click to browse</span><span className="setup-drop-hint">23andMe · AncestryDNA · MyHeritage · VCF</span></>
          }
        </div>
        <input ref={fileRef} type="file" style={{ display: 'none' }} accept=".txt,.csv,.vcf,.gz,.zip"
          onChange={e => { if (e.target.files?.[0]) setDnaPath(e.target.files[0].path || e.target.files[0].name) }} />
        <input className="setup-input" placeholder="Or paste full file path…" value={dnaPath}
          onChange={e => setDnaPath(e.target.value)} />

        {/* Chip Detection Results */}
        {chipLoading && (
          <div style={{
            marginTop: '12px', padding: '14px 18px',
            background: 'rgba(94,234,212,0.04)', border: '1px solid rgba(94,234,212,0.15)',
            borderRadius: '12px', fontSize: '13px', color: '#94a3b8',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>🧬</span>
            Analyzing your DNA file...
          </div>
        )}
        {chipInfo && !chipLoading && (
          <div style={{
            marginTop: '12px', padding: '18px',
            background: 'rgba(94,234,212,0.04)', border: '1px solid rgba(94,234,212,0.15)',
            borderRadius: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '20px' }}>🧬</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                  {chipInfo.provider} — {chipInfo.chipVersion}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {chipInfo.sex} · {chipInfo.format}{chipInfo.build ? ` · ${chipInfo.build}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              <div style={{
                background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.15)',
                borderRadius: '10px', padding: '10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#2DD4BF' }}>{chipInfo.snpCount?.toLocaleString()}</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>SNPs on Chip</div>
              </div>
              <div style={{
                background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.15)',
                borderRadius: '10px', padding: '10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#5EEAD4' }}>~{(chipInfo.estimatedImputedSnps / 1000000).toFixed(1)}M</div>
                <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>After Imputation</div>
              </div>
              <div style={{
                background: 'rgba(0,230,138,0.06)', border: '1px solid rgba(0,230,138,0.15)',
                borderRadius: '10px', padding: '10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 900, color: chipInfo.noCallRate < 0.03 ? '#00e68a' : '#ffd166' }}>
                  {(chipInfo.noCallRate * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>No-Call Rate</div>
              </div>
            </div>
            <div style={{
              padding: '10px 14px', background: 'rgba(45,212,191,0.06)',
              border: '1px solid rgba(45,212,191,0.12)', borderRadius: '10px',
              fontSize: '12px', color: '#e2e8f0', lineHeight: 1.5,
            }}>
              💡 {chipInfo.recommendation}
            </div>
          </div>
        )}
      </div>

      {/* Database Status */}
      {dbStatus && (
        <div className="setup-section">
          <button className="setup-db-toggle" onClick={() => setDbExpanded(v => !v)}>
            <span className="setup-label" style={{ margin: 0 }}>Annotation Databases</span>
            <span className="setup-db-summary">
              {dbStatus.ok ? (
                <>
                  <span className="setup-db-dot loaded" />
                  {dbStatus.databases.filter(d => d.rows > 0).length}/{dbStatus.databases.length} loaded
                  <span className="setup-db-sep">·</span>
                  {(dbStatus.totalRows / 1000000).toFixed(1)}M rows
                  <span className="setup-db-sep">·</span>
                  {(dbStatus.dbSize / 1024 / 1024 / 1024).toFixed(1)}GB
                </>
              ) : (
                <><span className="setup-db-dot empty" /> Not built — run <code>npm run build-db</code></>
              )}
            </span>
            <span className="setup-prompt-chevron">{dbExpanded ? '▲' : '▼'}</span>
          </button>
          {dbExpanded && dbStatus.databases && (
            <div className="setup-db-grid">
              {dbStatus.databases.map(db => (
                <div key={db.table} className={`setup-db-item ${db.status}`}>
                  <span className="setup-db-name">{db.name}</span>
                  <span className="setup-db-rows">{db.rows > 0 ? db.rows.toLocaleString() : '—'}</span>
                  <span className="setup-db-desc">{db.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preset */}
      <div className="setup-section">
        <div className="setup-label">Analysis Preset</div>
        <div className="setup-presets">
          {PRESETS.map(p => (
            <button
              key={p.id}
              className={`setup-preset${preset === p.id ? ' active' : ''}`}
              style={preset === p.id ? { borderColor: p.color, background: `${p.color}14` } : {}}
              onClick={() => setPreset(p.id)}
            >
              <span className="setup-preset-icon">{p.icon}</span>
              <span className="setup-preset-name">{p.name}</span>
              <span className="setup-preset-desc">{p.desc}</span>
              <span className="setup-preset-meta">{p.agentList.length} agents · {p.cost} · {p.time}</span>
            </button>
          ))}
        </div>
        <div className="setup-template-bar">
          <button className="setup-template-btn" onClick={() => importRef.current?.click()}>Import Template</button>
          <button className="setup-template-btn" onClick={exportTemplate}>Export Template</button>
          <input ref={importRef} type="file" accept=".json,.yaml,.yml" style={{ display: 'none' }} onChange={importTemplate} />
          {importNotice && <span className="setup-template-notice">{importNotice}</span>}
        </div>
      </div>

      {/* Custom agent builder */}
      {preset === 'custom' && (
        <div className="setup-section">
          <div className="setup-label">Custom Agents</div>
          <div className="setup-agent-outputs">
            {customAgents.map((agent, i) => (
              <div key={i} className="setup-custom-agent">
                <div className="setup-custom-agent-header">
                  <input className="setup-input" placeholder="Agent ID (e.g. drug-metabolism)" value={agent.id}
                    onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, id: e.target.value} : a))} />
                  <input className="setup-input" placeholder="Label" value={agent.label}
                    onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, label: e.target.value} : a))} />
                  <select className="setup-select" value={agent.model}
                    onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, model: e.target.value} : a))}>
                    <option value="haiku">Haiku</option>
                    <option value="sonnet">Sonnet</option>
                    <option value="opus">Opus</option>
                  </select>
                  <button className="btn-custom-agent-remove" onClick={() => setCustomAgents(prev => prev.filter((_, j) => j!==i))}>✕</button>
                </div>
                <textarea className="setup-textarea" placeholder="Research prompt for this agent…" value={agent.prompt}
                  onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, prompt: e.target.value} : a))} />
              </div>
            ))}
            <button className="btn-add-custom-agent" onClick={() => setCustomAgents(prev => [...prev,
              { id: `custom-agent-${prev.length+1}`, label: '', model: 'haiku', prompt: '' }
            ])}>+ Add Agent</button>
          </div>
        </div>
      )}

      {/* Preset agent prompts — editable with tier grouping */}
      {preset !== 'custom' && (() => {
        const selectedPreset = PRESETS.find(p => p.id === preset)
        if (!selectedPreset?.agentList?.length) return null
        // Group agents by tier based on role/id patterns
        const getTier = (a) => {
          if (a.role === 'narrator' || a.id.includes('narrator') || a.id.includes('report')) return 3
          if (a.role === 'synthesizer' || a.id.includes('synth')) return 2
          return 1
        }
        const tierLabels = { 1: 'Collection', 2: 'Synthesis', 3: 'Report' }
        const tierColors = { 1: '#06b6d4', 2: '#8b5cf6', 3: '#f59e0b' }
        const tierModels = { 1: 'haiku', 2: 'sonnet', 3: 'haiku' }
        const grouped = {}
        for (const agent of selectedPreset.agentList) {
          const tier = getTier(agent)
          if (!grouped[tier]) grouped[tier] = []
          grouped[tier].push(agent)
        }
        return (
          <div className="setup-section">
            <div className="setup-label">Agent Pipeline <span className="setup-opt">— click to expand & edit prompts</span></div>
            <div className="setup-agent-prompts">
              {Object.entries(grouped).sort(([a],[b]) => a - b).map(([tier, agents]) => (
                <div key={tier}>
                  <div className="setup-tier-label" style={{ borderLeftColor: tierColors[tier] }}>
                    Tier {tier}: {tierLabels[tier]}
                    <span className="setup-tier-meta">default: {tierModels[tier]} · {agents.length} agent{agents.length > 1 ? 's' : ''}</span>
                  </div>
                  {agents.map(agent => {
                    const editedPrompt = agentEdits[agent.id]?.prompt
                    const editedModel = agentEdits[agent.id]?.model
                    const isEdited = editedPrompt != null || editedModel != null
                    return (
                      <div key={agent.id} className={`setup-prompt-row${expandedPrompts[agent.id] ? ' expanded' : ''}${isEdited ? ' edited' : ''}`}>
                        <button className="setup-prompt-toggle" onClick={() => togglePrompt(agent.id)}>
                          <span className="setup-prompt-label">{agent.label}</span>
                          <span className="setup-prompt-model">{editedModel || agent.model}</span>
                          {isEdited && <span className="setup-prompt-edited">edited</span>}
                          <span className="setup-prompt-chevron">{expandedPrompts[agent.id] ? '▲' : '▼'}</span>
                        </button>
                        {expandedPrompts[agent.id] && (
                          <div className="setup-prompt-edit-area">
                            <div className="setup-prompt-controls">
                              <select className="setup-select setup-select-sm" value={editedModel || agent.model}
                                onChange={e => setAgentSetting(agent.id, 'model', e.target.value === agent.model ? undefined : e.target.value)}>
                                <option value="haiku">haiku</option>
                                <option value="sonnet">sonnet</option>
                                <option value="opus">opus</option>
                              </select>
                              {isEdited && (
                                <button className="setup-prompt-reset" onClick={() => setAgentEdits(prev => { const next = {...prev}; delete next[agent.id]; return next })}>
                                  Reset
                                </button>
                              )}
                            </div>
                            <textarea
                              className="setup-textarea setup-prompt-textarea"
                              rows={8}
                              value={editedPrompt ?? agent.prompt ?? ''}
                              onChange={e => setAgentSetting(agent.id, 'prompt', e.target.value === agent.prompt ? undefined : e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Output directory — shared for all agents */}
      <div className="setup-section">
        <div className="setup-label-row">
          <label className="setup-agent-output-check">
            <input type="checkbox" checked={saveMd} style={{ accentColor: 'var(--green)' }}
              onChange={e => setSaveMd(e.target.checked)} />
            <span className="setup-output-label">Save agent outputs as <code>.md</code></span>
          </label>
        </div>
        {saveMd && (
          <input className="setup-input" style={{ marginTop: 6 }}
            value={mdOutputDir} onChange={e => setMdOutputDir(e.target.value)} />
        )}
        {saveMd && (
          <div className="setup-dir-preview">
            {(() => {
              const agents = preset === 'custom'
                ? customAgents.filter(a => a.id)
                : PRESETS.find(p => p.id === preset)?.agentList || []
              const prefix = mdOutputDir.trim() ? mdOutputDir.trim().replace(/\/$/, '') + '/' : './'
              return agents.map(a => (
                <span key={a.id} className="setup-dir-file">{prefix}{a.id}.md</span>
              ))
            })()}
          </div>
        )}
      </div>

      {/* Settings row */}
      <div className="setup-section setup-row">
        <div className="setup-field">
          <div className="setup-label">Default Model</div>
          <select className="setup-select" value={model} onChange={e => setModel(e.target.value)}>
            <option value="haiku">Haiku — fast &amp; cheap</option>
            <option value="sonnet">Sonnet — balanced</option>
            <option value="opus">Opus — most capable</option>
          </select>
        </div>
        <div className="setup-field">
          <div className="setup-label">Cost Limit (USD)</div>
          <input className="setup-input" type="number" min="0.5" step="0.5" value={costLimit}
            onChange={e => setCostLimit(e.target.value)} />
        </div>
        <div className="setup-field">
          <div className="setup-label">Temperature</div>
          <input className="setup-input" type="number" min="0" max="1" step="0.05"
            value={temperature} onChange={e => setTemperature(e.target.value)} />
        </div>
        <div className="setup-field">
          <div className="setup-label">Max Tool Calls / Agent</div>
          <input className="setup-input" type="number" min="10" max="500" step="10"
            value={maxToolCalls} onChange={e => setMaxToolCalls(e.target.value)} />
        </div>
        <div className="setup-field">
          <div className="setup-label">Check Messages Every</div>
          <input className="setup-input" type="number" min="1" max="20" step="1"
            value={checkMessages} onChange={e => setCheckMessages(e.target.value)} />
        </div>
        <div className="setup-field setup-field-toggle">
          <div className="setup-label">Web Search</div>
          <button className={`setup-toggle${webSearch ? ' on' : ''}`} onClick={() => setWebSearch(v => !v)}>
            {webSearch ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="setup-section">
        <div className="setup-label">Medical History <span className="setup-opt">(optional)</span></div>
        <textarea className="setup-textarea" rows={2} placeholder="e.g. 45-year-old female, family history of breast cancer, currently on statins…"
          value={medHistory} onChange={e => setMedHistory(e.target.value)} />
      </div>

      {err && <div className="setup-error">{err}</div>}

      <button className="setup-start" onClick={startAnalysis} disabled={loading}>
        {loading ? 'Starting…' : '▶  Start Analysis'}
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jobIdFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('jobId') || null
}

function fmtTime(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function fmtAge(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const secs = Math.floor((Date.now() - d) / 1000)
  if (secs < 0) return ''
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

const SIG_ORDER = ['high', 'moderate', 'drug_response', 'protective', 'low', 'other']

function sigClass(cat) {
  if (!cat) return 'sig-other'
  const c = cat.toLowerCase()
  if (c === 'high' || c === 'pathogenic') return 'sig-high'
  if (c === 'moderate' || c === 'likely_pathogenic') return 'sig-moderate'
  if (c.includes('drug') || c.includes('pharma')) return 'sig-drug'
  return 'sig-other'
}

function sigLabel(cat) {
  if (!cat) return 'other'
  const c = cat.toLowerCase()
  if (c === 'high' || c === 'pathogenic') return 'High'
  if (c === 'moderate' || c === 'likely_pathogenic') return 'Moderate'
  if (c.includes('drug') || c.includes('pharma')) return 'Drug'
  return 'Other'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HelixLogo({ size = 32 }) {
  return <img src="/helix-logo.png" alt="Helix" width={size} height={size} style={{ objectFit: 'contain' }} />
}

function StatusDot({ status }) {
  const cls = status === 'spawning' ? 'spawning'
    : status === 'running' ? 'running'
    : status === 'done' ? 'done'
    : status === 'error' ? 'error'
    : 'waiting'
  return <span className={`dot ${cls}`} />
}

function StatusPill({ status }) {
  const map = {
    running: { cls: 'running', label: 'Running' },
    complete: { cls: 'complete', label: 'Complete' },
    error: { cls: 'error', label: 'Error' },
    'partial-error': { cls: 'error', label: 'Partial Error' },
    waiting: { cls: 'waiting', label: 'Waiting' },
    idle: { cls: 'idle', label: 'Idle' },
  }
  const { cls, label } = map[status] || map.idle
  return (
    <span className={`status-pill ${cls}`}>
      <StatusDot status={cls === 'running' ? 'running' : cls === 'complete' ? 'done' : cls === 'error' ? 'error' : 'waiting'} />
      {label}
    </span>
  )
}

function AgentCard({ agent, selected, onClick, onViewMd }) {
  const { id, label, model, status, lastActivity, logSize, hasMd, mdPath } = agent
  const cardCls = [
    'agent-card',
    `status-${status || 'waiting'}`,
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ')

  const modelShort = model
    ? model.replace('claude-', '').replace('-20251001', '').replace('-20240229', '')
    : '—'

  return (
    <div className={cardCls} onClick={() => onClick(id)}>
      <div className="agent-row">
        <StatusDot status={status || 'waiting'} />
        <span className="agent-icon">
          {status === 'done' ? '✓' : status === 'error' ? '✗' : status === 'running' || status === 'spawning' ? '⟳' : '○'}
        </span>
        <span className="agent-label">{label || id}</span>
        <span className="agent-model">{modelShort}</span>
      </div>
      <div className="agent-meta">
        {logSize != null && (
          <span className="agent-meta-item">{(logSize / 1024).toFixed(1)}kb log</span>
        )}
        {lastActivity && (
          <span className="agent-meta-item highlight">{fmtAge(lastActivity)}</span>
        )}
        {hasMd && (
          <button
            className="btn-view-md"
            title={mdPath || 'View agent output'}
            onClick={e => { e.stopPropagation(); onViewMd(id, label || id) }}
          >📄 Output</button>
        )}
      </div>
      {hasMd && mdPath && (
        <div className="agent-md-path" title={mdPath}>{mdPath.split('/').slice(-3).join('/')}</div>
      )}
    </div>
  )
}

function AgentsPanel({ agents, selectedId, onSelect, jobId }) {
  const entries = Object.entries(agents)
  const running = entries.filter(([, a]) => a.status === 'running' || a.status === 'spawning').length
  const done = entries.filter(([, a]) => a.status === 'done').length
  const [mdModal, setMdModal] = useState(null) // { title, content, path }

  function viewMd(agentId, agentLabel) {
    if (!jobId) return
    fetch(`/api/agent-md/${jobId}/${agentId}`)
      .then(r => r.json())
      .then(data => {
        if (data.content) setMdModal({ title: agentLabel, content: data.content, path: data.path })
        else setMdModal({ title: agentLabel, content: `No output yet: ${data.error || ''}`, path: null })
      })
      .catch(() => setMdModal({ title: agentLabel, content: 'Failed to load output.', path: null }))
  }

  return (
    <aside className="panel-agents">
      <div className="panel-header">
        <span className="panel-title">Agents</span>
        {entries.length > 0 && (
          <span className="panel-badge">{running > 0 ? `${running} active` : `${done}/${entries.length}`}</span>
        )}
      </div>
      {mdModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setMdModal(null)}>
          <div className="modal modal-md-output">
            <div className="modal-md-header">
              <h3>📄 {mdModal.title} — Output</h3>
              {mdModal.path && <span className="modal-md-path">{mdModal.path}</span>}
              <button className="btn-cancel" onClick={() => setMdModal(null)}>✕</button>
            </div>
            <pre className="modal-md-content">{mdModal.content}</pre>
          </div>
        </div>
      )}

      <div className="panel-body pad-sm">
        {entries.length === 0 ? (
          <div className="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9"/>
              <path d="M9 9h.01M15 9h.01M9 15s1 2 3 2 3-2 3-2"/>
            </svg>
            <span>No agents yet</span>
          </div>
        ) : (
          entries.map(([id, agent]) => (
            <AgentCard
              key={id}
              agent={{ id, ...agent }}
              selected={selectedId === id}
              onClick={onSelect}
              onViewMd={viewMd}
            />
          ))
        )}
      </div>
    </aside>
  )
}

function agentIcon(id) {
  const s = (id || '').toLowerCase()
  if (/tumor|genetic/i.test(s)) return '🧬'
  if (/dpyd|safety/i.test(s)) return '💊'
  if (/platinum|chemo/i.test(s)) return '⚗️'
  if (/immunotherap/i.test(s)) return '🔬'
  if (/target/i.test(s)) return '🎯'
  if (/drug|metaboli/i.test(s)) return '💉'
  if (/supplement/i.test(s)) return '🌿'
  if (/inflammat/i.test(s)) return '🔥'
  if (/immune/i.test(s)) return '🛡️'
  if (/dna|repair/i.test(s)) return '🔗'
  if (/neuropath/i.test(s)) return '⚡'
  if (/trial|clinical/i.test(s)) return '🏥'
  if (/synth|narrator/i.test(s)) return '📋'
  if (/novel/i.test(s)) return '🔍'
  if (/scanner|general/i.test(s)) return '🧬'
  return '🧬'
}

function shortLabel(id) {
  if (!id) return '??'
  const parts = id.split('-')
  if (parts.length >= 2) return parts.slice(0, 2).map(p => p.charAt(0).toUpperCase() + p.slice(1, 5)).join(' ')
  return id.slice(0, 8)
}

// Canvas network visualiser — ported from monitor.html
function NetworkCanvas({ agents, selectedId, chat, findings }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ particles: [], commLines: [], animFrame: 0, prevChatLen: 0, prevFindingsLen: 0 })

  // Spawn comm-line particles when new chat messages arrive
  useEffect(() => {
    const s = stateRef.current
    const ids = Object.keys(agents).sort()
    const canvas = canvasRef.current
    if (!canvas) return
    const cW = canvas.clientWidth, cH = canvas.clientHeight

    function nodePos(id) {
      const idx = ids.indexOf(id)
      if (idx < 0) return null
      const cx = cW / 2, cy = cH / 2
      const r = Math.min(cW, cH) * 0.32
      const angle = (idx / ids.length) * Math.PI * 2 - Math.PI / 2
      return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
    }

    // New chat messages → comm lines
    if (chat.length > s.prevChatLen) {
      for (let i = s.prevChatLen; i < chat.length; i++) {
        const m = chat[i]
        const from = nodePos(m.from)
        const to = nodePos(m.to)
        if (from && to) {
          const col = m.priority === 'critical' ? '#f43f5e' : m.priority === 'urgent' ? '#f59e0b' : '#06b6d4'
          s.commLines.push({ from, to, life: 1, decay: 0.012, color: col })
          for (let j = 0; j < 3; j++) {
            const t = Math.random()
            s.particles.push({
              x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t,
              vx: (to.x - from.x) * 0.02 + (Math.random() - 0.5),
              vy: (to.y - from.y) * 0.02 + (Math.random() - 0.5),
              life: 1, decay: 0.01 + Math.random() * 0.01,
              color: col, radius: 1.5 + Math.random() * 1.5, trail: []
            })
          }
        }
      }
      s.prevChatLen = chat.length
    }

    // New findings → burst particles from agent node
    if (findings.length > s.prevFindingsLen) {
      for (let i = s.prevFindingsLen; i < findings.length; i++) {
        const f = findings[i]
        const pos = nodePos(f.agent || f.from)
        if (pos) {
          const col = sigClass(f.category) === 'sig-high' ? '#f43f5e'
            : sigClass(f.category) === 'sig-moderate' ? '#f59e0b'
            : '#34D399'
          for (let j = 0; j < 8; j++) {
            s.particles.push({
              x: pos.x, y: pos.y,
              vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
              life: 1, decay: 0.007 + Math.random() * 0.008,
              color: col, radius: 2 + Math.random() * 2, trail: []
            })
          }
        }
      }
      s.prevFindingsLen = findings.length
    }
  }, [chat.length, findings.length, agents])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s = stateRef.current
    let rafId
    let dpr = window.devicePixelRatio || 1

    function resize() {
      dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    function drawHexGrid(cW, cH) {
      const size = 30, w = size * 2, h = Math.sqrt(3) * size
      ctx.save()
      ctx.strokeStyle = 'rgba(52,211,153,0.025)'
      ctx.lineWidth = 0.5
      for (let row = -1; row < cH / h + 1; row++) {
        for (let col = -1; col < cW / w + 1; col++) {
          const x = col * w * 0.75, y = row * h + (col % 2 ? h / 2 : 0)
          ctx.beginPath()
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k - Math.PI / 6
            const px = x + size * Math.cos(a), py = y + size * Math.sin(a)
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }
      ctx.restore()
    }

    function draw() {
      const cW = canvas.clientWidth, cH = canvas.clientHeight
      ctx.clearRect(0, 0, cW, cH)
      s.animFrame++

      drawHexGrid(cW, cH)

      const ids = Object.keys(agents).sort()
      const n = ids.length

      if (n === 0) {
        ctx.save()
        ctx.font = '500 14px Inter, sans-serif'
        ctx.fillStyle = 'rgba(52,211,153,0.2)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Waiting for agents…', cW / 2, cH / 2)
        ctx.font = '11px "JetBrains Mono", monospace'
        ctx.fillStyle = 'rgba(52,211,153,0.1)'
        ctx.fillText('Analysis will appear here', cW / 2, cH / 2 + 22)
        ctx.restore()
        rafId = requestAnimationFrame(draw)
        return
      }

      const cx = cW / 2, cy = cH / 2
      const minDim = Math.min(cW, cH)

      // Adaptive node size — shrink as count grows
      const nodeR = Math.max(8, Math.min(16, 20 - n * 0.35))

      // Multi-ring layout: distribute agents across concentric rings
      // Ring capacities: [8, 14, 20, 26, ...] — each ring fits ~6 more
      function buildRings(count) {
        const rings = []
        let remaining = count
        const caps = [Math.min(8, count), 14, 20, 26]
        let idx = 0
        let filled = 0
        for (const cap of caps) {
          if (remaining <= 0) break
          const inThisRing = Math.min(remaining, cap - filled)
          rings.push(inThisRing)
          remaining -= inThisRing
          filled = cap
          idx++
        }
        // If still leftover, add more rings
        while (remaining > 0) {
          const extra = Math.min(remaining, 8)
          rings.push(extra)
          remaining -= extra
        }
        return rings
      }

      const ringCounts = buildRings(n)
      const numRings = ringCounts.length
      // Outer ring radius fills ~80% of minDim/2, inner rings spaced evenly
      const outerR = minDim * 0.36
      const nodePositions = []
      let agentIdx = 0
      for (let ri = 0; ri < numRings; ri++) {
        const ringR = numRings === 1 ? outerR : outerR * (0.45 + 0.55 * (ri / (numRings - 1)))
        const count = ringCounts[ri]
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2
          nodePositions.push({ x: cx + Math.cos(angle) * ringR, y: cy + Math.sin(angle) * ringR, id: ids[agentIdx] })
          agentIdx++
        }
      }

      // Faint connection lines — skip full mesh for large n to avoid O(n²) noise
      const maxConnections = n <= 12 ? n * (n - 1) / 2 : 40
      let connDrawn = 0
      for (let i = 0; i < n && connDrawn < maxConnections; i++) {
        for (let j = i + 1; j < n && connDrawn < maxConnections; j++) {
          // For large n, only connect ring-adjacent pairs
          if (n > 12 && Math.abs(i - j) > 3 && !(i === 0 && j === n - 1)) continue
          const a = nodePositions[i], b = nodePositions[j]
          const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
          g.addColorStop(0, 'rgba(52,211,153,0.04)')
          g.addColorStop(0.5, 'rgba(52,211,153,0.08)')
          g.addColorStop(1, 'rgba(52,211,153,0.04)')
          ctx.strokeStyle = g
          ctx.lineWidth = 0.5
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
          connDrawn++
        }
      }

      // Comm lines
      for (let i = s.commLines.length - 1; i >= 0; i--) {
        const cl = s.commLines[i]
        cl.life -= cl.decay
        if (cl.life <= 0) { s.commLines.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = cl.life * 0.7
        ctx.strokeStyle = cl.color
        ctx.lineWidth = 2 * cl.life
        ctx.shadowColor = cl.color
        ctx.shadowBlur = 12 * cl.life
        ctx.beginPath()
        ctx.moveTo(cl.from.x, cl.from.y)
        ctx.lineTo(cl.to.x, cl.to.y)
        ctx.stroke()
        ctx.restore()
      }

      // Particles with trails
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i]
        p.trail.push({ x: p.x, y: p.y })
        if (p.trail.length > 18) p.trail.shift()
        p.x += p.vx; p.y += p.vy
        p.vx *= 0.98; p.vy *= 0.98
        p.life -= p.decay
        if (p.life <= 0) { s.particles.splice(i, 1); continue }
        if (p.trail.length > 1) {
          ctx.save(); ctx.lineCap = 'round'
          for (let t = 1; t < p.trail.length; t++) {
            const al = (t / p.trail.length) * p.life * 0.4
            ctx.globalAlpha = al
            ctx.strokeStyle = p.color
            ctx.lineWidth = p.radius * (t / p.trail.length)
            ctx.beginPath()
            ctx.moveTo(p.trail[t-1].x, p.trail[t-1].y)
            ctx.lineTo(p.trail[t].x, p.trail[t].y)
            ctx.stroke()
          }
          ctx.restore()
        }
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color; ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Agent nodes
      for (const np of nodePositions) {
        const a = agents[np.id] || {}
        const st = a.status || 'waiting'
        const nodeColor = st === 'running' ? '#06b6d4' : st === 'done' ? '#34D399' : st === 'error' ? '#f43f5e' : '#6b7280'
        const glowAlpha = st === 'running' ? 0.3 : st === 'done' ? 0.2 : 0.1

        const pulseOuter = nodeR * 1.55
        const glowR = nodeR * 1.4
        const selR = nodeR * 1.9
        const labelOffset = nodeR + 12

        // Pulsing ring for running
        if (st === 'running' || st === 'spawning') {
          const pulseT = Math.sin(s.animFrame * 0.04) * 0.5 + 0.5
          const pulseR = pulseOuter + pulseT * nodeR * 0.6
          ctx.save()
          ctx.globalAlpha = 0.15 + pulseT * 0.15
          ctx.strokeStyle = nodeColor
          ctx.lineWidth = 1.5
          ctx.shadowColor = nodeColor; ctx.shadowBlur = 20
          ctx.beginPath(); ctx.arc(np.x, np.y, pulseR, 0, Math.PI * 2); ctx.stroke()
          ctx.globalAlpha = 0.08 + pulseT * 0.08
          ctx.beginPath(); ctx.arc(np.x, np.y, pulseR + nodeR * 0.5, 0, Math.PI * 2); ctx.stroke()
          ctx.restore()
        }

        // Selection dashed ring
        if (selectedId === np.id) {
          ctx.save()
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1.5
          ctx.globalAlpha = 0.5 + Math.sin(s.animFrame * 0.06) * 0.2
          ctx.setLineDash([4, 4])
          ctx.lineDashOffset = -s.animFrame * 0.5
          ctx.beginPath(); ctx.arc(np.x, np.y, selR, 0, Math.PI * 2); ctx.stroke()
          ctx.setLineDash([])
          ctx.restore()
        }

        // Glow
        const grd = ctx.createRadialGradient(np.x, np.y, 0, np.x, np.y, glowR)
        grd.addColorStop(0, nodeColor.replace(')', `,${glowAlpha})`).replace('rgb', 'rgba'))
        grd.addColorStop(1, 'transparent')
        ctx.save(); ctx.fillStyle = grd
        ctx.beginPath(); ctx.arc(np.x, np.y, glowR, 0, Math.PI * 2); ctx.fill(); ctx.restore()

        // Node circle
        ctx.save()
        ctx.fillStyle = '#0f1923'
        ctx.strokeStyle = nodeColor
        ctx.lineWidth = 1.5
        ctx.shadowColor = nodeColor; ctx.shadowBlur = st === 'running' ? 15 : 8
        ctx.beginPath(); ctx.arc(np.x, np.y, nodeR, 0, Math.PI * 2)
        ctx.fill(); ctx.stroke(); ctx.restore()

        // Emoji icon — scale with node
        if (nodeR >= 10) {
          ctx.save()
          ctx.font = `${Math.round(nodeR * 0.85)}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(agentIcon(np.id), np.x, np.y)
          ctx.restore()
        }

        // Label — hide for very large counts
        if (n <= 20) {
          ctx.save()
          const fontSize = Math.max(7, 10 - n * 0.15)
          ctx.font = `500 ${fontSize}px "IBM Plex Mono", monospace`
          ctx.fillStyle = nodeColor
          ctx.textAlign = 'center'; ctx.globalAlpha = n > 14 ? 0.6 : 0.85
          ctx.fillText(shortLabel(np.id), np.x, np.y + labelOffset)
          ctx.restore()
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }, [agents, selectedId])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

function ActivityCanvas({ agents, selectedId, chat, findings }) {
  return (
    <div className="viz-canvas">
      <NetworkCanvas agents={agents} selectedId={selectedId} chat={chat} findings={findings} />
    </div>
  )
}

function FindingCard({ finding }) {
  const cls = sigClass(finding.category || finding.significance)
  const label = sigLabel(finding.category || finding.significance)

  return (
    <div className={`finding-card ${cls}`}>
      <div className="finding-header">
        <span className="finding-gene">{finding.gene || '—'}</span>
        <span className="finding-sig">{label}</span>
      </div>
      <div className="finding-title">{finding.finding || finding.title || finding.summary || '—'}</div>
      {(finding.variants || finding.rsid) && (
        <div className="finding-rsid">
          {Array.isArray(finding.variants)
            ? finding.variants.join(', ')
            : (finding.variants || finding.rsid)}
        </div>
      )}
      {finding.agent && (
        <div className="finding-agent">via {finding.agent}</div>
      )}
    </div>
  )
}

function FindingsPanel({ findings }) {
  const sorted = [...findings].sort((a, b) => {
    const ai = SIG_ORDER.indexOf((a.category || 'other').toLowerCase())
    const bi = SIG_ORDER.indexOf((b.category || 'other').toLowerCase())
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <aside className="panel-findings">
      <div className="panel-header">
        <span className="panel-title">Findings</span>
        {findings.length > 0 && (
          <span className="panel-badge">{findings.length}</span>
        )}
      </div>
      <div className="panel-body">
        {findings.length === 0 ? (
          <div className="empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12h6M9 16h4"/>
            </svg>
            <span>Findings will appear here</span>
          </div>
        ) : (
          sorted.map((f, i) => <FindingCard key={i} finding={f} />)
        )}
      </div>
    </aside>
  )
}

function ChatPanel({ messages, jobId }) {
  const endRef = useRef(null)
  const [inputMsg, setInputMsg] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function sendMessage(e) {
    e.preventDefault()
    const text = inputMsg.trim()
    if (!text || !jobId) return
    setSending(true)
    try {
      await fetch('/api/inject-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, message: text, from: 'user' }),
      })
      setInputMsg('')
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="panel-chat">
      <div className="panel-header">
        <span className="panel-title">Agent Communication</span>
        {messages.length > 0 && (
          <span className="panel-badge">{messages.length} msgs</span>
        )}
      </div>
      <div className="panel-body">
        {messages.length === 0 ? (
          <div className="empty" style={{ padding: '16px' }}>
            <span>Agent messages will appear here during analysis</span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.from === 'user' ? 'chat-message-user' : ''}`}>
              <span className={`chat-from ${msg.to ? 'chat-to' : ''}`}>
                {msg.from || 'agent'}
                {msg.to ? ` → ${msg.to}` : ''}
              </span>
              <span className="chat-text">{msg.message || msg.text || ''}</span>
              <span className="chat-time">{fmtTime(msg.timestamp)}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          className="chat-input"
          value={inputMsg}
          onChange={e => setInputMsg(e.target.value)}
          placeholder="Send a message to agents…"
          disabled={!jobId || sending}
        />
        <button
          className="chat-send-btn"
          type="submit"
          disabled={!jobId || sending || !inputMsg.trim()}
        >
          {sending ? '…' : '↑'}
        </button>
      </form>
    </section>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

const POLL_MS = 3000

function getClearedJobs() {
  try { return new Set(JSON.parse(localStorage.getItem('helix-cleared-jobs') || '[]')) }
  catch { return new Set() }
}
function markJobCleared(id) {
  if (!id) return
  const s = getClearedJobs()
  s.add(id)
  try { localStorage.setItem('helix-cleared-jobs', JSON.stringify([...s])) } catch {}
}

export default function App() {
  const [jobId, setJobId] = useState(() => jobIdFromUrl())
  const [jobStatus, setJobStatus] = useState('idle')
  const [agents, setAgents] = useState({})
  const [findings, setFindings] = useState([])
  const [chat, setChat] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [error, setError] = useState(null)
  const [pollCount, setPollCount] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const resolveJobId = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      if (data.activeJobId && !getClearedJobs().has(data.activeJobId)) {
        setJobId(data.activeJobId)
      }
      setIsRunning(!!data.isAnalysisRunning)
    } catch { /* server not up yet */ }
  }, [])

  useEffect(() => {
    resolveJobId()
  }, [resolveJobId])

  const poll = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await fetch(`/api/status/${jobId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setJobStatus(data.status || 'idle')
      setAgents(data.agents || {})
      setFindings(data.findings || [])
      setChat(data.chat || [])
      setError(null)
      setPollCount(c => c + 1)
    } catch (err) {
      setError(err.message)
    }
  }, [jobId])

  useEffect(() => {
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  // Cost estimation — persisted in localStorage so refresh doesn't reset it
  const costEstimate = useMemo(() => {
    const rates = { haiku: { i: 0.80, o: 4 }, sonnet: { i: 3, o: 15 }, opus: { i: 15, o: 75 } }
    let current = 0
    for (const a of Object.values(agents)) {
      const tokens = (a.logSize || 0) / 4
      const model = (a.model || 'haiku').toLowerCase()
      const r = rates[model] || rates.haiku
      current += (tokens * 0.6 / 1e6) * r.i + (tokens * 0.4 / 1e6) * r.o
    }
    if (jobId) {
      const key = `helix-cost-${jobId}`
      const prev = parseFloat(localStorage.getItem(key) || '0')
      const peak = Math.max(prev, current)
      if (current > prev) localStorage.setItem(key, current.toFixed(6))
      return peak
    }
    return current
  }, [agents, jobId])

  function stopAndClear() {
    markJobCleared(jobId)
    fetch('/api/clear-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    }).catch(() => {})
    setIsRunning(false)
    setAgents({})
    setFindings([])
    setChat([])
    setJobId(null)
    setJobStatus('idle')
    setPollCount(0)
    setError(null)
    setSelectedAgent(null)
  }

  function saveAllData() {
    const blob = new Blob([JSON.stringify({ jobId, agents, findings, chat }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `helix-${(jobId || 'job').slice(0, 12)}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function runSynthesis() {
    if (!jobId) return
    fetch('/api/spawn-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        id: 'synthesis-' + Date.now().toString(36),
        label: 'Final Synthesis',
        model: 'sonnet',
        prompt: 'Synthesize all findings from the research agents into a comprehensive genomics report.'
      })
    }).catch(() => {})
  }

  const noActivity = !isRunning && Object.keys(agents).length === 0

  return (
    <div className="app">
      {/* ── Body ── */}
      <div className="body">
        <AgentsPanel
          agents={agents}
          selectedId={selectedAgent}
          onSelect={setSelectedAgent}
          jobId={jobId}
        />

        <main className="panel-viz">
          {noActivity
            ? <SetupPanel onStarted={() => { setIsRunning(true); setTimeout(resolveJobId, 2000) }} />
            : <ActivityCanvas agents={agents} selectedId={selectedAgent} chat={chat} findings={findings} />
          }
        </main>

        <FindingsPanel findings={findings} />

        <ChatPanel messages={chat} jobId={jobId} />
      </div>

      {/* ── Status Bar ── */}
      <div className="status-bar">
        <span className="status-bar-brand"><HelixLogo size={20} /> HELIX SEQUENCING</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Job:</span>
        <span className="status-bar-val" title={jobId || ''}>{jobId ? jobId.slice(0, 12) + '…' : '—'}</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Status:</span>
        <span className="status-bar-val">{jobStatus}</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Poll:</span>
        <span className="status-bar-val">{pollCount}</span>
        <span className="status-bar-sep">|</span>
        <span className="status-bar-label">Est. Cost:</span>
        <span className="status-bar-cost">${costEstimate.toFixed(3)}</span>
        {error && <><span className="status-bar-sep">|</span><span className="status-bar-error">{error}</span></>}
        <div className="status-bar-btns">
          {!noActivity && (
            <button className="btn-status btn-stop" onClick={stopAndClear}>■ Stop & Clear</button>
          )}
          {!noActivity && <button className="btn-status btn-save" onClick={saveAllData}>Save All Data</button>}
          {!noActivity && <button className="btn-status btn-synth" onClick={runSynthesis}>Run Synthesis</button>}
        </div>
      </div>
    </div>
  )
}
