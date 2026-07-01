"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { AnalyticsData, TrafficPoint, TopUser, ResponseTimeRecord } from "@/types";

// ─── Export helpers (html-to-image handles modern CSS oklch/lab colors) ───────

async function captureAsPNG(el: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(el, { backgroundColor: "#030712", pixelRatio: 2, cacheBust: true });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}

async function captureAsPDF(el: HTMLElement, filename: string) {
  const { toPng } = await import("html-to-image");
  const { jsPDF } = await import("jspdf");
  const dataUrl = await toPng(el, { backgroundColor: "#030712", pixelRatio: 1.5, cacheBust: true });
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((res) => { img.onload = () => res(); });
  const ratio = img.naturalWidth / img.naturalHeight;
  const pdfW = 794;
  const pdfH = Math.round(pdfW / ratio);
  const pdf = new jsPDF({ orientation: ratio > 1 ? "landscape" : "portrait", unit: "px", format: [pdfW, pdfH] });
  pdf.addImage(dataUrl, "PNG", 0, 0, pdfW, pdfH);
  pdf.save(`${filename}.pdf`);
}

async function captureAllAsPDF(
  sections: Array<{ ref: React.RefObject<HTMLElement | null>; label: string }>,
  filename: string
) {
  const { toPng } = await import("html-to-image");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1024, 576] });
  let first = true;
  for (const { ref } of sections) {
    if (!ref.current) continue;
    const dataUrl = await toPng(ref.current, { backgroundColor: "#030712", pixelRatio: 1.5, cacheBust: true });
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((res) => { img.onload = () => res(); });
    const ratio = img.naturalWidth / img.naturalHeight;
    const pw = 1024, ph = Math.round(pw / ratio);
    if (!first) pdf.addPage([pw, ph], pw > ph ? "landscape" : "portrait");
    pdf.addImage(dataUrl, "PNG", 0, 0, pw, ph);
    first = false;
  }
  pdf.save(`${filename}.pdf`);
}

function downloadCSV(data: object[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? "")).join(",")
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

// ─── Recharts tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit = "" }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: p.color }} />
          {p.name}: <span className="font-semibold">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Export dropdown ──────────────────────────────────────────────────────────

