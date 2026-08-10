"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

const LIMIT_OPTIONS = [10, 25, 50, 100];

export default function Pagination({ page, totalPages, total, limit, onPageChange, onLimitChange }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-white/10 text-sm">
      <div className="flex items-center gap-2 text-gray-400">
        <span>
          Menampilkan {from}-{to} dari {total} data
        </span>
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="ml-2 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
        >
          {LIMIT_OPTIONS.map((opt) => (
            <option key={opt} value={opt} className="bg-gray-900">
              {opt} / halaman
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Sebelumnya
        </button>
        <span className="px-3 py-1.5 text-gray-400">
          Halaman {page} dari {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Selanjutnya
        </button>
      </div>
    </div>
  );
}
