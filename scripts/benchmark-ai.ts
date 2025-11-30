import { generateText } from "ai";
import { MODELS, getLanguageModel } from "../lib/ai/ai-providers";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { createInterface } from "readline";

// Load environment variables from .env.local manually
if (existsSync(".env.local")) {
  const envConfig = readFileSync(".env.local", "utf-8");
  envConfig.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value && !process.env[key]) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const RESULTS_FILE = "benchmark_results.json";

// Prompts
const PROMPTS = {
  small: `I'm about to DM my teammate Priya to say I'm running ten minutes late to sprint planning because daycare drop-off took longer than expected. Write a Slack message that acknowledges the delay, confirms I'm still joining, and keeps the tone apologetic but calm.`,
  medium: `A customer success manager needs to brief the sales team on why progressive feature flags help enterprise rollouts. Give a four bullet explanation in plain English that covers: a quick analogy, how flags reduce risk, one concrete example from SaaS, and a note about communicating sunset timelines to customers.`,
  big: `You are acting as my AI chief of staff. Read the meeting notes below and produce three outputs in this order: (1) a executive summary, (2) a markdown table of the top risks with columns for Owner, Risk, Impact, and Mitigation, (3) a numbered list of the next five concrete actions with realistic due dates in the coming two weeks and (4) a detaild summary of the meeting with the most important information and a recomended follow up actions to have the best outcome for the next meeting.

Meeting notes:
<<<
Weekly "North Star" Sync — Monday 9:05 AM, hybrid room + Zoom.
Participants: Nina (CEO), Marco (CPO), Sal (Eng Lead), Tessa (Design), Omar (RevOps), Kay (Support), and me.

Opening pulse:
- Nina wants a crisp status before her board prep on Thursday.
- Cash runway revised to 17.5 months after the new SOC 2 audit spend; finance will re-forecast if hiring plan slips.
- Nina reiterated appetite for bold bets provided we show measurable lift on activation by end of quarter.

Product & Engineering:
- Marco walked through the "Spaces" beta metrics: 1,842 workspaces created, 36% of them active daily, activation funnel stalls after the personalization step; suggested swapping the personalization quiz for a template picker experiment.
- Sal flagged that the notification service rewrite is stuck behind an S3 IAM policy review; estimate slips from 3/4 to 3/11 unless security signs off by Wednesday, and PagerDuty noise may spike if the legacy service keeps throttling.
- Design sprint produced three mobile handoff concepts; Tessa recommends testing Concept B because it keeps parity with desktop navigation and tested best in unmoderated tests (78% task completion).
- We agreed to keep the feature flag on for invite-only customers until at least 2 full weeks of stability data is collected; QA to expand synthetic load tests tonight.
- Tech debt callout: auth team requests two engineering days to retire the deprecated billing webhook handler before it blocks the new pricing rollout.

Revenue & GTM:
- Omar shared that pipeline coverage for Q2 is 2.4x target but concentrated in healthcare; asks for one case study deck before April 5 to diversify.
- Self-serve conversions dipped from 4.1% to 3.3% week over week after pricing card copy changed; hypothesis is that "Get started free" CTA feels like a trial, so growth team is spinning up an A/B test to restore the old CTA by Wednesday.
- Channel partners want an API-only plan; Marco says the architecture review for API rate limits is still pending.
- Omar flagged churn among 20-seat customers who hit workspace limits; asked product to consider soft limits plus in-app prompts.
- Marketing hired a contract writer to localize the onboarding sequence into Spanish and German before May.

Customer experience:
- Kay summarized the top five support themes, led by onboarding emails landing in spam and confusion about workspace roles.
- Average first-response time is 2m11s on chat but 9h+ on email because of weekend backlog; Kay requested budget for another weekend contractor before end of month.
- We promised the enterprise account "Lighthouse Bank" that role-based exports would hit staging by March 12; engineering still owes confirmation.
- NPS dipped from 47 to 39 week over week; main detractors cite notification noise and missing admin audit logs.
- Kay asked design for refreshed macros explaining workspace roles with diagrams.

Ops & misc:
- Facilities move-in date for the new office is now April 29 because of permit delays.
- Nina asked for a single spreadsheet that ties hiring plan to runway scenarios; RevOps and Finance are meeting tomorrow at 2 PM to draft it, aiming for version 0.9 by Wednesday evening.
- Action registers from prior meetings show four items overdue (Spaces health dashboard, updated onboarding deck, SOC 2 follow-up memo, billing retry experiment).
- People team planning listening tour for new managers; Nina wants to see draft survey questions by Thursday noon.

Closing:
- Nina reiterated that any slips impacting the March 28 launch window must be surfaced before Wednesday's all-hands.
- Next exec readout dry run is scheduled for Friday 8 AM; everyone owes slide drafts by Thursday 4 PM PT.
>>> 

Transcript excerpt:
<<<
[09:05] Nina: "Thanks for dialing in. I need a clean story for Thursday's board, so let's keep answers concrete and flag anything at risk for March 28."
[09:07] Marco: "Spaces beta is healthy on creation, but personalization is our leaky bucket. I'd love approval to swap that step for a template picker experiment this week."
[09:09] Nina: "Approved, but pair it with a measurement plan—board will ask how we know it works."
[09:12] Sal: "Notification rewrite is ready except for the IAM policy. Without security's sign-off we slip a week and risk more paging noise."
[09:13] Nina: "Loop in Priya from security today. If it's still blocked by the stand-up tomorrow, escalate to me."
[09:16] Kay: "Support queue is red on weekends. I need contractor coverage or we keep drowning in email backlog."
[09:17] Omar: "Also seeing conversions drop after the CTA copy change. Growth team is already prepping a revert test."
[09:20] Tessa: "Concept B won in user tests. Shipping it would keep desktop/mobile parity, which should ease support tickets."
[09:23] Omar: "Pipeline looks good but it's all healthcare logos. I need at least one case study deck in fintech to balance it."
[09:26] Nina: "Understood. Let's get draft slides for the exec readout by Thursday 4 PM so Friday's dry run is rehearsal, not brainstorming."
[09:30] Sal: "Reminder that Lighthouse Bank expects role-based exports in staging by March 12. We need final API review by Monday."
[09:33] Nina: "Action items go into the tracker today. If something threatens March 28, I want to know before all-hands on Wednesday."
<<<

Please ground your outputs in both the notes and transcript.
<<<`
};

