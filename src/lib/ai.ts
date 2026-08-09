import OpenAI from "openai";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || "";
const OLLAMA_TOKEN = process.env.OLLAMA_BEARER_TOKEN || process.env.NEXT_PUBLIC_OLLAMA_BEARER_TOKEN || "ollama";
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || "qwen3-embedding:4b";

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!OLLAMA_BASE_URL) {
    throw new Error("OLLAMA_BASE_URL belum diset di environment variables server");
  }

  // Process in batches of 20 (same as Python backend)
  const batchSize = 20;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OLLAMA_TOKEN}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch,
        }),
      });
    } catch (fetchError: unknown) {
      const cause = fetchError instanceof Error && fetchError.cause ? ` (${String(fetchError.cause)})` : "";
      const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      throw new Error(`Tidak dapat terhubung ke Ollama di ${OLLAMA_BASE_URL}: ${msg}${cause}`);
    }

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Embedding API error: ${err}`);
    }

    const data = await response.json();
    allEmbeddings.push(...data.embeddings);
  }

  return allEmbeddings;
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([query]);
  return embeddings[0];
}

// LLM Chat via Ollama (OpenAI-compatible)
export function getOpenAIClient(): OpenAI {
  return new OpenAI({
    baseURL: `${OLLAMA_BASE_URL}/v1`,
    apiKey: OLLAMA_TOKEN,
  });
}

export async function chatCompletion(
  messages: { role: string; content: string }[],
  stream: false
): Promise<string>;
export async function chatCompletion(
  messages: { role: string; content: string }[],
  stream: true
): Promise<AsyncIterable<string>>;
export async function chatCompletion(
  messages: { role: string; content: string }[],
  stream: boolean
): Promise<string | AsyncIterable<string>> {
  const client = getOpenAIClient();
  const model = process.env.OLLAMA_MODEL || process.env.NEXT_PUBLIC_OLLAMA_MODEL || "gemma3:4b";

  if (!stream) {
    const response = await client.chat.completions.create({
      model,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 2000,
      stream: false,
    });
    return response.choices[0]?.message?.content || "";
  }

  const response = await client.chat.completions.create({
    model,
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    temperature: 0.7,
    max_tokens: 2000,
    stream: true,
  });

  async function* streamGenerator() {
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }

  return streamGenerator();
}
