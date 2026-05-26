export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "admin" | "user";
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
  title: string;
  created_at: string;
}

export interface UploadedFile {
  id: string;
  user_id: string;
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
