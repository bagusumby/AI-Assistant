import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const bcrypt = await import("bcryptjs");
        const { supabaseAdmin } = await import("@/lib/supabase");

        const { data: user, error } = await supabaseAdmin
          .from("users")
          .select("id, name, email, password, role")
          .eq("email", credentials.email as string)
          .single();

        if (error || !user) return null;

        const valid = await bcrypt.compare(credentials.password as string, user.password);
        if (!valid) return null;

        // Look up the role type from the roles table using the role slug
        let roleType = "user";
        let roleId: string | null = null;
        if (user.role === "admin") {
          roleType = "admin";
        } else if (user.role) {
          const { data: roleData } = await supabaseAdmin
            .from("roles")
            .select("id, type")
            .eq("name", user.role)
            .single();
          if (roleData) {
            roleType = roleData.type || "user";
            roleId = roleData.id;
          }
        }

        // If manager, get their linked AI bot
        let botId: string | null = null;
        let botSlug: string | null = null;
        if (roleType === "manager" && roleId) {
          const { data: bot } = await supabaseAdmin
            .from("ai_bots")
            .select("id, slug")
            .eq("manager_role_id", roleId)
            .single();
          if (bot) {
            botId = bot.id;
            botSlug = bot.slug;
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roleType,
          roleId,
          botId,
          botSlug,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "user";
        token.roleType = (user as { roleType?: string }).roleType || "user";
        token.roleId = (user as { roleId?: string | null }).roleId ?? null;
        token.botId = (user as { botId?: string | null }).botId ?? null;
        token.botSlug = (user as { botSlug?: string | null }).botSlug ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || "user";
        session.user.roleType = (token.roleType as string) || "user";
        session.user.roleId = (token.roleId as string | null) ?? null;
        session.user.botId = (token.botId as string | null) ?? null;
        session.user.botSlug = (token.botSlug as string | null) ?? null;
      }
      return session;
    },
  },
});
