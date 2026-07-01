# Corporate AI Assistant Platform

Corporate AI Assistant merupakan platform chatbot AI terpadu yang dirancang khusus untuk lingkungan perkantoran perusahaan ("Kantor A"). Platform ini menyediakan asisten virtual terspesialisasi untuk berbagai departemen (seperti IT Dev, Talent Acquisition / TA, Human Capital / HC, dan Compliance).

## Tujuan Utama
1. **Bagi Karyawan:** Mempermudah pencarian informasi operasional sehari-hari dengan interaksi secara *real-time* ke berbagai bot tanpa harus menunggu merespon dari staf terkait.
2. **Bagi Manajer/Atasan:** Membantu mengidentifikasi *pain-points*, tren kendala operasional, dan celah informasi (*knowledge gap*) dari seluruh karyawan. Hal ini dicapai dengan menganalisa apa saja yang ditanyakan karyawan, mana yang bot belum punya jawabannya, dan bagaimana *feedback* mereka terhadap bot tersebut.

## Fitur Utama

### 🏢 Karyawan (End-User)
- **Multi-Bot Selection:** Bebas memilih departemen bot yang ingin diajak berinteraksi (IT Dev, TA, HC, Compliance).
- **Chat History:** Melihat riwayat percakapan sebelumnya.
- **Feedback System:** Memberikan penilaian atau umpan balik pada jawaban AI.

### 💼 Manajer (Admin / Supervisor)
- **📊 Analytics Dashboard:** Statistik penggunaan bot, rating kesuksesan, dan *feedback* karyawan.
- **❓ Unanswered Questions:** Laporan yang berisikan rincian pertanyaan karyawan yang *tidak dapat dijawab* oleh bot, sehingga manajer dapat menyusun solusi nyata atau memperbarui basis pengetahuan (Knowledge Base).
- **📈 Populer Topics & Clustering:** Pengelompokkan / Klastering pertanyaan yang paling sering diajukan karyawan. Manajer bisa melihat topik mana yang sedang *trending* (contoh: pertanyaan tentang aturan cuti, kendala VPN).
- **📚 Knowledge Base Management (Upload):** Fitur untuk mengunggah dan memperbarui dokumen Knowlegde Base (PDF/Doc) ke sistem agar bot semakin terupdate kedepannya.
- **⚙️ Bot & Akses Management:** Mengelola Data Bot, *Roles*, *Users* dan *Menus* (Role-Based Access Control) pada panel dashboard.

## Tech Stack
- **Framework:** Next.js 15+ (App Router)
- **Authentication:** NextAuth.js
- **Database / Vector Store:** Supabase (menggunakan PostgreSQL + pgVector untuk kemampuan Retrieval-Augmented Generation / RAG)
- **AI Processing:** Integrasi AI Tools (Vector Store, Text Splitter, Embedding Retrieval)
- **Styling:** TailwindCSS

## Getting Started

1. **Clone & Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Buat file `.env` dan lengkapi konfigurasi variabel yang dibutuhkan (seperti URL/Key Supabase, OpenAI/LLM API Keys, dan NextAuth Secret).

3. **Database Migration**
   Jalankan script SQL `supabase-migration.sql` pada koneksi Supabase/PostgreSQL anda untuk membuat skema tabel (termasuk fitur pgVector dan RAG).

4. **Run the Server**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000](http://localhost:3000).
