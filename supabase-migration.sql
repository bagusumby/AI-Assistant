-- ============================================
-- RAG AI Assistant - Full Database Setup
-- Drop semua dan buat ulang dari awal
-- Jalankan ini di Supabase SQL Editor
-- ============================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Drop semua table dan function yang ada
DROP TABLE IF EXISTS document_vectors CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS chat_history CASCADE;
DROP TABLE IF EXISTS uploaded_files CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop semua overload function
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'match_documents'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
    
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = 'delete_documents_by_filename'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- ============================================
-- CREATE TABLES
-- ============================================

-- 3. Users table (custom, untuk NextAuth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Documents table (vector store - embedding 2560 dim untuk qwen3-embedding:4b)
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(2560),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX documents_user_id_idx ON documents(user_id);

-- 5. Chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'Chat Baru',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON chat_sessions(user_id);

-- 6. Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON chat_messages(session_id);

-- 7. Uploaded files tracking
CREATE TABLE uploaded_files (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  total_chunks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_user ON uploaded_files(user_id);

-- ============================================
-- DISABLE ROW LEVEL SECURITY (validasi di backend via JWT)
-- ============================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files DISABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTIONS
-- ============================================

-- 8. Similarity search function
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(2560),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5,
    filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE 
        (filter_user_id IS NULL OR documents.user_id = filter_user_id)
        AND 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- 9. Delete documents by filename function
CREATE OR REPLACE FUNCTION delete_documents_by_filename(target_filename TEXT, target_user_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
    DELETE FROM documents 
    WHERE metadata->>'filename' = target_filename
    AND user_id = target_user_id;
$$;

-- ============================================
-- SEED ADMIN USER (admin@mail.com / Password@123)
-- ============================================

INSERT INTO users (name, email, password, role)
VALUES ('Admin', 'admin@mail.com', '$2b$10$rwpq8oYRLcKdBzmh9vIFk.l6PVh9PgPdwuPQeb31wfJ3i51ckKbk.', 'admin');

-- ============================================
-- NOTES:
-- - IVFFlat index untuk vector search (jalankan SETELAH ada ~100+ rows):
--   CREATE INDEX documents_embedding_idx ON documents 
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- ============================================
