import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      roleType: string;
      roleId: string | null;
      botId: string | null;
      botSlug: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    roleType?: string;
    roleId?: string | null;
    botId?: string | null;
    botSlug?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    roleType?: string;
    roleId?: string | null;
    botId?: string | null;
    botSlug?: string | null;
  }
}
