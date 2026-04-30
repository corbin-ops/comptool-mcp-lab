import {
  COMP_EVALUATION_JSON_SCHEMA,
  COMP_EVALUATION_SCHEMA_NAME,
  normalizeCompEvaluationDeliverable,
} from "@/comp-tool/schema";
import type {
  CompGenerationResult,
  CompModelProvider,
  CompModelUsage,
  CompPromptPackage,
} from "@/comp-tool/types";

type ResolvedProvider =
  | {
      provider: CompModelProvider;
      model: string;
      apiKey: string;
    }
  | {
      provider: null;
      model: null;
      apiKey: null;
      error: string;
    };

function getEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getModelRequestTimeoutMs() {
  const configuredValue = Number(getEnvironmentValue("MODEL_REQUEST_TIMEOUT_MS") ?? "");

  if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
    return 120000;
  }

  return Math.max(10000, Math.min(configuredValue, 300000));
}

async function fetchModelResponse(url: string, init: RequestInit) {
  const timeoutMs = getModelRequestTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Model request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveProvider(): ResolvedProvider {
  const preference = (getEnvironmentValue("LLM_PROVIDER") ?? "auto").toLowerCase();
  const openAiApiKey = getEnvironmentValue("OPENAI_API_KEY");
  const anthropicApiKey = getEnvironmentValue("ANTHROPIC_API_KEY");

  if (preference === "anthropic") {
    if (!anthropicApiKey) {
      return {
        provider: null,
        model: null,
        apiKey: null,
        error: "LLM_PROVIDER is set to anthropic but ANTHROPIC_API_KEY is missing.",
      };
    }

    return {
      provider: "anthropic",
      model: getEnvironmentValue("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6",
      apiKey: anthropicApiKey,
    };
  }

  if (preference === "openai") {
    if (!openAiApiKey) {
      return {
        provider: null,
        model: null,
        apiKey: null,
        error: "LLM_PROVIDER is set to openai but OPENAI_API_KEY is missing.",
      };
    }

    return {
      provider: "openai",
      model: getEnvironmentValue("OPENAI_MODEL") ?? "gpt-4o-mini",
      apiKey: openAiApiKey,
    };
  }

  if (anthropicApiKey) {
    return {
      provider: "anthropic",
      model: getEnvironmentValue("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6",
      apiKey: anthropicApiKey,
    };
  }

  if (openAiApiKey) {
    return {
      provider: "openai",
      model: getEnvironmentValue("OPENAI_MODEL") ?? "gpt-4o-mini",
      apiKey: openAiApiKey,
    };
  }

  return {
    provider: null,
    model: null,
    apiKey: null,
    error:
      "No model provider is configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to Render environment variables, or to .env.local for local development.",
  };
}

function buildUsage(inputTokens: number | null, outputTokens: number | null): CompModelUsage {
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens !== null || outputTokens !== null
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : null,
  };
}

function extractJsonFromText(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("The model response was empty.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fencedMatch =
      trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```([\s\S]*?)```/i);

    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("The model did not return valid JSON.");
  }
}

async function callOpenAiModel(promptPackage: CompPromptPackage, model: string, apiKey: string) {
  const response = await fetchModelResponse("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 5000,
      messages: [
        {
          role: "system",
          content: promptPackage.systemPrompt,
        },
        {
          role: "user",
          content: promptPackage.userPrompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: COMP_EVALUATION_SCHEMA_NAME,
          strict: true,
          schema: COMP_EVALUATION_JSON_SCHEMA,
        },
      },
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      `OpenAI request failed with status ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  const firstChoice =
    Array.isArray(payload.choices) && payload.choices.length
      ? (payload.choices[0] as Record<string, unknown>)
      : null;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const refusal = typeof message?.refusal === "string" ? message.refusal : null;

  if (refusal) {
    throw new Error(`OpenAI refused the request: ${refusal}`);
  }

  const rawText = typeof message?.content === "string" ? message.content : "";
  const parsed = extractJsonFromText(rawText);
  const evaluation = normalizeCompEvaluationDeliverable(parsed);
  const usageRecord = payload.usage as Record<string, unknown> | undefined;

  return {
    evaluation,
    rawText,
    usage: buildUsage(
      typeof usageRecord?.prompt_tokens === "number" ? usageRecord.prompt_tokens : null,
      typeof usageRecord?.completion_tokens === "number" ? usageRecord.completion_tokens : null,
    ),
  };
}

async function callAnthropicModel(
  promptPackage: CompPromptPackage,
  model: string,
  apiKey: string,
) {
  const response = await fetchModelResponse("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 5000,
      system: promptPackage.systemPrompt,
      tool_choice: {
        type: "any",
      },
      tools: [
        {
          name: COMP_EVALUATION_SCHEMA_NAME,
          description:
            "Return the DewClaw property evaluation in the required structured schema.",
          input_schema: COMP_EVALUATION_JSON_SCHEMA,
        },
      ],
      messages: [
        {
          role: "user",
          content: promptPackage.userPrompt,
        },
      ],
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      `Anthropic request failed with status ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  const contentBlocks = Array.isArray(payload.content)
    ? (payload.content as Array<Record<string, unknown>>)
    : [];
  const toolUseBlock = contentBlocks.find((block) => block.type === "tool_use");
  const textBlocks = contentBlocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => String(block.text));

  const rawText = toolUseBlock
    ? JSON.stringify(toolUseBlock.input ?? {}, null, 2)
    : textBlocks.join("\n\n").trim();
  const parsed = toolUseBlock?.input ? toolUseBlock.input : extractJsonFromText(rawText);
  const evaluation = normalizeCompEvaluationDeliverable(parsed);
  const usageRecord = payload.usage as Record<string, unknown> | undefined;

  return {
    evaluation,
    rawText,
    usage: buildUsage(
      typeof usageRecord?.input_tokens === "number" ? usageRecord.input_tokens : null,
      typeof usageRecord?.output_tokens === "number" ? usageRecord.output_tokens : null,
    ),
  };
}

export async function generateCompDeliverable(
  promptPackage: CompPromptPackage,
): Promise<CompGenerationResult> {
  const resolvedProvider = resolveProvider();

  if (!resolvedProvider.provider || !resolvedProvider.model || !resolvedProvider.apiKey) {
    const errorMessage = "error" in resolvedProvider ? resolvedProvider.error : "No model provider is configured.";

    return {
      status: "not_configured",
      provider: null,
      model: null,
      evaluation: null,
      rawText: null,
      error: errorMessage,
      artifactPath: null,
      usage: null,
    };
  }

  try {
    const result =
      resolvedProvider.provider === "openai"
        ? await callOpenAiModel(promptPackage, resolvedProvider.model, resolvedProvider.apiKey)
        : await callAnthropicModel(promptPackage, resolvedProvider.model, resolvedProvider.apiKey);

    return {
      status: "completed",
      provider: resolvedProvider.provider,
      model: resolvedProvider.model,
      evaluation: result.evaluation,
      rawText: result.rawText,
      error: null,
      artifactPath: null,
      usage: result.usage,
    };
  } catch (error) {
    return {
      status: "failed",
      provider: resolvedProvider.provider,
      model: resolvedProvider.model,
      evaluation: null,
      rawText: null,
      error: error instanceof Error ? error.message : "The model request failed.",
      artifactPath: null,
      usage: null,
    };
  }
}