const normalizeCostToNumber = (value: number | string | undefined): number | null => {
  if (value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = value.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/[^0-9eE.+-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

interface SingleBenchmarkResult {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalCost?: number | string;
  latency?: number;
  durationSeconds?: number;
  error?: string;
}

interface AggregatedBenchmarkResult {
  model: string;
  provider: string;
  isPremium?: boolean;
  small?: SingleBenchmarkResult;
  medium?: SingleBenchmarkResult;
  big?: SingleBenchmarkResult;
}

const MODEL_CONFIG_MAP = new Map(MODELS.map(model => [model.id, model]));

const backfillIsPremiumMetadata = (results: AggregatedBenchmarkResult[]) => {
  let modified = false;
  for (const entry of results) {
    const modelConfig = MODEL_CONFIG_MAP.get(entry.model);
    const premiumValue = modelConfig?.isPremium ?? false;
    if (entry.isPremium !== premiumValue) {
      entry.isPremium = premiumValue;
      modified = true;
    }
  }
  return modified;
};

const persistResults = (results: AggregatedBenchmarkResult[]) => {
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
};

const loadResults = (): AggregatedBenchmarkResult[] => {
  if (!existsSync(RESULTS_FILE)) {
    return [];
  }
  try {
    const parsed: AggregatedBenchmarkResult[] = JSON.parse(readFileSync(RESULTS_FILE, "utf-8"));
    if (backfillIsPremiumMetadata(parsed)) {
      persistResults(parsed);
    }
    return parsed;
  } catch (error) {
    console.warn("Could not read existing results file, starting fresh.");
    return [];
  }
};

const shouldSkipPrompt = (
  results: AggregatedBenchmarkResult[],
  modelId: string,
  promptSize: 'small' | 'medium' | 'big'
) => {
  const entry = results.find(r => r.model === modelId);
  if (!entry) return false;
  const existingResult = entry[promptSize];
  if (!existingResult) return false;
  if (existingResult.error) return false;
  const hasTokens =
    typeof existingResult.totalTokens === "number" ||
    typeof existingResult.inputTokens === "number" ||
    typeof existingResult.outputTokens === "number";
  const hasCost = existingResult.totalCost !== undefined;
  const hasDuration = typeof existingResult.durationSeconds === "number";
  return hasTokens || hasCost || hasDuration;
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function getGenerationDetails(generationId: string) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return null;
  }
  try {
    const response = await fetch(
      `https://ai-gateway.vercel.sh/v1/generation?id=${generationId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AI_GATEWAY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Error fetching generation details:", e);
    return null;
  }
}

async function runBenchmarkForModel(modelConfig: typeof MODELS[0], promptSize: 'small' | 'medium' | 'big') {
  const prompt = PROMPTS[promptSize];
  console.log(`Running ${modelConfig.id} [${promptSize}]...`);
  const startTime = Date.now();

  try {
    const model = getLanguageModel(modelConfig.id);
    const result = await generateText({
      model,
      prompt,
    });

    // console.log(`[Debug] Result for ${modelConfig.id}:`);
    // console.log(`  - Text: ${result.text.slice(0, 50)}...`);
    // console.log(`  - Usage:`, JSON.stringify(result.usage));
    // console.log(`  - Provider Metadata:`, JSON.stringify(result.providerMetadata));

    const usage: any = result.usage;
    
    // Extract info from providerMetadata as seen in debug logs
    // The structure is result.providerMetadata.gateway.cost (string)
    // and result.providerMetadata.gateway.generationId
    const metadataGateway = result.providerMetadata?.gateway as any;
    
    let totalCost: number | string | undefined = metadataGateway?.cost;
    let generationId = metadataGateway?.generationId;

    // Fallback: Check usage.gateway if not found in metadata
    if (!totalCost && !generationId) {
         // @ts-ignore
        const usageGateway = result.usage?.gateway;
        if (usageGateway) {
            if (!totalCost) totalCost = usageGateway.cost;
            if (!generationId) generationId = usageGateway.generationId;
        }
    }

    // Fallback: Check headers for generationId if still missing
    if (!generationId && result.response?.headers) {
        const headers = result.response.headers;
        // Handle both Headers object (has get) and plain object
        if (typeof (headers as any).get === 'function') {
            generationId = (headers as any).get('x-ai-generation-id');
        } else {
            generationId = (headers as any)['x-ai-generation-id'];
        }
    }

    let details: any = null;

    if (generationId) {
        details = await getGenerationDetails(generationId);
        if (details) {
            // details.data.total_cost
            // details.data.tokens_prompt
            // details.data.tokens_completion
            if (totalCost === undefined) totalCost = details.data.total_cost;
        }
    }

    // Try to get cost from providerMetadata if available
    if (totalCost === undefined && result.providerMetadata?.aiSdk?.usage) {
        // @ts-ignore
         const aiSdkUsage = result.providerMetadata.aiSdk.usage as any;
         if (aiSdkUsage.cost) {
            totalCost = aiSdkUsage.cost;
         }
    }

    const durationSeconds = (Date.now() - startTime) / 1000;

    // AI SDK standardizes on promptTokens/completionTokens but some providers/versions might return inputTokens/outputTokens
    // based on previous logs, we saw inputTokens/outputTokens in the usage object.
    const inputTokens = usage.promptTokens ?? usage.inputTokens ?? 0;
    const outputTokens = usage.completionTokens ?? usage.outputTokens ?? 0;

    return {
      model: modelConfig.id,
      provider: modelConfig.provider,
      promptSize,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      totalCost: totalCost ?? "N/A",
      durationSeconds,
    };

  } catch (error: any) {
    console.error(`Failed to run ${modelConfig.id}:`, error.message || error);
    return {
      model: modelConfig.id,
      provider: modelConfig.provider,
      promptSize,
      error: error.message || String(error),
      durationSeconds: (Date.now() - startTime) / 1000,
    };
  }
}

async function saveResult(
  results: AggregatedBenchmarkResult[],
  modelId: string,
  provider: string,
  promptSize: 'small' | 'medium' | 'big',
  data: SingleBenchmarkResult
) {
  // Find existing model entry
  let modelEntry = results.find(r => r.model === modelId);
  if (!modelEntry) {
    modelEntry = {
      model: modelId,
      provider: provider,
    };
    results.push(modelEntry);
  }

  const modelConfig = MODEL_CONFIG_MAP.get(modelId);
  const modelIsPremium = modelConfig?.isPremium ?? false;
  modelEntry.isPremium = modelIsPremium;

  // Update specific prompt size data
  modelEntry[promptSize] = data;

  persistResults(results);
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.warn("Warning: AI_GATEWAY_API_KEY is not set. Costs might not be tracked.");
  } else {
    console.log("AI_GATEWAY_API_KEY is present.");
  }

  while (true) {
    console.log("\n--- AI Benchmark Menu ---");
    console.log("1. Run specific model");
    console.log("2. Run specific provider");
    console.log("3. Run full benchmark (all models)");
    console.log("4. Exit");
    
    const choice = await ask("Select an option: ");

    if (choice === '4') break;

    let modelsToRun: typeof MODELS = [];
    let runDescriptor = "custom selection";

    if (choice === '1') {
      console.log("\nAvailable Models:");
      MODELS.forEach((m, i) => console.log(`${i + 1}. ${m.id}`));
      const modelIdx = await ask("Enter model number: ");
      const idx = parseInt(modelIdx) - 1;
      if (MODELS[idx]) {
        modelsToRun.push(MODELS[idx]);
        runDescriptor = `model ${MODELS[idx].id}`;
      } else {
        console.log("Invalid selection.");
      }
    } else if (choice === '2') {
      const providers = Array.from(new Set(MODELS.map(m => m.provider)));
      console.log("\nAvailable Providers:");
      providers.forEach((p, i) => console.log(`${i + 1}. ${p}`));
      const provIdx = await ask("Enter provider number: ");
      const idx = parseInt(provIdx) - 1;
      if (providers[idx]) {
        const providerName = providers[idx];
        modelsToRun = MODELS.filter(m => m.provider === providerName);
        runDescriptor = `provider ${providerName}`;
      } else {
        console.log("Invalid selection.");
      }
    } else if (choice === '3') {
      modelsToRun = MODELS;
      runDescriptor = `full benchmark (${MODELS.length} models)`;
    } else {
      console.log("Invalid selection.");
    }

    if (modelsToRun.length > 0) {
      console.log(`\nStarting benchmark for ${modelsToRun.length} models...`);
      let totalRunCost = 0;
      let totalRunCostCount = 0;
      const results = loadResults();

      for (const model of modelsToRun) {
        for (const size of ['small', 'medium', 'big'] as const) {
          if (shouldSkipPrompt(results, model.id, size)) {
            console.log(`Skipping ${model.id} (${size}) - cached result found.`);
            continue;
          }

          const result = await runBenchmarkForModel(model, size);
          
          if (result) {
            const dataToSave: SingleBenchmarkResult = {};
            
            if (result.error) {
                dataToSave.error = result.error;
                dataToSave.durationSeconds = result.durationSeconds;
            } else {
                dataToSave.inputTokens = result.inputTokens;
                dataToSave.outputTokens = result.outputTokens;
                dataToSave.totalTokens = result.totalTokens;
                dataToSave.totalCost = result.totalCost;
                dataToSave.durationSeconds = result.durationSeconds;

                const numericCost = normalizeCostToNumber(result.totalCost);
                if (numericCost !== null) {
                  totalRunCost += numericCost;
                  totalRunCostCount += 1;
                }
            }

            await saveResult(results, model.id, model.provider, size, dataToSave);
            
            if (result.error) {
                 console.log(`Saved ERROR for ${model.id} (${size})`);
            } else {
                 console.log(`Saved result for ${model.id} (${size}) - Cost: ${result.totalCost}, Duration: ${result.durationSeconds}s`);
            }
          }
        }
      }
      console.log("\nBenchmark run complete.");
      if (totalRunCostCount > 0) {
        console.log(
          `Total cost for ${runDescriptor}: $${totalRunCost.toFixed(4)} across ${totalRunCostCount} prompt runs.`
        );
      } else {
        console.log(
          `Total cost for ${runDescriptor}: unavailable (models did not return cost data).`
        );
      }
    }
  }

  rl.close();
  process.exit(0);
}

main();

