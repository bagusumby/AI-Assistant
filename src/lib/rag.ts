import { generateQueryEmbedding, chatCompletion } from "./ai";
import { queryDocuments } from "./vectorstore";

const SYSTEM_PROMPT = `PERAN: Kamu adalah AI Assistant privat yang terikat HANYA pada dokumen yang diberikan.

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
  userId: string,
  stream: false
): Promise<RAGResult>;
export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  userId: string,
  stream: true
): Promise<{ generator: AsyncIterable<string>; sources: RAGResult["sources"] }>;
export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  userId: string,
  stream: boolean
) {
  // 1. Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);

  // 2. Search documents via Supabase pgvector (shared knowledge base - no user filter)
  const results = await queryDocuments(queryEmbedding, null, 5, 0.3);

  // 3. Filter by similarity threshold (same as Python backend: min_score = 0.5)
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

  // 6. Build context (same format as Python backend)
  const context = relevantDocs
    .map((d, i) => `[Sumber ${i + 1}: ${d.metadata.filename}, Halaman ${d.metadata.page_number}]\n${d.content}`)
    .join("\n\n---\n\n");

  // 7. Build messages
  const messages = [
    { role: "system", content: SYSTEM_PROMPT.replace("{context}", context) },
    ...history.slice(-10),
    { role: "user", content: query },
  ];

  // 8. Generate response
  if (stream) {
    const generator = await chatCompletion(messages, true);
    return { generator, sources };
  }

  const response = await chatCompletion(messages, false);
  return { response, sources };
}
