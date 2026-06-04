import { generateQueryEmbedding, chatCompletion } from "./ai";
import { queryDocuments } from "./vectorstore";

const DEFAULT_SYSTEM_PROMPT = `PERAN: Kamu adalah AI Assistant privat yang terikat HANYA pada dokumen yang diberikan.

INSTRUKSI MUTLAK - TIDAK BOLEH DILANGGAR:
- Kamu HANYA boleh menjawab menggunakan informasi dari "Konteks Dokumen" di bawah.
- Kamu DILARANG KERAS menggunakan pengetahuan umum, pengetahuan pre-training, atau informasi apapun di luar konteks dokumen.
- Jika pertanyaan TIDAK BISA dijawab dari konteks dokumen, kamu HARUS menjawab PERSIS: "Maaf, saya tidak menemukan informasi tersebut dalam dokumen yang tersedia."
- Jangan menambahkan informasi tambahan, opini, atau penjelasan yang tidak ada dalam dokumen.
- Jangan menjawab pertanyaan yang tidak berkaitan dengan isi dokumen.

FORMAT JAWABAN:
- Jawab dengan jelas berdasarkan dokumen.
- Sebutkan sumber (nama file, halaman) jika memungkinkan.
- Gunakan bahasa yang sama dengan pertanyaan.

Konteks Dokumen:
{context}`;

const NO_CONTEXT = "Maaf, saya tidak menemukan informasi yang relevan dalam dokumen yang tersedia. Pastikan dokumen yang berkaitan sudah diupload.";
const SIMILARITY_THRESHOLD = 0.3;

interface RAGResult {
  response: string;
  sources: { filename: string; pageNumber: number; similarity: number }[];
}

export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  botId: string | null,
  stream: false,
  customSystemPrompt?: string | null
): Promise<RAGResult>;
export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  botId: string | null,
  stream: true,
  customSystemPrompt?: string | null
): Promise<{ generator: AsyncIterable<string>; sources: RAGResult["sources"] }>;
export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  botId: string | null,
  stream: boolean,
  customSystemPrompt?: string | null
) {
  // 1. Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);

  // 2. Search documents scoped to the AI bot's namespace
  const results = await queryDocuments(queryEmbedding, botId, 5, SIMILARITY_THRESHOLD);

  // 3. Filter by similarity threshold
  const relevantDocs = results.documents.filter((d) => d.similarity >= SIMILARITY_THRESHOLD);

  // 4. Build sources
  const sources = relevantDocs.map((d) => ({
    filename: (d.metadata.filename as string) || "Unknown",
    pageNumber: (d.metadata.page_number as number) || 0,
    similarity: d.similarity,
  }));

  // 5. If no relevant docs, return static response
  if (relevantDocs.length === 0) {
    if (stream) {
      async function* staticGen() { yield NO_CONTEXT; }
      return { generator: staticGen(), sources: [] };
    }
    return { response: NO_CONTEXT, sources: [] };
  }

  // 6. Build context
  const context = relevantDocs
    .map((d, i) => `[Sumber ${i + 1}: ${d.metadata.filename}, Halaman ${d.metadata.page_number}]\n${d.content}`)
    .join("\n\n---\n\n");

  // 7. Use custom system prompt if provided, else default
  const systemPromptTemplate = customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  const systemContent = systemPromptTemplate.replace("{context}", context);

  // 8. Build messages
  const messages = [
    { role: "system", content: systemContent },
    ...history.slice(-10),
    { role: "user", content: query },
  ];

  // 9. Generate response
  if (stream) {
    const generator = await chatCompletion(messages, true);
    return { generator, sources };
  }

  const response = await chatCompletion(messages, false);
  return { response, sources };
}
