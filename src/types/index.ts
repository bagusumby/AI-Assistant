export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  userId: string;
  filename: string;
  fileSize: number;
  totalChunks: number;
  status: "processing" | "completed" | "failed";
  createdAt: string;
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
