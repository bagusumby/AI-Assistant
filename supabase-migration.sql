-- ============================================
-- RAG AI Assistant - Full Database Setup (RBAC + Multi-Bot)
-- Drop semua dan buat ulang dari awal
-- Jalankan ini di Supabase SQL Editor
-- ============================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Drop semua table dan function yang ada
DROP TABLE IF EXISTS feedback_reports CASCADE;
DROP TABLE IF EXISTS unanswered_questions CASCADE;
DROP TABLE IF EXISTS role_menu_permissions CASCADE;
DROP TABLE IF EXISTS menus CASCADE;
DROP TABLE IF EXISTS ai_bots CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
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
        WHERE proname IN ('match_documents', 'delete_documents_by_filename')
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- ============================================
-- CREATE TABLES
-- ============================================

-- 3. Roles table (dynamic RBAC registry)
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('system', 'manager', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI Bots table
CREATE TABLE ai_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  manager_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  chat_enabled BOOLEAN DEFAULT true,
  system_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Menus table
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT DEFAULT 'default',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Role-Menu Permissions (many-to-many)
CREATE TABLE role_menu_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  UNIQUE(role_id, menu_id)
);

-- 7. Users table (custom, untuk NextAuth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Documents table (vector store - embedding 2560 dim untuk qwen3-embedding:4b)
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  ai_bot_id UUID REFERENCES ai_bots(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(2560),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX documents_user_id_idx ON documents(user_id);
CREATE INDEX documents_ai_bot_id_idx ON documents(ai_bot_id);

-- 9. Chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ai_bot_id UUID REFERENCES ai_bots(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'Chat Baru',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON chat_sessions(user_id);

-- 10. Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON chat_messages(session_id);

-- 11. Uploaded files tracking
CREATE TABLE uploaded_files (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  ai_bot_id UUID REFERENCES ai_bots(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  total_chunks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_user ON uploaded_files(user_id);
CREATE INDEX idx_files_bot ON uploaded_files(ai_bot_id);

-- ============================================
-- DISABLE ROW LEVEL SECURITY (validasi di backend via JWT)
-- ============================================

ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_bots DISABLE ROW LEVEL SECURITY;
ALTER TABLE menus DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_menu_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files DISABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTIONS
-- ============================================

-- 12. Similarity search filtered by ai_bot_id
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(2560),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 5,
    filter_ai_bot_id UUID DEFAULT NULL
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
        (filter_ai_bot_id IS NULL OR documents.ai_bot_id = filter_ai_bot_id)
        AND 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- 13. Delete documents by filename and bot
CREATE OR REPLACE FUNCTION delete_documents_by_filename(target_filename TEXT, target_ai_bot_id UUID)
RETURNS VOID
LANGUAGE sql
AS $$
    DELETE FROM documents
    WHERE metadata->>'filename' = target_filename
    AND ai_bot_id = target_ai_bot_id;
$$;

-- ============================================
-- SEED DATA
-- ============================================

-- Roles
INSERT INTO roles (name, label, description, type) VALUES
  ('admin', 'Admin', 'System administrator with full access', 'system'),
  ('user', 'User', 'Regular user with chat access only', 'system'),
  ('ta_manager', 'TA Manager', 'Talent Acquisition Manager - manages TA knowledge base', 'manager'),
  ('it_dev_manager', 'IT Dev Manager', 'IT Development Manager - manages IT Dev knowledge base', 'manager'),
  ('hc_manager', 'HC Manager', 'Human Capital Manager - manages HC knowledge base', 'manager'),
  ('compliance_manager', 'Compliance Manager', 'Compliance Manager - manages Compliance knowledge base', 'manager');

-- AI Bots
INSERT INTO ai_bots (name, slug, description, manager_role_id, chat_enabled) VALUES
  ('AI TA', 'ai_ta', 'AI Assistant untuk Talent Acquisition', (SELECT id FROM roles WHERE name = 'ta_manager'), true),
  ('AI IT Dev', 'ai_it_dev', 'AI Assistant untuk IT Development', (SELECT id FROM roles WHERE name = 'it_dev_manager'), true),
  ('AI HC', 'ai_hc', 'AI Assistant untuk Human Capital', (SELECT id FROM roles WHERE name = 'hc_manager'), true),
  ('AI Compliance', 'ai_compliance', 'AI Assistant untuk Compliance', (SELECT id FROM roles WHERE name = 'compliance_manager'), true);

-- Menus
INSERT INTO menus (label, path, icon, sort_order) VALUES
  ('Chat', '/chat', 'chat', 1),
  ('Upload', '/upload', 'upload', 2),
  ('Admin', '/admin', 'admin', 3),
  ('Kelola Users', '/admin/users', 'users', 4),
  ('Kelola Roles', '/admin/roles', 'roles', 5),
  ('Kelola Bot AI', '/admin/bots', 'bots', 6),
  ('Kelola Menu', '/admin/menus', 'menus', 7);

-- Role-Menu Permissions
-- Admin: all menus
INSERT INTO role_menu_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m WHERE r.name = 'admin';

-- User: Chat only
INSERT INTO role_menu_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m
WHERE r.name = 'user' AND m.path = '/chat';

-- Manager roles: Chat + Upload
INSERT INTO role_menu_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m
WHERE r.type = 'manager' AND m.path IN ('/chat', '/upload');

-- Seed Admin User (admin@mail.com / Password@123)
INSERT INTO users (name, email, password, role, role_id)
VALUES (
  'Admin',
  'admin@mail.com',
  '$2b$10$rwpq8oYRLcKdBzmh9vIFk.l6PVh9PgPdwuPQeb31wfJ3i51ckKbk.',
  'admin',
  (SELECT id FROM roles WHERE name = 'admin')
);

-- ============================================
-- NOTES:
-- - IVFFlat index untuk vector search (jalankan SETELAH ada ~100+ rows):
--   CREATE INDEX documents_embedding_idx ON documents
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- ============================================

-- ============================================
-- FEATURE: Feedback Report & Unanswered Questions
-- Jalankan blok ini jika database sudah ada (addendum migration)
-- ============================================

-- Feedback Reports table
CREATE TABLE feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ai_bot_id UUID REFERENCES ai_bots(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('incomplete', 'incorrect', 'unclear', 'not_relevant', 'outdated', 'other')),
  message TEXT,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolved_filename TEXT DEFAULT NULL,
  resolved_answer TEXT DEFAULT NULL,
  priority TEXT DEFAULT NULL CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_bot ON feedback_reports(ai_bot_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_resolved ON feedback_reports(resolved_at);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback_reports(priority);

ALTER TABLE feedback_reports DISABLE ROW LEVEL SECURITY;

-- Unanswered Questions table
CREATE TABLE unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ai_bot_id UUID REFERENCES ai_bots(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolved_filename TEXT DEFAULT NULL,
  resolved_answer TEXT DEFAULT NULL,
  priority TEXT DEFAULT NULL CHECK (priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unanswered_bot ON unanswered_questions(ai_bot_id);
CREATE INDEX IF NOT EXISTS idx_unanswered_user ON unanswered_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_unanswered_created ON unanswered_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unanswered_resolved ON unanswered_questions(resolved_at);
CREATE INDEX IF NOT EXISTS idx_unanswered_priority ON unanswered_questions(priority);

ALTER TABLE unanswered_questions DISABLE ROW LEVEL SECURITY;

-- Insert new menus (idempotent — skip if path already exists)
INSERT INTO menus (label, path, icon, sort_order)
SELECT 'Laporan Feedback', '/reports/feedback', 'feedback', 8
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE path = '/reports/feedback');

INSERT INTO menus (label, path, icon, sort_order)
SELECT 'Pertanyaan Tak Terjawab', '/reports/unanswered', 'unanswered', 9
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE path = '/reports/unanswered');

-- Grant report menus to admin role
INSERT INTO role_menu_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m
WHERE r.name = 'admin'
  AND m.path IN ('/reports/feedback', '/reports/unanswered')
  AND NOT EXISTS (
    SELECT 1 FROM role_menu_permissions rmp
    WHERE rmp.role_id = r.id AND rmp.menu_id = m.id
  );

-- NOTE: Grant report menus to specific manager roles via the Roles management UI.
-- Example for all manager roles:
-- INSERT INTO role_menu_permissions (role_id, menu_id)
-- SELECT r.id, m.id FROM roles r, menus m
-- WHERE r.type = 'manager'
--   AND m.path IN ('/reports/feedback', '/reports/unanswered')
--   AND NOT EXISTS (
--     SELECT 1 FROM role_menu_permissions rmp
--     WHERE rmp.role_id = r.id AND rmp.menu_id = m.id
--   );

-- ============================================
-- ADDENDUM: Knowledge Base Management Feature
-- Jalankan blok ini jika database sudah ada sebelumnya
-- (kolom-kolom baru untuk fitur resolved, priority, dll)
-- ============================================

-- Tambah kolom resolved + priority pada unanswered_questions
ALTER TABLE unanswered_questions
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_filename TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_answer TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT NULL;

-- Tambah kolom resolved + priority pada feedback_reports
ALTER TABLE feedback_reports
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_filename TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_answer TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT NULL;

-- Index untuk performa query filter
CREATE INDEX IF NOT EXISTS idx_unanswered_resolved ON unanswered_questions(resolved_at);
CREATE INDEX IF NOT EXISTS idx_unanswered_priority ON unanswered_questions(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_resolved ON feedback_reports(resolved_at);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback_reports(priority);

-- ============================================
-- FEATURE: Topik Populer (Topic Analytics)
-- ============================================

-- Topics table (topik-topik yang di-extract dari dokumen)
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_bot_id UUID REFERENCES ai_bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  embedding VECTOR(2560),
  question_count INT DEFAULT 0,
  sample_question TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ai_bot_id, name)
);

CREATE INDEX IF NOT EXISTS idx_topics_bot ON topics(ai_bot_id);
CREATE INDEX IF NOT EXISTS idx_topics_count ON topics(question_count DESC);

ALTER TABLE topics DISABLE ROW LEVEL SECURITY;

-- Topic Questions (relasi pertanyaan user ↔ topik)
CREATE TABLE IF NOT EXISTS topic_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  similarity FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_questions_topic ON topic_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_questions_user ON topic_questions(user_id);

ALTER TABLE topic_questions DISABLE ROW LEVEL SECURITY;

-- RPC Function: Match pertanyaan ke topik terdekat
CREATE OR REPLACE FUNCTION match_topic(
    query_embedding VECTOR(2560),
    filter_ai_bot_id UUID,
    match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (topic_id UUID, topic_name TEXT, similarity FLOAT)
LANGUAGE sql STABLE AS $$
    SELECT id, name, 1 - (embedding <=> query_embedding) AS similarity
    FROM topics
    WHERE ai_bot_id = filter_ai_bot_id
      AND 1 - (embedding <=> query_embedding) >= match_threshold
    ORDER BY embedding <=> query_embedding
    LIMIT 1;
$$;

-- RPC Function: Increment topic question count
CREATE OR REPLACE FUNCTION increment_topic_count(topic_id_param UUID)
RETURNS VOID
LANGUAGE sql AS $$
    UPDATE topics SET question_count = question_count + 1 WHERE id = topic_id_param;
$$;

-- Insert menu "Topik Populer"
INSERT INTO menus (label, path, icon, sort_order)
SELECT 'Topik Populer', '/reports/topics', 'topics', 10
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE path = '/reports/topics');

-- Grant to admin
INSERT INTO role_menu_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m
WHERE r.name = 'admin'
  AND m.path = '/reports/topics'
  AND NOT EXISTS (
    SELECT 1 FROM role_menu_permissions rmp
    WHERE rmp.role_id = r.id AND rmp.menu_id = m.id
  );

-- ============================================
-- FEATURE: Klaster Pertanyaan (Question Clustering from user chat)
-- ============================================

-- Question Clusters table (hasil batch LLM grouping dari pertanyaan user)
CREATE TABLE IF NOT EXISTS question_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_bot_id UUID REFERENCES ai_bots(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  question_count INT DEFAULT 0,
  sample_questions JSONB DEFAULT '[]',
  representative_question TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ai_bot_id, name)
);

CREATE INDEX IF NOT EXISTS idx_clusters_bot ON question_clusters(ai_bot_id);
CREATE INDEX IF NOT EXISTS idx_clusters_count ON question_clusters(question_count DESC);

ALTER TABLE question_clusters DISABLE ROW LEVEL SECURITY;

-- Cluster Items (pertanyaan user yang masuk ke cluster)
CREATE TABLE IF NOT EXISTS cluster_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID REFERENCES question_clusters(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  message_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cluster_items_cluster ON cluster_items(cluster_id);

ALTER TABLE cluster_items DISABLE ROW LEVEL SECURITY;

-- Insert menu "Klaster Pertanyaan"
INSERT INTO menus (label, path, icon, sort_order)
SELECT 'Klaster Pertanyaan', '/reports/clusters', 'clusters', 11
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE path = '/reports/clusters');

-- Grant to admin
INSERT INTO role_menu_permissions (role_id, menu_id)
SELECT r.id, m.id FROM roles r, menus m
WHERE r.name = 'admin'
  AND m.path = '/reports/clusters'
  AND NOT EXISTS (
    SELECT 1 FROM role_menu_permissions rmp
    WHERE rmp.role_id = r.id AND rmp.menu_id = m.id
  );
