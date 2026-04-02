import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import yaml from 'js-yaml'
import './App.css'
// ── Inline Setup Panel ────────────────────────────────────────────────────────

const PRESETS = [
  { id: 'quick-scan', icon: '⚡', name: 'Quick Scan', desc: 'Fast overview — ACMG genes, CPIC drugs, key risks', cost: '$0.50–2.00', time: '5–10 min', color: '#06b6d4',
    agentList: [
      { id: 'general-scanner', label: 'General Health Scanner', model: 'haiku',
        prompt: `You are a genomics researcher performing an initial health screen on a patient's DNA. Your goal is to identify the most clinically significant findings across ALL health domains.\n\nStart by getting the patient summary and pharmacogenomics panel to understand the scope of available data. Then systematically explore:\n\n1. Use get_acmg_genes to check the 84 ACMG clinically actionable genes — these are the genes medical guidelines say MUST be reported if variants are found.\n2. Use get_cpic_drugs to review the patient's drug metabolism profile — check which commonly prescribed drugs need dose adjustments.\n3. Use the database tools to search for pathogenic and likely-pathogenic variants broadly. Start with clinical significance, not specific genes.\n4. Check GWAS associations for any high-confidence trait associations (p-value < 5e-8).\n5. Use web search to look up the latest clinical guidelines for any significant findings you discover.\n\nDon't limit yourself to a predefined gene list. Follow the data — if you find something interesting in one domain, dig deeper. Use cross-referencing between databases to validate findings.\n\nPublish your 5 most actionable findings. Prioritize things that would change medical management.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'narrator', label: 'Quick Report Writer', model: 'haiku',
        prompt: `Write a concise genomic health overview based on all findings. Read every finding carefully and organize by clinical importance.\n\nKeep it practical — this should be something a patient could bring to their doctor. Under 2 pages. Include a metabolizer status table if pharmacogenomic findings exist. If nothing significant was found, say so clearly.\n\nIMPORTANT: This is not a medical diagnosis. Recommend discussing findings with a healthcare provider.` },
    ]},
  { id: 'cancer-research', icon: '🔬', name: 'Cancer Research', desc: 'ACMG cancer genes, CPIC chemo safety, tumor syndromes', cost: '$2.00–8.00', time: '15–30 min', color: '#f43f5e',
    agentList: [
      { id: 'cancer-collector', label: 'Cancer & Tumor Genetics', model: 'haiku',
        prompt: `You are a cancer genomics researcher investigating this patient's hereditary cancer risk. Your job is to find clinically significant cancer-related variants — don't just check a list, investigate.\n\nApproach:\n1. Use get_acmg_genes to get the 84 ACMG clinically actionable genes — many are cancer predisposition genes (BRCA1, BRCA2, MLH1, MSH2, APC, TP53, etc). Check each cancer-related ACMG gene in this patient.\n2. Query ClinVar and CIViC for all pathogenic/likely-pathogenic cancer-related variants in the patient's data.\n3. Research which hereditary cancer syndromes are most relevant to the variants you find. Use web search for current NCCN guidelines.\n4. Use get_cpic_drugs to check chemotherapy drug safety (DPYD for fluoropyrimidines, TPMT for thiopurines).\n5. Investigate DNA repair pathway genes — if you find a variant in one repair gene, check the entire pathway for compound effects.\n6. Don't ignore VUS in high-penetrance genes — flag them with evidence for/against pathogenicity.\n\nFollow leads. If you find a BRCA2 variant, check other HR repair genes. If you find a mismatch repair variant, check all MMR genes for Lynch syndrome.\n\nPublish 3-5 findings with full evidence chains.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'dpyd-safety', label: 'Chemotherapy Safety', model: 'haiku',
        prompt: `You are investigating this patient's genetic safety profile for chemotherapy drugs. This is a critical safety analysis — missed findings here can be life-threatening.\n\nResearch and investigate:\n1. Fluoropyrimidine safety — DPYD is the key gene but don't stop there. Research which variants cause severe toxicity to 5-FU and capecitabine. Use web search to find the latest CPIC guidelines.\n2. Thiopurine safety — investigate TPMT and NUDT15 for azathioprine/mercaptopurine toxicity risk.\n3. Platinum chemotherapy response — research which genetic factors affect cisplatin, carboplatin, and oxaliplatin. Look at DNA repair, drug efflux, and glutathione pathways.\n4. For any gene you investigate, query the patient's data and cross-reference with ClinVar evidence.\n\nThis is about drug safety, not just metabolism. Follow the pharmacology — which enzymes metabolize these drugs? Which transporters affect their distribution? Query those genes.\n\nPublish 3-5 findings. Flag anything that would contraindicate or require dose adjustment for standard chemotherapy regimens.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'immunotherapy', label: 'Immunotherapy & Targeted Therapy', model: 'haiku',
        prompt: `You are researching this patient's genetic profile for immunotherapy and targeted cancer therapy eligibility.\n\nInvestigate:\n1. Research which germline genetic factors predict immunotherapy response or resistance. Use web search for the latest evidence on checkpoint inhibitor pharmacogenomics.\n2. Investigate HLA alleles and immune-related genes in the patient's data — these affect both immunotherapy response and immune-related adverse event risk.\n3. Look for variants that affect targeted therapy eligibility — research which germline variants make patients eligible for PARP inhibitors, kinase inhibitors, or other targeted agents.\n4. Check for immune system gene variants that might predispose to autoimmune complications during immunotherapy.\n\nDon't just query known genes — research the field first, then query the patient's data. The science is evolving rapidly. Use web search for 2024-2025 publications on germline predictors of immunotherapy response.\n\nPublish 2-4 findings connecting the patient's genetics to specific therapy implications.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'targeted-therapy', label: 'Cancer Predisposition Syndromes', model: 'haiku',
        prompt: `You are investigating whether this patient carries any hereditary cancer predisposition syndromes.\n\nResearch approach:\n1. Start by looking at what cancer-related variants the other agents have found (check messages). Use those as starting points.\n2. For each concerning variant, research which syndrome it belongs to. Use web search to check the diagnostic criteria.\n3. Investigate the full spectrum of each suspected syndrome — if you suspect Lynch syndrome, check ALL mismatch repair genes, not just the one with a variant.\n4. Look for rare syndromes that are often missed — Li-Fraumeni, Cowden, MEN, von Hippel-Lindau, hereditary paraganglioma. Research what genes to check for each.\n5. For autosomal recessive cancer syndromes, look for compound heterozygosity — two different variants in the same gene.\n\nUse the orphan disease database and rare disease tools. Cross-reference with ClinVar and web search for diagnostic guidelines.\n\nPublish 2-4 findings with syndrome assessment and recommended surveillance.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'synthesizer', label: 'Cancer Synthesizer', model: 'sonnet',
        prompt: `You are a senior cancer geneticist synthesizing findings from multiple specialist agents. Read ALL findings and messages from the collector agents.\n\nYour job is to see the big picture that individual agents might miss:\n1. Do multiple findings converge on a single syndrome or pathway? A VUS in one gene + a pathogenic variant in a related gene might together indicate meaningful risk.\n2. Are there compound risk patterns? Multiple moderate-risk variants can create high aggregate risk.\n3. Do the pharmacogenomic findings interact with the cancer risk findings? (e.g., a patient with BRCA2 variants who is also a DPYD poor metabolizer has very specific treatment implications)\n4. What are the most clinically actionable next steps? Prioritize by what would change management.\n5. Use web search to validate your synthesis against current clinical guidelines.\n\nPublish up to 8 synthesized findings. Each should connect evidence from multiple agents and include a confidence level.` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a comprehensive cancer genetics report based on all findings. Read every finding from collectors and the synthesizer.\n\nStructure the report for a patient discussing results with an oncologist or genetic counselor. Include:\n- Executive summary of key risks\n- Detailed findings organized by clinical significance\n- Hereditary syndrome assessment\n- Chemotherapy safety profile\n- Immunotherapy/targeted therapy implications\n- Recommended next steps (surveillance, additional testing, genetic counseling referrals)\n- Methodology and limitations\n\nIMPORTANT: This is NOT a diagnosis. Include appropriate disclaimers. Recommend genetic counseling for any pathogenic or likely-pathogenic findings.` },
    ]},
  { id: 'cardiovascular', icon: '❤️', name: 'Cardiovascular', desc: 'ACMG cardiac genes, lipid genetics, arrhythmia risk', cost: '$1.50–6.00', time: '12–25 min', color: '#f97316',
    agentList: [
      { id: 'cardio-collector', label: 'Cardiovascular Genetics', model: 'haiku',
        prompt: `You are a cardiovascular genetics researcher. Investigate this patient's genetic risk for heart disease — but research first, then query.\n\nApproach:\n1. Start with the patient summary to understand the data available. Then query for all cardiovascular-related pathogenic variants in ClinVar.\n2. Research the major categories of inherited heart disease — cardiomyopathies, channelopathies (arrhythmias), and aortopathies. For each category, investigate the relevant genes in the patient's data.\n3. If you find a variant in one gene, investigate the entire pathway or protein complex. Cardiomyopathy genes often have compound effects.\n4. Use GWAS data to assess polygenic cardiovascular risk — look for significant associations with coronary artery disease, heart failure, or stroke.\n5. Research which variants are most clinically actionable — some findings change screening recommendations, some change drug therapy.\n\nUse web search for current AHA/ACC genetic testing guidelines. Follow the evidence wherever it leads.\n\nPublish 3-5 findings with clinical significance and recommended follow-up.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'lipid-collector', label: 'Lipid & Metabolic Risk', model: 'haiku',
        prompt: `You are investigating this patient's genetic risk for lipid disorders and metabolic cardiovascular risk factors.\n\nResearch and investigate:\n1. Familial hypercholesterolemia — research the current diagnostic criteria and which genes cause it, then query those genes. Look for both classic FH and polygenic hypercholesterolemia.\n2. Lipoprotein(a) — research why this is an independent cardiovascular risk factor and what genetic variants affect it. Check the patient's data.\n3. Statin pharmacogenomics — research which genes affect statin response and toxicity risk. Query the patient's data and cross-reference with the pharmacogenomics database.\n4. Research other lipid metabolism disorders — hypertriglyceridemia, HDL disorders, sitosterolemia. Check if any are relevant to this patient.\n5. Investigate metabolic syndrome genetic contributors — insulin resistance, type 2 diabetes risk, obesity genes. Use GWAS data for polygenic risk assessment.\n\nUse web search for the latest lipid genetics guidelines. Publish 3-4 findings with specific treatment implications.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'arrhythmia-agent', label: 'Arrhythmia & Sudden Death Risk', model: 'haiku',
        prompt: `You are investigating this patient's genetic risk for cardiac arrhythmias and sudden cardiac death. This is a critical safety analysis.\n\nResearch approach:\n1. Research the major inherited arrhythmia syndromes — long QT, Brugada, CPVT, short QT. For each, find out which genes are implicated and query them in the patient's data.\n2. Don't just check individual genes — investigate ion channel biology. If you find a variant in one potassium channel gene, check related channels in the same complex.\n3. Research drug-induced QT prolongation genetics — some patients have concealed long QT that only manifests with certain medications. This connects to pharmacogenomics.\n4. Investigate sudden death risk genes beyond classic channelopathies — ARVC genes, titin truncating variants, lamin A/C.\n5. Use web search for current HRS/EHRA guidelines on genetic testing for arrhythmias.\n\nThis domain has direct life-safety implications. Flag anything that would warrant cardiology referral or ECG screening.\n\nPublish 2-4 findings.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'coagulation-agent', label: 'Coagulation & Thrombosis', model: 'haiku',
        prompt: `You are investigating this patient's genetic risk for blood clotting disorders and their interaction with cardiovascular risk.\n\nResearch and investigate:\n1. Research inherited thrombophilia — what are the major genetic risk factors for venous thromboembolism? Query those in the patient's data.\n2. Investigate the folate/homocysteine pathway — research how MTHFR and related genes affect cardiovascular risk through homocysteine. This is controversial — use web search for the latest evidence.\n3. Research anticoagulant pharmacogenomics — warfarin sensitivity, direct oral anticoagulant genetics, antiplatelet response. Query relevant genes.\n4. Look for compound thrombophilia risk — multiple moderate-risk variants together can create high risk, especially with hormonal contraception or surgery.\n5. Investigate bleeding disorder genetics if relevant — some patients have both thrombotic and bleeding risk factors.\n\nPublish 3-4 findings with specific risk stratification and management implications.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'synthesizer', label: 'Cardio Synthesizer', model: 'sonnet',
        prompt: `You are a senior cardiologist synthesizing findings from multiple cardiovascular genetics agents. Read ALL findings and messages.\n\nYour synthesis should:\n1. Integrate findings across domains — a lipid disorder + coagulation variant + arrhythmia risk creates a compound risk profile that's more than the sum of its parts.\n2. Identify drug interaction risks — the patient's pharmacogenomics affect which cardiovascular medications are safe and effective.\n3. Prioritize by clinical urgency — some findings need cardiology referral now, others are long-term risk factors.\n4. Use web search to validate your integrated risk assessment against current guidelines.\n5. Consider the patient's sex — cardiovascular genetic risk manifests differently in males and females.\n\nPublish up to 8 synthesized findings with clear risk tiers and recommended actions.` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a cardiovascular genetics report based on all findings. Read every finding from collectors and the synthesizer.\n\nStructure for a patient discussing results with a cardiologist. Include integrated risk assessment, lipid genetics, arrhythmia risk, coagulation status, drug metabolism implications, and recommended next steps.\n\nHighlight anything that warrants urgent follow-up. IMPORTANT: This is NOT medical advice. Recommend discussing with a healthcare provider.` },
    ]},
  { id: 'pharmacogenomics', icon: '💊', name: 'Pharmacogenomics', desc: 'CPIC drug-gene pairs, metabolizer status, drug safety', cost: '$1.00–4.00', time: '10–20 min', color: '#8b5cf6',
    agentList: [
      { id: 'cyp-collector', label: 'Drug Metabolism Enzymes', model: 'haiku',
        prompt: `You are a pharmacogenomics researcher investigating how this patient metabolizes drugs. Don't just look up a gene list — research the pharmacology.\n\nApproach:\n1. Start with get_all_pharmacogenomics to see the full panel. Identify which enzymes show abnormal metabolizer status.\n2. Use get_cpic_drugs to get the complete CPIC drug-gene pair list — 23 pharmacogenes mapped to 150+ drugs with guideline levels. Cross-reference every abnormal metabolizer with the drugs it affects.\n3. Investigate the cytochrome P450 system comprehensively — but focus your effort on the enzymes that are actually abnormal in this patient. Dig deep on those.\n4. Research drug-drug interactions through shared metabolic pathways. If CYP2D6 is impaired, which combinations of drugs become dangerous?\n5. Don't forget phase II metabolism — UGT, NAT2, GSTP1. These affect many drugs differently than CYP enzymes.\n6. Use web search for current CPIC and DPWG guidelines — these are updated frequently.\n\nPublish 4-5 findings focused on the drugs this patient is most likely to encounter in their lifetime.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'drug-transporter', label: 'Drug Transport & Distribution', model: 'haiku',
        prompt: `You are researching how this patient's genetics affect drug transport — absorption, distribution, and elimination. This is the less-studied side of pharmacogenomics but clinically critical.\n\nResearch and investigate:\n1. Research which drug transporter genes have the strongest clinical evidence. Start with web search for "drug transporter pharmacogenomics clinical significance" to find the current state of the field.\n2. Query the relevant transporter genes in the patient's data. Focus on transporters with CPIC-level evidence.\n3. For any variant you find, research the specific drugs affected. Statin myopathy risk through SLCO1B1 is the classic example, but there are many others.\n4. Investigate blood-brain barrier transporters — these affect neurological drug dosing (ABCB1/P-glycoprotein).\n5. Research renal transporter genetics — these affect drug clearance and can interact with kidney function.\n\nConnect your findings to practical prescribing. Which drugs need dose adjustment? Which should be avoided?\n\nPublish 3-4 findings with specific drug implications.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'pharma-collector', label: 'High-Risk Drug Interactions', model: 'haiku',
        prompt: `You are a clinical pharmacologist focused on identifying the highest-risk drug interactions based on this patient's genetics.\n\nResearch approach:\n1. Start with the pharmacogenomics panel results. Identify all abnormal metabolizer statuses.\n2. Research which drug combinations are most dangerous for this specific metabolizer profile. Use web search for case reports and FDA drug safety communications.\n3. Investigate life-threatening pharmacogenomic interactions — DPYD + fluoropyrimidines, TPMT + thiopurines, HLA-B*5701 + abacavir, HLA-B*1502 + carbamazepine. Check if this patient is affected.\n4. Look at polypharmacy scenarios — what happens when this patient's CYP profile interacts with multiple concurrent medications?\n5. Research emerging pharmacogenomic associations — the field moves fast. Check 2024-2025 literature for new clinically actionable findings.\n\nPrioritize findings by severity of potential adverse reaction. A fatal drug reaction gene is more important than a slightly reduced drug efficacy.\n\nPublish 3-5 findings ranked by clinical urgency.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'synthesizer', label: 'PGx Synthesizer', model: 'sonnet',
        prompt: `You are a senior clinical pharmacologist synthesizing findings from multiple pharmacogenomics agents. Read ALL findings and messages.\n\nYour synthesis should:\n1. Build a complete drug interaction profile — combine metabolism, transport, and high-risk interaction findings into a unified picture.\n2. Identify compound pharmacogenomic risks — a CYP2D6 poor metabolizer who is also an SLCO1B1 decreased function carrier has amplified statin risk.\n3. Create practical guidance organized by drug category — pain, psychiatric, cardiac, GI, cancer, anticoagulants.\n4. Flag the top 5 most dangerous drugs or drug combinations for this specific patient.\n5. Use web search to validate compound interaction risks against published case reports.\n\nPublish 5-8 synthesized findings. Each should be actionable — "avoid X" or "reduce dose of Y" or "use Z instead."` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a pharmacogenomics report that a patient could bring to their doctor or pharmacist. Read all findings.\n\nInclude a metabolizer status summary table, high-priority drug alerts, drug-by-drug guidance organized by medical category, and recommended actions.\n\nUse plain language. IMPORTANT: Not medical advice — recommend discussing with a healthcare provider before making any medication changes.` },
    ]},
  { id: 'rare-disease', icon: '🧬', name: 'Rare Disease', desc: 'Rare & orphan disease panel', cost: '$2.00–8.00', time: '15–30 min', color: '#34D399',
    agentList: [
      { id: 'metabolic-collector', label: 'Metabolic & Biochemical', model: 'haiku',
        prompt: `You are a biochemical genetics researcher investigating this patient for inborn errors of metabolism and metabolic disorders.\n\nResearch approach:\n1. Query the database broadly for pathogenic variants in metabolic disease genes. Don't start with a gene list — start with what the data shows.\n2. For any variant you find, research the associated metabolic disorder. What are the symptoms? What is the inheritance pattern? Is the patient a carrier or affected?\n3. Investigate entire metabolic pathways when you find a variant — if you find something in one enzyme, check upstream and downstream enzymes in the same pathway.\n4. Use the orphan disease database to cross-reference findings with known rare metabolic conditions.\n5. Research treatable metabolic disorders specifically — some have dietary interventions, enzyme replacement, or substrate reduction therapy. These are the highest-priority findings.\n6. For autosomal recessive conditions, actively look for compound heterozygosity — two different variants in the same gene.\n\nUse web search for current newborn screening panels and treatment guidelines. Publish 3-5 findings.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'neuro-collector', label: 'Neurological & Neuromuscular', model: 'haiku',
        prompt: `You are a neurogenetics researcher investigating this patient for inherited neurological and neuromuscular conditions.\n\nResearch approach:\n1. Search the patient's data broadly for neurological disease variants. Use ClinVar pathogenic/likely-pathogenic filters.\n2. Research the major categories of inherited neurological disease — neurodegeneration, channelopathies, neuropathies, myopathies, movement disorders. For each category, follow the evidence in the patient's data.\n3. Investigate gene networks — neurological diseases often involve protein complexes. If you find a variant in one subunit, check the others.\n4. Look for reduced-penetrance variants in neurodegenerative disease genes — these are important for early intervention even if the patient is currently asymptomatic.\n5. Research pharmacogenomic implications for neurological drugs — antiepileptics, psychiatric medications, and pain management all have significant pharmacogenomic components.\n\nUse web search for current diagnostic criteria and management guidelines. Publish 3-5 findings.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'connective-tissue', label: 'Structural & Connective Tissue', model: 'haiku',
        prompt: `You are investigating this patient for inherited connective tissue disorders, skeletal conditions, and structural protein diseases.\n\nResearch approach:\n1. Query for pathogenic variants in collagen genes, fibrillin, and extracellular matrix proteins. These underlie many rare structural disorders.\n2. Research which connective tissue disorders have life-threatening complications — vascular Ehlers-Danlos (aortic rupture), Marfan syndrome (aortic dissection), Loeys-Dietz. Prioritize investigating these.\n3. If you find a collagen variant, research which specific type of collagen it is and what tissues it affects. Different collagens = different clinical presentations.\n4. Investigate skeletal dysplasia genes if relevant — these can be subtle in adults but important for family planning.\n5. Check for aortopathy genes — some patients have genetic aortic disease risk without classic connective tissue syndrome features.\n\nUse web search for current surveillance guidelines for heritable aortic conditions. Flag anything requiring echocardiography or vascular imaging.\n\nPublish 2-4 findings.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'immunology-agent', label: 'Immune System & Autoinflammatory', model: 'haiku',
        prompt: `You are investigating this patient's immune system genetics for primary immunodeficiency, autoinflammatory conditions, and immune dysregulation.\n\nResearch approach:\n1. Query broadly for pathogenic variants in immune system genes. Use the HPO and orphan disease databases to cross-reference.\n2. Research the spectrum of primary immunodeficiency — it's not just severe childhood disease. Many PIDs present in adults with recurrent infections, autoimmunity, or unexplained inflammation.\n3. Investigate autoinflammatory disease genes — periodic fever syndromes, complement deficiencies, interferon pathway disorders. These are frequently underdiagnosed.\n4. Check HLA alleles for disease associations — HLA typing reveals risk for autoimmune conditions, drug hypersensitivity, and immune-mediated diseases.\n5. Research the complement system — deficiencies predispose to specific infections and autoimmune conditions.\n\nUse web search for current IUIS classification of immunodeficiencies. Publish 2-4 findings.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'rare-cancer', label: 'Rare Cancer & Tumor Syndromes', model: 'haiku',
        prompt: `You are investigating rare hereditary cancer and tumor predisposition syndromes that fall outside the common BRCA/Lynch spectrum.\n\nResearch approach:\n1. Query ClinVar and CIViC for cancer-related pathogenic variants, then research which rare syndromes they indicate.\n2. Research the less common hereditary cancer syndromes — phakomatoses, endocrine tumor syndromes, hereditary paraganglioma, BAP1 tumor predisposition. Use web search to understand current diagnostic criteria.\n3. For each potential syndrome, investigate the full gene panel — don't check genes in isolation.\n4. Look for variants in DNA repair genes that don't fit classic BRCA/Lynch but still indicate cancer predisposition.\n5. Research emerging cancer predisposition genes from recent literature — the field is expanding rapidly.\n\nUse the orphan disease database and web search for NCCN rare cancer syndrome guidelines. Publish 2-4 findings with specific surveillance recommendations.\n\nBe THOROUGH. You are the cheap model — your job is to do the heavy lifting of database queries and web searches so the expensive synthesizer model has rich data to work with. Use many tool calls. Query broadly, then dig deep on anything interesting. Don't stop at the first result — cross-reference, validate, and follow leads. The more evidence you gather, the better the final report.` },
      { id: 'synthesizer', label: 'Rare Disease Synthesizer', model: 'sonnet',
        prompt: `You are a senior clinical geneticist synthesizing findings from multiple rare disease specialist agents. Read ALL findings and messages.\n\nYour synthesis requires nuanced clinical reasoning:\n1. Do multiple findings across different agents converge on a single diagnosis? A variant found by the metabolic agent + a variant found by the neuro agent might together explain a multisystem condition.\n2. Assess compound heterozygosity — two agents might each find one variant in the same recessive disease gene.\n3. Evaluate VUS findings collectively — individually uncertain, but together they might paint a clear picture.\n4. Research whether the combination of findings matches any known syndrome. Use web search for differential diagnosis.\n5. Prioritize by treatability — a treatable rare disease diagnosis is the highest-value finding.\n\nPublish up to 10 synthesized findings. For each, state confidence level, whether clinical confirmation is needed, and which specialist should evaluate.` },
      { id: 'narrator', label: 'Report Writer', model: 'haiku',
        prompt: `Write a rare disease genetics report for discussion with a clinical geneticist. Read all findings.\n\nOrganize by certainty: pathogenic variants first, then likely-pathogenic, then high-priority VUS. For each VUS, explain the evidence for and against pathogenicity.\n\nInclude compound heterozygosity analysis, cross-system findings, pharmacogenomics for rare disease treatments, and recommended next steps (confirmatory testing, specialist referrals, family screening).\n\nIMPORTANT: VUS findings require clinical confirmation. This report is for discussion with a qualified geneticist.` },
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
          setCustomAgents(t.agents?.map(a => ({ id: a.id, label: a.label || a.id, model: a.model || 'haiku', prompt: a.prompt || '', role: a.role || 'collector', maxToolCalls: a.maxToolCalls, temperature: a.temperature, checkMessages: a.checkMessages, webSearch: a.webSearch })) || [])
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
      const jobTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const jobDir = dir ? `${dir}/${jobTimestamp}` : jobTimestamp
      const baseOverrides = saveMd
        ? Object.fromEntries(agentList.map(a => [a.id, { mdOutputPath: `${jobDir}/${a.id}.md` }]))
        : {}
      // Merge per-agent setting edits into overrides
      const agentOverrides = { ...baseOverrides }
      for (const [agentId, edits] of Object.entries(agentEdits)) {
        agentOverrides[agentId] = { ...agentOverrides[agentId], ...edits }
      }

      const payload = {
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
      }
      console.log('[helix] Start payload:', JSON.stringify(payload, null, 2).slice(0, 2000))
      if (payload.customAgents) {
        for (const a of payload.customAgents) console.log('[helix] Agent:', a.id, 'model:', a.model, 'role:', a.role, 'prompt:', (a.prompt||'').slice(0,50))
      }
      const res = await fetch('/api/start-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
            {customAgents.map((agent, i) => {
              const isOpen = expandedPrompts[`custom-${i}`] ?? (i === 0)
              return (
                <div key={i} className={`setup-custom-agent${isOpen ? '' : ' collapsed'}`}>
                  <div className="setup-custom-agent-header" onClick={() => setExpandedPrompts(prev => ({ ...prev, [`custom-${i}`]: !isOpen }))}>
                    <span className="setup-prompt-chevron">{isOpen ? '▲' : '▼'}</span>
                    <input className="setup-input" placeholder="Agent ID" value={agent.id} onClick={e => e.stopPropagation()}
                      onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, id: e.target.value} : a))} />
                    <input className="setup-input" placeholder="Label" value={agent.label} onClick={e => e.stopPropagation()}
                      onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, label: e.target.value} : a))} />
                    <select className="setup-select" value={agent.model} onClick={e => e.stopPropagation()}
                      onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, model: e.target.value} : a))}>
                      <option value="haiku">Haiku</option>
                      <option value="sonnet">Sonnet</option>
                      <option value="opus">Opus</option>
                    </select>
                    <button className="btn-custom-agent-remove" onClick={e => { e.stopPropagation(); setCustomAgents(prev => prev.filter((_, j) => j!==i)) }}>✕</button>
                  </div>
                  {isOpen && (
                    <>
                      <div className="setup-agent-settings-grid" style={{ padding: '8px 10px 0' }}>
                        <div className="setup-agent-setting">
                          <label>Max Tool Calls</label>
                          <input className="setup-input setup-input-sm" type="number" min="10" max="500" step="10"
                            value={agent.maxToolCalls ?? 100}
                            onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, maxToolCalls: parseInt(e.target.value) || 100} : a))} />
                        </div>
                        <div className="setup-agent-setting">
                          <label>Temperature</label>
                          <input className="setup-input setup-input-sm" type="number" min="0" max="1" step="0.05"
                            value={agent.temperature ?? 0.3}
                            onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, temperature: parseFloat(e.target.value) || 0.3} : a))} />
                        </div>
                        <div className="setup-agent-setting">
                          <label>Check Msgs</label>
                          <input className="setup-input setup-input-sm" type="number" min="1" max="20"
                            value={agent.checkMessages ?? 7}
                            onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, checkMessages: parseInt(e.target.value) || 7} : a))} />
                        </div>
                        <div className="setup-agent-setting">
                          <label>Web Search</label>
                          <button className={`setup-toggle-sm${(agent.webSearch ?? true) ? ' on' : ''}`}
                            onClick={() => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, webSearch: !(a.webSearch ?? true)} : a))}>
                            {(agent.webSearch ?? true) ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <div className="setup-agent-setting">
                          <label>Role</label>
                          <select className="setup-select setup-select-sm"
                            value={agent.role || 'collector'}
                            onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, role: e.target.value} : a))}>
                            <option value="collector">Collector</option>
                            <option value="synthesizer">Synthesizer</option>
                            <option value="narrator">Narrator</option>
                          </select>
                        </div>
                      </div>
                      <textarea className="setup-textarea setup-prompt-textarea" placeholder="Research prompt for this agent…" value={agent.prompt}
                        onChange={e => setCustomAgents(prev => prev.map((a, j) => j===i ? {...a, prompt: e.target.value} : a))} />
                    </>
                  )}
                </div>
              )
            })}
            <button className="btn-add-custom-agent" onClick={() => setCustomAgents(prev => [...prev,
              { id: `custom-agent-${prev.length+1}`, label: '', model: 'haiku', role: 'collector', prompt: '' }
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
                  {agents.map((agent, agentIdx) => {
                    const edits = agentEdits[agent.id] || {}
                    const isEdited = Object.keys(edits).length > 0
                    // Auto-expand first agent in first tier
                    const isFirstAgent = tier === '1' && agentIdx === 0
                    const isOpen = expandedPrompts[agent.id] ?? isFirstAgent
                    return (
                      <div key={agent.id} className={`setup-prompt-row${isOpen ? ' expanded' : ''}${isEdited ? ' edited' : ''}`}>
                        <button className="setup-prompt-toggle" onClick={() => setExpandedPrompts(prev => ({ ...prev, [agent.id]: !isOpen }))}>
                          <span className="setup-prompt-label">{agent.label}</span>
                          <span className="setup-prompt-model">{edits.model || agent.model}</span>
                          {isEdited && <span className="setup-prompt-edited">edited</span>}
                          <span className="setup-prompt-chevron">{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                          <div className="setup-prompt-edit-area">
                            <div className="setup-agent-settings-grid">
                              <div className="setup-agent-setting">
                                <label>Model</label>
                                <select className="setup-select setup-select-sm" value={edits.model || agent.model}
                                  onChange={e => setAgentSetting(agent.id, 'model', e.target.value === agent.model ? undefined : e.target.value)}>
                                  <option value="haiku">haiku</option>
                                  <option value="sonnet">sonnet</option>
                                  <option value="opus">opus</option>
                                </select>
                              </div>
                              <div className="setup-agent-setting">
                                <label>Max Tool Calls</label>
                                <input className="setup-input setup-input-sm" type="number" min="10" max="500" step="10"
                                  value={edits.maxToolCalls ?? 100}
                                  onChange={e => setAgentSetting(agent.id, 'maxToolCalls', parseInt(e.target.value) || 100)} />
                              </div>
                              <div className="setup-agent-setting">
                                <label>Temperature</label>
                                <input className="setup-input setup-input-sm" type="number" min="0" max="1" step="0.05"
                                  value={edits.temperature ?? 0.3}
                                  onChange={e => setAgentSetting(agent.id, 'temperature', parseFloat(e.target.value) || 0.3)} />
                              </div>
                              <div className="setup-agent-setting">
                                <label>Check Msgs</label>
                                <input className="setup-input setup-input-sm" type="number" min="1" max="20" step="1"
                                  value={edits.checkMessages ?? 7}
                                  onChange={e => setAgentSetting(agent.id, 'checkMessages', parseInt(e.target.value) || 7)} />
                              </div>
                              <div className="setup-agent-setting">
                                <label>Web Search</label>
                                <button className={`setup-toggle-sm${(edits.webSearch ?? true) ? ' on' : ''}`}
                                  onClick={() => setAgentSetting(agent.id, 'webSearch', !(edits.webSearch ?? true))}>
                                  {(edits.webSearch ?? true) ? 'ON' : 'OFF'}
                                </button>
                              </div>
                              <div className="setup-agent-setting">
                                {isEdited && (
                                  <button className="setup-prompt-reset" onClick={() => setAgentEdits(prev => { const next = {...prev}; delete next[agent.id]; return next })}>
                                    Reset All
                                  </button>
                                )}
                              </div>
                            </div>
                            <textarea
                              className="setup-textarea setup-prompt-textarea"
                              value={edits.prompt ?? agent.prompt ?? ''}
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

// Tier detection from agent ID/role
function getAgentTier(id) {
  const s = (id || '').toLowerCase()
  if (s.includes('narrator') || s.includes('report') || s.includes('writer')) return 'report'
  if (s.includes('synth')) return 'synthesis'
  return 'collection'
}
const TIER_COLORS = { collection: '#06b6d4', synthesis: '#8b5cf6', report: '#f59e0b' }
const STATUS_COLORS = { running: '#06b6d4', spawning: '#06b6d4', done: '#22c55e', error: '#ef4444', waiting: '#6b7280' }

function AgentCard({ agent, selected, onClick, onViewMd }) {
  const { id, label, model, status, lastActivity, logSize, hasMd, mdPath } = agent
  const tier = getAgentTier(id)
  const tierColor = TIER_COLORS[tier]
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.waiting
  const cardCls = [
    'agent-card',
    `status-${status || 'waiting'}`,
    `tier-${tier}`,
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ')

  const modelShort = model
    ? model.replace('claude-', '').replace('-20251001', '').replace('-20240229', '')
    : '—'

  return (
    <div className={cardCls} onClick={() => onClick(id)} style={{ borderLeftColor: tierColor }}>
      <div className="agent-row">
        <StatusDot status={status || 'waiting'} />
        <span className="agent-icon" style={{ color: statusColor }}>
          {status === 'done' ? '✓' : status === 'error' ? '✗' : status === 'running' || status === 'spawning' ? '⟳' : '○'}
        </span>
        <span className="agent-label">{label || id}</span>
        <span className="agent-model" style={{ color: tierColor }}>{modelShort}</span>
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

  // Cost estimation — accounts for input tokens (tool responses, system prompt, web search)
  // not just output tokens from log size. Actual costs are typically 5-10x raw output.
  const costEstimate = useMemo(() => {
    const rates = { haiku: { i: 0.80, o: 4 }, sonnet: { i: 3, o: 15 }, opus: { i: 15, o: 75 } }
    let current = 0
    const numFindings = findings.length
    const numMessages = chat.length
    const numWebSearches = chat.filter(m => (m.message || '').toLowerCase().includes('web search')).length
    for (const a of Object.values(agents)) {
      const outputTokens = (a.logSize || 0) / 4
      const model = (a.model || 'haiku').toLowerCase()
      const r = rates[model] || rates.haiku
      // Estimate input tokens: system prompt (~2K) + per-tool-call overhead
      // Each tool call: ~200 tokens request + ~800 tokens response avg
      // Web searches: ~3000 tokens per search result
      // Input is typically 4-6x output for research-heavy agents
      const estimatedInputTokens = outputTokens * 5
      current += (estimatedInputTokens / 1e6) * r.i + (outputTokens / 1e6) * r.o
    }
    // Add web search token overhead (search results are large)
    const webSearchTokens = numWebSearches * 3000
    current += (webSearchTokens / 1e6) * rates.haiku.i
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

  // Show setup only when no job has ever been loaded (no agents, no findings)
  const hasJobData = Object.keys(agents).length > 0 || findings.length > 0 || chat.length > 0
  const noActivity = !isRunning && !hasJobData

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

        {noActivity ? (
          <main className="panel-viz">
            <SetupPanel onStarted={() => { setIsRunning(true); setTimeout(resolveJobId, 2000) }} />
          </main>
        ) : (
          <>
            <main className="panel-viz-active">
              <ActivityCanvas agents={agents} selectedId={selectedAgent} chat={chat} findings={findings} />
            </main>
            <ChatPanel messages={chat} jobId={jobId} />
            <FindingsPanel findings={findings} />
          </>
        )}
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
