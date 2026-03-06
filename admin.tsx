// Admin panel — /src/app/admin/page.tsx (or drop as admin.jsx artifact)
// Judges view all submissions, download files, mark reviewed

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qlbhikcofrdusdezvagu.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type Submission = {
  id: string;
  reg_no: string;
  file_path: string;
  file_name: string;
  file_type: string;
  submitted_at: string;
  reviewed: boolean;
};

function StatusBadge({ reviewed }: { reviewed: boolean }) {
  return (
    <span
      className={`font-mono text-[10px] tracking-widest px-2 py-0.5 border ${
        reviewed
          ? "border-green-500/40 text-green-400 bg-green-400/5"
          : "border-yellow-400/40 text-yellow-400 bg-yellow-400/5"
      }`}
    >
      {reviewed ? "REVIEWED" : "PENDING"}
    </span>
  );
}

export default function AdminPanel() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed">("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSubmissions();
  }, []);

  async function fetchSubmissions() {
    setLoading(true);
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) {
      setError("Failed to load submissions.");
    } else {
      setSubmissions(data || []);
    }
    setLoading(false);
  }

  async function toggleReviewed(id: string, current: boolean) {
    const { error } = await supabase
      .from("submissions")
      .update({ reviewed: !current })
      .eq("id", id);

    if (!error) {
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, reviewed: !current } : s))
      );
    }
  }

  async function downloadFile(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage
      .from("submissions")
      .download(filePath);

    if (error || !data) {
      alert("Download failed.");
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = submissions.filter((s) => {
    const matchSearch = s.reg_no.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "pending" && !s.reviewed) ||
      (filter === "reviewed" && s.reviewed);
    return matchSearch && matchFilter;
  });

  const pending = submissions.filter((s) => !s.reviewed).length;
  const reviewed = submissions.filter((s) => s.reviewed).length;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* CAD grid */}
      <div
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10 border-b border-white/5 pb-8">
          <div className="font-mono text-[10px] text-yellow-400/60 tracking-widest mb-2">
            BIS-VIT // ADMIN // STANDARDS-WRITING-2026
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Submissions Panel
          </h1>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-px max-w-sm">
            {[
              { label: "TOTAL", value: submissions.length },
              { label: "PENDING", value: pending },
              { label: "REVIEWED", value: reviewed },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/[0.02] border border-white/5 px-4 py-3"
              >
                <div className="font-mono text-[10px] text-white/30 tracking-widest mb-1">
                  {stat.label}
                </div>
                <div className="font-mono text-xl font-bold text-yellow-400">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search by reg no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 text-white text-sm px-4 py-2 font-mono placeholder-white/20 focus:outline-none focus:border-yellow-400/50 transition-colors w-64"
          />
          <div className="flex gap-px">
            {(["all", "pending", "reviewed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`font-mono text-[10px] tracking-widest uppercase px-4 py-2 border transition-colors ${
                  filter === f
                    ? "border-yellow-400 text-yellow-400 bg-yellow-400/5"
                    : "border-white/10 text-white/40 hover:text-white/70"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={fetchSubmissions}
            className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors ml-auto"
          >
            ↻ REFRESH
          </button>
        </div>

        {/* Table */}
        {error && (
          <div className="font-mono text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="font-mono text-xs text-white/30 tracking-widest py-16 text-center">
            LOADING SUBMISSIONS...
          </div>
        ) : filtered.length === 0 ? (
          <div className="font-mono text-xs text-white/20 tracking-widest py-16 text-center border border-white/5">
            NO SUBMISSIONS FOUND
          </div>
        ) : (
          <div className="border border-white/5">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-white/5 bg-white/[0.02]">
              {["#", "REG NO", "FILE", "SUBMITTED AT", "STATUS", "ACTIONS"].map(
                (h, i) => (
                  <div
                    key={h}
                    className={`font-mono text-[10px] text-white/25 tracking-widest ${
                      i === 0
                        ? "col-span-1"
                        : i === 1
                        ? "col-span-2"
                        : i === 2
                        ? "col-span-3"
                        : i === 3
                        ? "col-span-3"
                        : i === 4
                        ? "col-span-1"
                        : "col-span-2"
                    }`}
                  >
                    {h}
                  </div>
                )
              )}
            </div>

            {filtered.map((s, i) => (
              <div
                key={s.id}
                className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center"
              >
                <div className="col-span-1 font-mono text-[10px] text-white/20">
                  {String(i + 1).padStart(3, "0")}
                </div>
                <div className="col-span-2 font-mono text-xs text-yellow-400">
                  {s.reg_no}
                </div>
                <div className="col-span-3 text-xs text-white/60 truncate">
                  {s.file_name}
                  <span className="ml-2 font-mono text-[10px] text-white/25 uppercase">
                    .{s.file_type}
                  </span>
                </div>
                <div className="col-span-3 font-mono text-[10px] text-white/30">
                  {new Date(s.submitted_at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="col-span-1">
                  <StatusBadge reviewed={s.reviewed} />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    onClick={() => downloadFile(s.file_path, s.file_name)}
                    className="font-mono text-[10px] tracking-widest text-white/40 hover:text-yellow-400 transition-colors border border-white/10 hover:border-yellow-400/30 px-2 py-1"
                  >
                    ↓ DL
                  </button>
                  <button
                    onClick={() => toggleReviewed(s.id, s.reviewed)}
                    className="font-mono text-[10px] tracking-widest text-white/40 hover:text-white/80 transition-colors border border-white/10 hover:border-white/20 px-2 py-1"
                  >
                    {s.reviewed ? "UNREVIEW" : "MARK ✓"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
