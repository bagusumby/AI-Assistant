export interface Role {
  id: string;
  name: string;
  label: string;
  description?: string;
  type: "system" | "manager" | "user";
  created_at?: string;
}

export interface AiBot {
  id: string;
  name: string;
  slug: string;
  description?: string;
  manager_role_id?: string | null;
  chat_enabled: boolean;
  system_prompt?: string | null;
  created_at?: string;
  role?: Role;
}

export interface Menu {
  id: string;
  label: string;
  path: string;
  icon: string;
  sort_order: number;
  created_at?: string;
}

export interface RoleMenuPermission {
  id: string;
  role_id: string;
  menu_id: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  role_id?: string | null;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  ai_bot_id?: string | null;
  title: string;
  created_at: string;
}

export interface UploadedFile {
  id: string;
  user_id: string;
  ai_bot_id?: string | null;
  filename: string;
  file_size: number;
  total_chunks: number;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

export interface DocumentChunk {
  content: string;
  metadata: {
    filename: string;
    pageNumber: number;
    chunkIndex: number;
  };
  similarity?: number;
}

export type FeedbackType = "incomplete" | "incorrect" | "unclear" | "not_relevant" | "outdated" | "other";

export interface FeedbackReport {
  id: string;
  message_id?: string | null;
  session_id: string;
  user_id: string;
  ai_bot_id: string;
  feedback_type: FeedbackType;
  message?: string | null;
  created_at: string;
  users?: { email: string; name: string };
  ai_bots?: { id: string; name: string };
  chat_messages?: { content: string } | null;
}

export interface UnansweredQuestion {
  id: string;
  session_id: string;
  user_id: string;
  ai_bot_id: string;
  question: string;
  bot_response: string;
  created_at: string;
  users?: { email: string; name: string };
  ai_bots?: { id: string; name: string };
}
