import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qlbhikcofrdusdezvagu.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsYmhpa2NvZnJkdXNkZXp2YWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTM3NjgsImV4cCI6MjA4ODI4OTc2OH0.NLbYC2PrmsZtda3K-Mm2pvrUCgV1CTJS5eflJ1OTcxA";

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

function StatusBadge({ reviewed }) {
    return (
        <span
            className={`font-mono text-[10px] tracking-widest px-2 py-0.5 border ${reviewed
                ? "border-green-500/40 text-green-400 bg-green-400/5"
                : "border-yellow-400/40 text-yellow-400 bg-yellow-400/5"
                }`}
        >
            {reviewed ? "REVIEWED" : "PENDING"}
        </span>
    );
}

export default function AdminPanel() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginForm, setLoginForm] = useState({ user: "", pass: "" });
    const [loginError, setLoginError] = useState("");

    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [error, setError] = useState("");
    const [evaluating, setEvaluating] = useState(null);

    const fetchSubmissions = async () => {
        if (!supabase) {
            setError("Supabase client not initialized. Check your environment variables.");
            setLoading(false);
            return;
        }
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

    useEffect(() => {
        if (isLoggedIn) {
            const timer = setTimeout(() => {
                fetchSubmissions();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isLoggedIn]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (loginForm.user === "admin123" && loginForm.pass === "admin123") {
            setIsLoggedIn(true);
            setLoginError("");
        } else {
            setLoginError("Invalid credentials");
        }
    };

    const simulateAIEvaluation = async (s) => {
        setEvaluating(s.id);
        // Simulate delay showing "evaluating..."
        await new Promise(r => setTimeout(r, 2000));

        // Base a deterministic score off the roll number
        const scoreBase = s.reg_no.charCodeAt(s.reg_no.length - 1) % 4; // 0, 1, 2, 3
        const scores = [8.5, 9.2, 7.8, 8.9];
        const feedbacks = [
            "Good structure, lacks depth in technical definitions.",
            "Excellent adherence to BIS conventions. Very clear language.",
            "Formatting needs work. Flow is decent.",
            "Creative product choice. Minor ambiguity in scope."
        ];

        const finalScore = scores[scoreBase];
        const finalFeed = feedbacks[scoreBase];

        alert(`--- AI EVALUATION REPORT ---\nTarget: ${s.reg_no}\nFile: ${s.file_name}\n\nSCORE: ${finalScore}/10.0\n\nFEEDBACK:\n${finalFeed}`);
        setEvaluating(null);
    };

    async function toggleReviewed(id, current) {
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

    async function downloadFile(filePath, fileName, fileType, regNo) {
        const { data, error } = await supabase.storage
            .from("submissions")
            .download(filePath);

        if (error || !data) {
            alert("Download failed.");
            return;
        }

        // Ensure the filename has the correct extension
        const safeName = fileName.includes('.') ? fileName : `${fileName}.${fileType}`;
        const finalName = `${regNo}_${safeName}`;

        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = finalName;

        // Append to body before clicking so the browser respects the 'download' attribute
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

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

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center p-6">
                <div
                    className="fixed inset-0 opacity-20 pointer-events-none"
                    style={{
                        backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                />
                <div className="relative z-10 w-full max-w-sm border border-white/10 bg-white/[0.02] p-8">
                    <div className="font-mono text-[10px] text-yellow-400/60 tracking-widest mb-6">RESTRICTED AREA // ADMIN AUTH</div>
                    {loginError && (
                        <div className="font-mono text-xs text-red-400 border border-red-400/20 bg-red-400/5 px-4 py-3 mb-6">
                            {loginError}
                        </div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="font-mono text-[10px] text-white/30 tracking-widest block mb-1.5">USERNAME</label>
                            <input
                                type="text"
                                value={loginForm.user}
                                onChange={(e) => setLoginForm({ ...loginForm, user: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 text-white text-sm px-4 py-2 font-mono placeholder-white/20 focus:outline-none focus:border-yellow-400/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="font-mono text-[10px] text-white/30 tracking-widest block mb-1.5">PASSWORD</label>
                            <input
                                type="password"
                                value={loginForm.pass}
                                onChange={(e) => setLoginForm({ ...loginForm, pass: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 text-white text-sm px-4 py-2 font-mono placeholder-white/20 focus:outline-none focus:border-yellow-400/50 transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            className="group relative w-full font-mono text-sm tracking-widest uppercase py-2.5 border border-yellow-400 text-yellow-400 overflow-hidden transition-colors duration-300 hover:text-black mt-4"
                        >
                            <span className="absolute inset-0 bg-yellow-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                            <span className="relative">AUTHENTICATE</span>
                        </button>
                    </form>
                </div>
            </div>
        );
    }

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
                    <div className="font-mono text-[10px] text-yellow-400/60 tracking-widest mb-2 flex items-center gap-4">
                        <a href="/" className="hover:text-yellow-400 px-2 border border-yellow-400/20">{"< HOME"}</a>
                        BIS-VIT // ADMIN // STANDARDS-WRITING-2026
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-white mt-4">
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
                        {["all", "pending", "reviewed"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`font-mono text-[10px] tracking-widest uppercase px-4 py-2 border transition-colors ${filter === f
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
                    <div className="border border-white/5 overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Table header */}
                            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                                {["#", "REG NO", "FILE", "SUBMITTED AT", "STATUS", "ACTIONS"].map(
                                    (h, i) => (
                                        <div
                                            key={h}
                                            className={`font-mono text-[10px] text-white/25 tracking-widest ${i === 0
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
                                    <div className="col-span-2 flex gap-1">
                                        <button
                                            onClick={() => downloadFile(s.file_path, s.file_name, s.file_type, s.reg_no)}
                                            className="font-mono text-[10px] tracking-widest text-white/40 hover:text-yellow-400 transition-colors border border-white/10 hover:border-yellow-400/30 px-2 py-1"
                                        >
                                            ↓ DL
                                        </button>
                                        <button
                                            onClick={() => simulateAIEvaluation(s)}
                                            disabled={evaluating === s.id}
                                            className="font-mono text-[10px] tracking-widest text-yellow-400/80 hover:text-yellow-400 transition-colors border border-yellow-400/30 hover:bg-yellow-400/10 px-2 py-1 disabled:opacity-50"
                                        >
                                            {evaluating === s.id ? "EVAL..." : "AI EVAL"}
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
                    </div>
                )}
            </div>
        </div>
    );
}
