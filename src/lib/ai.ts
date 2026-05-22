import OpenAI from "openai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIMENSION || "768");

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${GEMINI_API_KEY}`;

  const requests = texts.map((text) => ({
    model: "models/gemini-embedding-001",
    content: { parts: [{ text }] },
    outputDimensionality: EMBEDDING_DIM,
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error: ${err}`);
  }

  const data = await response.json();
  return data.embeddings.map((e: { values: number[] }) => e.values);
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([query]);
  return embeddings[0];
}

// LLM Chat via Ollama (OpenAI-compatible)
export function getOpenAIClient(): OpenAI {
  return new OpenAI({
    baseURL: `${process.env.OLLAMA_BASE_URL}/v1`,
    apiKey: process.env.OLLAMA_BEARER_TOKEN || "ollama",
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

  if (!stream) {
    const response = await client.chat.completions.create({
      model: process.env.OLLAMA_MODEL || "gemma3:4b",
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 2000,
      stream: false,
    });
    return response.choices[0]?.message?.content || "";
  }

  const response = await client.chat.completions.create({
    model: process.env.OLLAMA_MODEL || "gemma3:4b",
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
