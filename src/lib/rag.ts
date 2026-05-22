import { generateQueryEmbedding, chatCompletion } from "./ai";
import { queryDocuments } from "./vectorstore";

const SYSTEM_PROMPT = `PERAN: Kamu adalah AI Assistant privat yang terikat HANYA pada dokumen yang diberikan.

INSTRUKSI MUTLAK - TIDAK BOLEH DILANGGAR:
- Kamu HANYA boleh menjawab menggunakan informasi dari "Konteks Dokumen" di bawah.
- Kamu DILARANG KERAS menggunakan pengetahuan umum atau informasi di luar konteks dokumen.
- Jika pertanyaan TIDAK BISA dijawab dari konteks dokumen, jawab PERSIS: "Maaf, saya tidak menemukan informasi tersebut dalam dokumen yang tersedia."
- Jangan menambahkan informasi yang tidak ada dalam dokumen.

FORMAT JAWABAN:
- Jawab dengan jelas berdasarkan dokumen.
- Sebutkan sumber (nama file, halaman) jika memungkinkan.
- Gunakan bahasa yang sama dengan pertanyaan.

Konteks Dokumen:
{context}`;

const NO_CONTEXT = "Maaf, saya tidak menemukan informasi yang relevan dalam dokumen yang tersedia. Pastikan dokumen yang berkaitan sudah diupload.";
const SIMILARITY_THRESHOLD = 0.5;

interface RAGResult {
  response: string;
  sources: { filename: string; pageNumber: number; similarity: number }[];
}

export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  stream: false
): Promise<RAGResult>;
export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  stream: true
): Promise<{ generator: AsyncIterable<string>; sources: RAGResult["sources"] }>;
export async function ragChat(
  query: string,
  history: { role: string; content: string }[],
  stream: boolean
) {
  // 1. Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);

  // 2. Search documents
  const results = await queryDocuments(queryEmbedding, 5);

  // 3. Filter by similarity
  const documents: { content: string; metadata: Record<string, unknown>; similarity: number }[] = [];
  if (results.ids[0]) {
    for (let i = 0; i < results.ids[0].length; i++) {
      const distance = (results.distances as number[][])?.[0]?.[i] ?? 1;
      const similarity = 1 - distance;
      if (similarity >= SIMILARITY_THRESHOLD) {
        documents.push({
          content: (results.documents as string[][])[0][i],
          metadata: (results.metadatas as Record<string, unknown>[][])[0][i],
          similarity,
        });
      }
    }
  }

  // 4. If no relevant docs, return static response
  const sources = documents.map((d) => ({
    filename: (d.metadata.filename as string) || "Unknown",
    pageNumber: (d.metadata.pageNumber as number) || 0,
    similarity: d.similarity,
  }));

  if (documents.length === 0) {
    if (stream) {
      async function* staticGen() { yield NO_CONTEXT; }
      return { generator: staticGen(), sources: [] };
    }
    return { response: NO_CONTEXT, sources: [] };
  }

  // 5. Build context
  const context = documents
    .map((d, i) => `[Sumber ${i + 1}: ${d.metadata.filename}, Halaman ${d.metadata.pageNumber}]\n${d.content}`)
    .join("\n\n---\n\n");

  // 6. Build messages
  const messages = [
    { role: "system", content: SYSTEM_PROMPT.replace("{context}", context) },
    ...history.slice(-10),
    { role: "user", content: query },
  ];

  // 7. Generate response
  if (stream) {
    const generator = await chatCompletion(messages, true);
    return { generator, sources };
  }

  const response = await chatCompletion(messages, false);
  return { response, sources };
}
