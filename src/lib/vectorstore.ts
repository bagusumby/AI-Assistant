/**
 * Vector store using Supabase pgvector for persistent storage.
 * Uses table 'documents' and RPC function 'match_documents'.
 * Documents are scoped per AI Bot via ai_bot_id.
 */
import { supabaseAdmin } from "./supabase";

export async function addDocuments(
  userId: string,
  botId: string,
  chunks: { content: string; metadata: { filename: string; pageNumber: number; chunkIndex: number; totalChunks: number } }[],
  embeddings: number[][]
) {
  const rows = chunks.map((chunk, i) => ({
    user_id: userId,
    ai_bot_id: botId,
    content: chunk.content,
    metadata: {
      filename: chunk.metadata.filename,
      page_number: chunk.metadata.pageNumber,
      chunk_index: chunk.metadata.chunkIndex,
      total_chunks: chunk.metadata.totalChunks,
    },
    embedding: JSON.stringify(embeddings[i]),
  }));

  // Insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabaseAdmin.from("documents").insert(batch);
    if (error) {
      throw new Error(`Failed to add documents: ${error.message}`);
    }
  }
}

export async function queryDocuments(
  queryEmbedding: number[],
  botId: string | null = null,
  nResults: number = 5,
  threshold: number = 0.3
): Promise<{
  documents: { content: string; metadata: Record<string, unknown>; similarity: number }[];
}> {
  const rpcParams: Record<string, unknown> = {
    query_embedding: JSON.stringify(queryEmbedding),
    match_threshold: threshold,
    match_count: nResults,
    filter_ai_bot_id: botId,
  };

  const { data, error } = await supabaseAdmin.rpc("match_documents", rpcParams);

  if (error) {
    console.error("Vector search error:", error);
    return { documents: [] };
  }

  if (!data || data.length === 0) {
    return { documents: [] };
  }

  return {
    documents: data.map((r: { content: string; metadata: Record<string, unknown> | null; similarity: number }) => ({
      content: r.content,
      metadata: r.metadata || {},
      similarity: r.similarity,
    })),
  };
}

export async function deleteByFilename(filename: string, botId: string) {
  const { error } = await supabaseAdmin.rpc("delete_documents_by_filename", {
    target_filename: filename,
    target_ai_bot_id: botId,
  });

  if (error) {
    // Fallback: direct delete
    await supabaseAdmin
      .from("documents")
      .delete()
      .eq("ai_bot_id", botId)
      .filter("metadata->>filename", "eq", filename);
  }
}

export async function getDocumentCount(botId?: string): Promise<number> {
  let query = supabaseAdmin
    .from("documents")
    .select("*", { count: "exact", head: true });

  if (botId) {
    query = query.eq("ai_bot_id", botId);
  }

  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}
