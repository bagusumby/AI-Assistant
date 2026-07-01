import nodemailer from "nodemailer";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createTransporter() {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const transporter = createTransporter();
  if (!transporter) return;
  await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || "AI Assistant"}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

function buildEmailLayout(title: string, body: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f1117;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;padding:0 16px;">
    <div style="background:#1a1d2e;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center;">
        <div style="width:56px;height:56px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-block;margin-bottom:16px;line-height:60px;font-size:28px;vertical-align:middle;">&#129302;</div>
        <h1 style="color:#ffffff;margin:0 0 6px;font-size:20px;font-weight:700;">${escapeHtml(title)}</h1>
        <p style="color:rgba(255,255,255,0.65);margin:0;font-size:13px;">Notifikasi dari AI Assistant</p>
      </div>
      <div style="padding:32px;color:#e5e7eb;">
        ${body}
      </div>
      <div style="padding:0 32px 28px;text-align:center;">
        <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">
          Buka AI Assistant
        </a>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.08);padding:20px 32px;text-align:center;">
        <p style="color:#6b7280;font-size:11px;margin:0;line-height:1.6;">
          Email ini dikirim otomatis oleh sistem AI Assistant.<br>
          Jika Anda merasa tidak pernah menggunakan layanan ini, abaikan email ini.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendUnansweredResolvedEmail({
  to,
  userName,
  question,
  answer,
  botName,
  appUrl,
}: {
  to: string;
  userName: string;
  question: string;
  answer?: string | null;
  botName: string;
  appUrl: string;
}) {
  const subject = `Pertanyaan Anda Telah Dijawab – ${botName}`;
  const body = `
    <p style="font-size:16px;margin:0 0 6px;color:#f3f4f6;">Halo, <strong>${escapeHtml(userName)}</strong>!</p>
    <p style="font-size:14px;color:#9ca3af;margin:0 0 24px;line-height:1.6;">
      Pertanyaan yang Anda ajukan kepada <strong style="color:#a5b4fc;">${escapeHtml(botName)}</strong> yang sebelumnya
      tidak dapat dijawab, kini telah mendapatkan jawaban baru dari tim kami.
    </p>

    <div style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.25);border-radius:10px;padding:16px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:600;color:#fb923c;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Pertanyaan Anda</p>
      <p style="font-size:14px;color:#e5e7eb;margin:0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(question)}</p>
    </div>

    ${answer ? `
    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="font-size:11px;font-weight:600;color:#34d399;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Jawaban</p>
      <p style="font-size:14px;color:#e5e7eb;margin:0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(answer)}</p>
    </div>
    ` : `
    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="font-size:14px;color:#e5e7eb;margin:0;line-height:1.6;">
        Pertanyaan Anda telah ditangani dan knowledge base AI telah diperbarui.
        Silakan coba tanyakan kembali melalui AI Assistant untuk mendapatkan jawaban terkini.
      </p>
    </div>
    `}

    <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:0;">
      Silakan login dan tanyakan kembali untuk mendapatkan jawaban yang telah diperbarui.
    </p>
  `;
  await sendEmail({ to, subject, html: buildEmailLayout(subject, body, appUrl) });
}

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  incomplete: "Jawaban Tidak Lengkap",
  incorrect: "Jawaban Tidak Akurat",
  unclear: "Jawaban Kurang Jelas",
  not_relevant: "Tidak Relevan",
  outdated: "Informasi Tidak Terkini",
  other: "Lainnya",
};

export async function sendFeedbackResolvedEmail({
  to,
  userName,
  feedbackMessage,
  feedbackType,
  answer,
  botName,
  appUrl,
}: {
  to: string;
  userName: string;
  feedbackMessage?: string | null;
  feedbackType?: string | null;
  answer?: string | null;
  botName: string;
  appUrl: string;
}) {
  const subject = `Feedback Anda Telah Ditanggapi – ${botName}`;
  const typeLabel = feedbackType ? (FEEDBACK_TYPE_LABELS[feedbackType] || feedbackType) : null;

  const body = `
    <p style="font-size:16px;margin:0 0 6px;color:#f3f4f6;">Halo, <strong>${escapeHtml(userName)}</strong>!</p>
    <p style="font-size:14px;color:#9ca3af;margin:0 0 24px;line-height:1.6;">
      Terima kasih atas feedback yang Anda berikan pada <strong style="color:#a5b4fc;">${escapeHtml(botName)}</strong>.
      Tim kami telah meninjau dan memperbaiki jawaban AI berdasarkan masukan Anda.
    </p>

    ${feedbackMessage || typeLabel ? `
    <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:16px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:600;color:#f87171;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">
        Feedback Anda${typeLabel ? ` &middot; ${escapeHtml(typeLabel)}` : ""}
      </p>
      ${feedbackMessage
        ? `<p style="font-size:14px;color:#e5e7eb;margin:0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(feedbackMessage)}</p>`
        : `<p style="font-size:14px;color:#9ca3af;margin:0;font-style:italic;">Tidak ada pesan tambahan</p>`
      }
    </div>
    ` : ""}

    ${answer ? `
    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="font-size:11px;font-weight:600;color:#34d399;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Jawaban yang Telah Diperbaiki</p>
      <p style="font-size:14px;color:#e5e7eb;margin:0;line-height:1.6;white-space:pre-wrap;">${escapeHtml(answer)}</p>
    </div>
    ` : `
    <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:16px;margin-bottom:24px;">
      <p style="font-size:14px;color:#e5e7eb;margin:0;line-height:1.6;">
        Feedback Anda telah ditangani dan knowledge base AI telah diperbarui untuk
        memberikan jawaban yang lebih baik ke depannya.
      </p>
    </div>
    `}

    <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:0;">
      Silakan login kembali untuk mencoba AI Assistant dengan jawaban yang telah diperbaiki.
    </p>
  `;
  await sendEmail({ to, subject, html: buildEmailLayout(subject, body, appUrl) });
}
