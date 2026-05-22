/**
 * Vector store using SQLite for persistent storage.
 * No external server needed - embeddings stored directly in SQLite.
 * Cosine similarity computed in JavaScript.
 */
import db from "./db";

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS document_vectors (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    filename TEXT NOT NULL,
    page_number INTEGER DEFAULT 1,
    chunk_index INTEGER DEFAULT 0,
    user_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_vectors_filename ON document_vectors(filename);
`);

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function addDocuments(
  ids: string[],
  embeddings: number[][],
  documents: string[],
  metadatas: { filename: string; pageNumber: number; chunkIndex: number; userId: string }[]
) {
  const insert = db.prepare(
    "INSERT OR REPLACE INTO document_vectors (id, content, embedding, filename, page_number, chunk_index, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const transaction = db.transaction(() => {
    for (let i = 0; i < ids.length; i++) {
      insert.run(
        ids[i],
        documents[i],
        JSON.stringify(embeddings[i]),
        metadatas[i].filename,
        metadatas[i].pageNumber,
        metadatas[i].chunkIndex,
        metadatas[i].userId
      );
    }
  });

  transaction();
}

export function queryDocuments(
  queryEmbedding: number[],
  nResults: number = 5,
  threshold: number = 0.3
): { ids: string[][]; documents: string[][]; metadatas: Record<string, unknown>[][]; distances: number[][] } {
  const rows = db.prepare("SELECT id, content, embedding, filename, page_number, chunk_index FROM document_vectors").all() as {
    id: string;
    content: string;
    embedding: string;
    filename: string;
    page_number: number;
    chunk_index: number;
  }[];

  if (rows.length === 0) {
    return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };
  }

  // Calculate similarities
  const scored = rows.map((row) => {
    const embedding = JSON.parse(row.embedding) as number[];
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    return { ...row, similarity, distance: 1 - similarity };
  });

  // Sort by similarity (highest first) and filter by threshold
  scored.sort((a, b) => b.similarity - a.similarity);
  const filtered = scored.filter((r) => r.similarity >= threshold).slice(0, nResults);

  return {
    ids: [filtered.map((r) => r.id)],
    documents: [filtered.map((r) => r.content)],
    metadatas: [filtered.map((r) => ({ filename: r.filename, pageNumber: r.page_number, chunkIndex: r.chunk_index }))],
    distances: [filtered.map((r) => r.distance)],
  };
}

export function deleteByFilename(filename: string) {
  db.prepare("DELETE FROM document_vectors WHERE filename = ?").run(filename);
}

export function getDocumentCount(): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM document_vectors").get() as { count: number };
  return row.count;
}
