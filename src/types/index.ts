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

export type PriorityLevel = "high" | "medium" | "low";

export interface FeedbackReport {
  id: string;
  message_id?: string | null;
  session_id: string;
  user_id: string;
  ai_bot_id: string;
  feedback_type: FeedbackType;
  message?: string | null;
  created_at: string;
  resolved_at?: string | null;
  resolved_filename?: string | null;
  resolved_answer?: string | null;
  priority?: PriorityLevel | null;
  users?: { email: string; name: string };
  ai_bots?: { id: string; name: string };
  chat_messages?: { content: string } | null;
}

export interface ResponseTimeRecord {
  id: string;
  created_at: string;
  total_response_ms: number;
  first_token_ms: number | null;
  sources_count: number;
  was_unanswered: boolean;
}

export interface ResponseMetric {
  id: string;
  session_id: string;
  user_id: string;
  ai_bot_id: string;
  assistant_message_id?: string | null;
  sources_count: number;
  was_unanswered: boolean;
  first_token_ms?: number | null;
  total_response_ms?: number | null;
  created_at: string;
}

export interface AnalyticsSummary {
  totalMessages: number;
  totalFeedback: number;
  totalUnanswered: number;
  avgResponseMs: number | null;
  p95ResponseMs: number | null;
}

export interface TrafficPoint {
  label: string;
  count: number;
}

export interface HourlyTrafficPoint {
  hour: number;
  label: string;
  count: number;
}

export interface ResponseTimePoint {
  label: string;
  avgMs: number;
  p95Ms: number | null;
}

export interface TopUser {
  userId: string;
  name: string;
  email: string;
  count: number;
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  responseTimeSeries: ResponseTimePoint[];
  hourlyTraffic: HourlyTrafficPoint[];
  dailyTraffic: TrafficPoint[];
  weeklyTraffic: TrafficPoint[];
  monthlyTraffic: TrafficPoint[];
  topQuestioners: TopUser[];
  topFeedbackUsers: TopUser[];
  topUnansweredUsers: TopUser[];
  responseTimeDetail: ResponseTimeRecord[];
  botName: string;
  from: string;
  to: string;
}

export interface UnansweredQuestion {
  id: string;
  session_id: string;
  user_id: string;
  ai_bot_id: string;
  question: string;
  bot_response: string;
  created_at: string;
  resolved_at?: string | null;
  resolved_filename?: string | null;
  resolved_answer?: string | null;
  priority?: PriorityLevel | null;
  users?: { email: string; name: string };
  ai_bots?: { id: string; name: string };
}