function ExportMenu({
  sectionRef, filename, csvData,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
  filename: string;
  csvData?: object[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void> | void) => {
    setOpen(false);
    await new Promise<void>((r) => setTimeout(r, 220)); // wait for exit animation
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} disabled={busy} title="Export"
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-all disabled:opacity-50">
        {busy ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-20 glass border border-white/10 rounded-xl p-1 min-w-[138px] shadow-2xl"
            >
              {[
                { label: "Export PNG", action: () => sectionRef.current ? captureAsPNG(sectionRef.current, filename) : Promise.resolve() },
                { label: "Export PDF", action: () => sectionRef.current ? captureAsPDF(sectionRef.current, filename) : Promise.resolve() },
                ...(csvData ? [{ label: "Export CSV", action: () => { downloadCSV(csvData, filename); return Promise.resolve(); } }] : []),
              ].map(({ label, action }) => (
                <button key={label} onClick={() => run(action)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Refresh button ───────────────────────────────────────────────────────────

function RefreshBtn({ onClick, loading, title = "Refresh data" }: { onClick: () => void; loading?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={loading} title={title}
      className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all disabled:opacity-40">
      <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    </button>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5 animate-pulse">
      <div className="h-3 bg-white/10 rounded w-24 mb-4" />
      <div className="h-8 bg-white/10 rounded w-16 mb-2" />
      <div className="h-2 bg-white/5 rounded w-32" />
    </div>
  );
}

function SkeletonChart({ height = "h-72" }: { height?: string }) {
  return (
    <div className={`glass rounded-2xl p-6 border border-white/5 animate-pulse ${height}`}>
      <div className="h-4 bg-white/10 rounded w-48 mb-3" />
      <div className="h-2 bg-white/5 rounded w-32 mb-6" />
      <div className="flex-1 bg-white/5 rounded-xl h-40" />
    </div>
  );
}

// ─── Top users list ───────────────────────────────────────────────────────────

function TopUsersList({ users, emptyText, color, icon }: {
  users: TopUser[]; emptyText: string; color: string; icon: React.ReactNode;
}) {
  const colorMap: Record<string, string> = { indigo: "text-indigo-400", orange: "text-orange-400", purple: "text-purple-400" };
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm gap-2">
        <span>{icon}</span><span>{emptyText}</span>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {users.map((u, i) => (
        <div key={u.userId} className="flex items-center gap-3">
          <span className={`w-6 h-6 flex-shrink-0 rounded-lg text-[11px] font-bold flex items-center justify-center
            ${i === 0 ? "bg-yellow-500/20 text-yellow-300" : i === 1 ? "bg-gray-400/20 text-gray-300" : i === 2 ? "bg-orange-600/20 text-orange-400" : "bg-white/5 text-gray-500"}`}>
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200 truncate">{u.name !== "-" ? u.name : u.email}</p>
            {u.name !== "-" && <p className="text-xs text-gray-600 truncate">{u.email}</p>}
          </div>
          <span className={`text-sm font-semibold flex-shrink-0 ${colorMap[color] ?? "text-gray-400"}`}>{u.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Response Time Table ──────────────────────────────────────────────────────

function ResponseTimeTable({ records }: { records: ResponseTimeRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-600">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0113.5 18.375m5.625-14.25h1.5m-1.5 0A1.125 1.125 0 0018 4.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 4.5h-1.5m0 0A1.125 1.125 0 0016.5 5.625v1.5m0-3.75a1.125 1.125 0 00-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m-10.5 0h1.5m-1.5 0A1.125 1.125 0 006 5.625v1.5c0 .621.504 1.125 1.125 1.125M4.875 4.5h1.5m0 0a1.125 1.125 0 011.125 1.125v1.5m0-3.75a1.125 1.125 0 00-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125" /></svg>
        <p className="text-sm">Belum ada data metrik respons</p>
        <p className="text-xs opacity-60">Data muncul setelah bot menjawab pertanyaan</p>
      </div>
    );
  }
  return (
    <div className="overflow-auto max-h-64 -mx-1 px-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-white/5">
            {["Waktu", "Total Respons", "Status"].map((h, i) => (
              <th key={h} className={`py-2 pr-4 font-medium sticky top-0 bg-gray-950/80 backdrop-blur ${i === 0 ? "text-left" : "text-right"} ${i === 4 ? "pr-0" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <td className="py-2.5 pr-4 text-gray-400">{fmtDateTime(r.created_at)}</td>
              <td className="py-2.5 pr-4 text-right font-mono">
                <span className={`font-semibold ${r.total_response_ms > 10000 ? "text-red-400" : r.total_response_ms > 5000 ? "text-yellow-400" : "text-green-400"}`}>
                  {formatMs(r.total_response_ms)}
                </span>
              </td>
              <td className="py-2.5 text-right">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${r.was_unanswered ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"}`}>
                  {r.was_unanswered ? "Tak Terjawab" : "Terjawab"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const todayStr = new Date().toISOString().slice(0, 10);
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyAgo);
  const [to, setTo] = useState(todayStr);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [bots, setBots] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendView, setTrendView] = useState<"daily" | "weekly" | "monthly">("daily");
  const [rtView, setRtView] = useState<"chart" | "table">("chart");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);
  const responseTimeRef = useRef<HTMLDivElement>(null);
  const trafficRef = useRef<HTMLDivElement>(null);
  const peakHoursRef = useRef<HTMLDivElement>(null);
  const trendRef = useRef<HTMLDivElement>(null);
  const topUsersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/bots")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setBots(d.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))); })
      .catch(() => {});
  }, [isAdmin]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (isAdmin && selectedBotId) params.set("botId", selectedBotId);
    try {
      const res = await fetch(`/api/reports/analysis?${params}`);
      if (res.ok) { setData(await res.json()); setLastUpdated(new Date()); }
    } finally {
      setLoading(false);
    }
  }, [from, to, isAdmin, selectedBotId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportAllPDF = async () => {
    setExportBusy(true);
    try {
      await captureAllAsPDF(
        [summaryRef, responseTimeRef, trafficRef, topUsersRef].map((ref, i) => ({
          ref: ref as React.RefObject<HTMLElement | null>,
          label: ["summary", "response-time", "traffic", "top-users"][i],
        })),
        `dashboard-analytics-${from}-to-${to}`
      );
    } finally { setExportBusy(false); }
  };

  const exportAllCSV = () => {
    if (!data) return;
    const trend = trendView === "daily" ? data.dailyTraffic : trendView === "weekly" ? data.weeklyTraffic : data.monthlyTraffic;
    [
      [[data.summary], `summary-${from}-${to}`] as [object[], string],
      [data.responseTimeSeries, `response-time-series-${from}-${to}`],
      [data.responseTimeDetail, `response-time-detail-${from}-${to}`],
      [data.hourlyTraffic, `hourly-traffic-${from}-${to}`],
      [trend, `${trendView}-trend-${from}-${to}`],
      [data.topQuestioners, `top-questioners-${from}-${to}`],
      [data.topFeedbackUsers, `top-feedback-${from}-${to}`],
      [data.topUnansweredUsers, `top-unanswered-${from}-${to}`],
    ].forEach(([rows, name]) => { if ((rows as object[]).length) downloadCSV(rows as object[], name as string); });
  };

  const trendData: TrafficPoint[] = data
    ? trendView === "daily" ? data.dailyTraffic : trendView === "weekly" ? data.weeklyTraffic : data.monthlyTraffic
    : [];

  const peakHour = data?.hourlyTraffic.length
    ? data.hourlyTraffic.reduce((best, h) => (h.count > best.count ? h : best)).label
    : null;

  const avgLine = data?.summary.avgResponseMs ?? null;

  return (
    <div className="h-full overflow-y-auto bg-gray-950">
      <div className="p-6 pb-12 max-w-7xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold gradient-text">Dashboard Reporting Analysis</h1>
              <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-2">
                {data?.botName ?? (loading ? "Memuat data…" : "Analitik penggunaan AI Bot")}
                {lastUpdated && (
                  <span className="text-gray-600 text-xs">
                    · Diperbarui {lastUpdated.toLocaleTimeString("id-ID", { timeStyle: "short" })}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && bots.length > 0 && (
                <select value={selectedBotId} onChange={(e) => setSelectedBotId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-500 outline-none">
                  <option value="" className="bg-gray-900">Semua Bot</option>
                  {bots.map((b) => <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>)}
                </select>
              )}
              {!isAdmin && data?.botName && (
                <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-indigo-500/30">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-sm text-indigo-300 font-medium">{data.botName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-500 outline-none [color-scheme:dark]" />
                <span className="text-gray-600">—</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:border-indigo-500 outline-none [color-scheme:dark]" />
              </div>
              <RefreshBtn onClick={fetchData} loading={loading} title="Refresh semua data" />
              <button onClick={exportAllPDF} disabled={exportBusy || loading}
                className="px-3 py-2 rounded-xl glass border border-white/10 hover:border-indigo-500/50 text-sm text-gray-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                {exportBusy ? "Exporting…" : "Export PDF"}
              </button>
              <button onClick={exportAllCSV} disabled={!data || loading}
                className="px-3 py-2 rounded-xl glass border border-white/10 hover:border-green-500/50 text-sm text-gray-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Summary Cards ────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Ringkasan</h2>
            <div className="flex items-center gap-1">
              <RefreshBtn onClick={fetchData} loading={loading} />
              {!loading && data && (
                <ExportMenu sectionRef={summaryRef as React.RefObject<HTMLElement | null>}
                  filename={`summary-${from}-${to}`} csvData={[data.summary]} />
              )}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : (
            <div ref={summaryRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Chat", value: (data?.summary.totalMessages ?? 0).toLocaleString(), gradient: "from-indigo-500 to-blue-600", icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg> },
                { label: "Total Feedback", value: (data?.summary.totalFeedback ?? 0).toLocaleString(), gradient: "from-orange-500 to-red-500", icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.463-.943a6.8 6.8 0 001.04-3.682c0-1.17-.28-2.268-.771-3.243-.144-.282-.249-.566-.249-.857V5.11a.75.75 0 01.75-.75H9a.75.75 0 00-.75.75v.75m0 0v.75m0-.75H5.625c-.621 0-1.125.504-1.125 1.125v15c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H9.75" /></svg> },
                { label: "Pertanyaan Tak Terjawab", value: (data?.summary.totalUnanswered ?? 0).toLocaleString(), gradient: "from-purple-500 to-pink-500", icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg> },
                { label: "Rata-rata Respons Bot", value: formatMs(data?.summary.avgResponseMs ?? null), sub: data?.summary.p95ResponseMs ? `P95: ${formatMs(data.summary.p95ResponseMs)}` : undefined, gradient: "from-green-500 to-teal-500", icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              ].map(({ label, value, sub, gradient, icon }) => (
                <div key={label} className="glass rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-all">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center opacity-80 mb-4`}>{icon}</div>
                  <p className="text-3xl font-bold text-white mb-1">{value}</p>
                  <p className="text-sm text-gray-400">{label}</p>
                  {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Response Time ────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          {loading ? <SkeletonChart /> : (
            <div ref={responseTimeRef} className="glass rounded-2xl p-6 border border-white/5">
              <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <h2 className="font-semibold text-white">Performa Waktu Respons Bot</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {data?.summary.avgResponseMs != null && (
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs border border-indigo-500/20">Avg {formatMs(data.summary.avgResponseMs)}</span>
                    )}
                    {data?.summary.p95ResponseMs != null && (
                      <span className="px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-300 text-xs border border-purple-500/20">P95 {formatMs(data.summary.p95ResponseMs)}</span>
                    )}
                    {!!data?.responseTimeDetail?.length && (
                      <span className="px-2 py-0.5 rounded-lg bg-white/5 text-gray-400 text-xs">{data.responseTimeDetail.length} rekaman terbaru</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 glass rounded-lg p-0.5 border border-white/10">
                    {([["chart", "Grafik"], ["table", "Tabel"]] as const).map(([view, label]) => (
                      <button key={view} onClick={() => setRtView(view)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${rtView === view ? "bg-indigo-500/20 text-indigo-300" : "text-gray-500 hover:text-gray-300"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <RefreshBtn onClick={fetchData} loading={loading} />
                  <ExportMenu
                    sectionRef={responseTimeRef as React.RefObject<HTMLElement | null>}
                    filename={`response-time-${from}-${to}`}
                    csvData={rtView === "table" ? data?.responseTimeDetail : data?.responseTimeSeries}
                  />
                </div>
              </div>

              {rtView === "chart" && (
                <>
                  <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-indigo-400 inline-block rounded" />Avg respons</span>
                    <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-purple-400 inline-block rounded" style={{ borderTop: "2px dashed #c084fc", height: 0 }} />P95 respons</span>
                  </div>
                  {!data?.responseTimeSeries.length ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-600">
                      <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                      <p className="text-sm">Belum ada data metrik respons</p>
                      <p className="text-xs opacity-60">Data akan muncul setelah bot menjawab pertanyaan</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={data.responseTimeSeries} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`} width={52} />
                        <Tooltip content={({ active, payload, label: lb }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="glass border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
                              <p className="text-gray-400 mb-1.5 font-medium">{lb}</p>
                              {payload.map((p) => (
                                <p key={p.name} className="flex items-center gap-1.5" style={{ color: p.color }}>
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
                                  {p.name}: <span className="font-semibold">{formatMs(p.value as number)}</span>
                                </p>
                              ))}
                            </div>
                          );
                        }} />
                        {avgLine && <ReferenceLine y={avgLine} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />}
                        <Line type="monotone" dataKey="avgMs" name="Avg" stroke="#818cf8" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#818cf8" }} />
                        <Line type="monotone" dataKey="p95Ms" name="P95" stroke="#c084fc" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4, fill: "#c084fc" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}

              {rtView === "table" && <ResponseTimeTable records={data?.responseTimeDetail ?? []} />}
            </div>
          )}
        </motion.div>

        {/* ── Traffic Analysis ────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2"><SkeletonChart height="h-72" /></div>
              <div className="lg:col-span-3"><SkeletonChart height="h-72" /></div>
            </div>
          ) : (
            <div ref={trafficRef} className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div ref={peakHoursRef} className="lg:col-span-2 glass rounded-2xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-white">Peak Hours</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {peakHour ? <span>Puncak: <span className="text-indigo-400 font-medium">{peakHour}</span></span> : "Distribusi per jam"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <RefreshBtn onClick={fetchData} loading={loading} />
                    <ExportMenu sectionRef={peakHoursRef as React.RefObject<HTMLElement | null>}
                      filename={`peak-hours-${from}-${to}`} csvData={data?.hourlyTraffic} />
                  </div>
                </div>
                {!data?.hourlyTraffic.some((h) => h.count > 0) ? (
                  <div className="flex items-center justify-center h-48 text-gray-600 text-sm">Belum ada data traffic</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data?.hourlyTraffic} margin={{ left: -16, right: 0, top: 4, bottom: 0 }} barSize={9}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => v % 6 === 0 ? `${v}:00` : ""} interval={0} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip unit=" pesan" />} />
                      <Bar dataKey="count" name="Pesan" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div ref={trendRef} className="lg:col-span-3 glass rounded-2xl p-6 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-white">Tren Penggunaan</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{trendData.length} titik data</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {(["daily", "weekly", "monthly"] as const).map((view) => (
                        <button key={view} onClick={() => setTrendView(view)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${trendView === view ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}>
                          {view === "daily" ? "Harian" : view === "weekly" ? "Mingguan" : "Bulanan"}
                        </button>
                      ))}
                    </div>
                    <RefreshBtn onClick={fetchData} loading={loading} />
                    <ExportMenu sectionRef={trendRef as React.RefObject<HTMLElement | null>}
                      filename={`${trendView}-trend-${from}-${to}`} csvData={trendData} />
                  </div>
                </div>
                {!trendData.length ? (
                  <div className="flex items-center justify-center h-48 text-gray-600 text-sm">Belum ada data tren</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trendData} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false}
                        tickFormatter={(v: string) => trendView === "daily" ? `${v.slice(8)}/${v.slice(5, 7)}` : v}
                        interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip unit=" pesan" />} />
                      <Line type="monotone" dataKey="count" name="Pesan" stroke="#818cf8" strokeWidth={2.5}
                        dot={trendData.length <= 30 ? { r: 3, fill: "#818cf8" } : false}
                        activeDot={{ r: 5, fill: "#818cf8" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Top Users ───────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Aktivitas Pengguna</h2>
            <div className="flex items-center gap-1">
              <RefreshBtn onClick={fetchData} loading={loading} />
              {!loading && data && (
                <ExportMenu sectionRef={topUsersRef as React.RefObject<HTMLElement | null>}
                  filename={`top-users-${from}-${to}`}
                  csvData={[
                    ...data.topQuestioners.map((u) => ({ kategori: "Top Penanya", ...u })),
                    ...data.topFeedbackUsers.map((u) => ({ kategori: "Top Feedback", ...u })),
                    ...data.topUnansweredUsers.map((u) => ({ kategori: "Top Unanswered", ...u })),
                  ]}
                />
              )}
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <SkeletonChart key={i} height="h-64" />)}</div>
          ) : (
            <div ref={topUsersRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "Top Penanya", sub: "Paling banyak bertanya", users: data?.topQuestioners ?? [], color: "indigo", empty: "Belum ada data", iconBg: "bg-indigo-500/20", icon: <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg> },
                { title: "Top Pemberi Feedback", sub: "Paling banyak memberi feedback", users: data?.topFeedbackUsers ?? [], color: "orange", empty: "Belum ada feedback", iconBg: "bg-orange-500/20", icon: <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 01-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398-.306.774-1.086 1.227-1.918 1.227h-1.053c-.472 0-.745-.556-.463-.943a6.8 6.8 0 001.04-3.682c0-1.17-.28-2.268-.771-3.243-.144-.282-.249-.566-.249-.857V5.11a.75.75 0 01.75-.75H9a.75.75 0 00-.75.75v.75m0 0v.75m0-.75H5.625c-.621 0-1.125.504-1.125 1.125v15c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25c0-.621-.504-1.125-1.125-1.125H9.75" /></svg> },
                { title: "Top Pertanyaan Tak Terjawab", sub: "User dengan pertanyaan tak terjawab terbanyak", users: data?.topUnansweredUsers ?? [], color: "purple", empty: "Tidak ada pertanyaan tak terjawab", iconBg: "bg-purple-500/20", icon: <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg> },
              ].map(({ title, sub, users, color, empty, iconBg, icon }) => (
                <div key={title} className="glass rounded-2xl p-6 border border-white/5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
                    <div><h3 className="font-medium text-white text-sm">{title}</h3><p className="text-xs text-gray-500">{sub}</p></div>
                  </div>
                  <TopUsersList users={users} emptyText={empty} color={color} icon={icon} />
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
}
