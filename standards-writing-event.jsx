import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
// @react-three/drei imports removed — ShatterShell uses native R3F primitives only
import * as THREE from "three";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const NAV_LINKS = ["Overview", "Schedule", "Rules", "Submit"];

const SCHEDULE = [
    {
        id: "CAT-01",
        time: "14:00 — 14:45",
        label: "Learning Session",
        duration: "45 MIN",
        desc: "Introduction to BIS standards structure, clauses, definitions, scope, references, and annexures. Formatting, numbering, and writing methodology.",
        tags: ["BIS FORMAT", "TERMINOLOGY", "STRUCTURE"],
    },
    {
        id: "CAT-02",
        time: "14:45 — 15:45",
        label: "Standards Writing Competition",
        duration: "60 MIN",
        desc: "Teams draft a complete standard document for a product used by women — personal care, safety devices, health & hygiene, wearables, or household appliances.",
        tags: ["TEAM 2", "DRAFTING", "JUDGED"],
    },
    {
        id: "CAT-03",
        time: "15:45 — 16:00",
        label: "Results & Closing",
        duration: "15 MIN",
        desc: "Cumulative scores tallied. Winners declared. Closing remarks.",
        tags: ["CEREMONY", "AWARDS"],
    },
];

const RULES = [
    { code: "R-01", text: "Teams of up to 2 members per submission." },
    { code: "R-02", text: "All drafts must follow BIS standard formatting conventions." },
    { code: "R-03", text: "Products must be relevant to women's daily use — personal care, safety, health, wearables, or appliances." },
    { code: "R-04", text: "Time limits are strictly enforced. Submissions after cutoff are disqualified." },
    { code: "R-05", text: "Highest cumulative points across both categories wins." },
];

const CRITERIA = [
    { id: "J-01", label: "Accuracy", desc: "Technical correctness of drafted standard clauses." },
    { id: "J-02", label: "Formatting", desc: "Compliance with BIS numbering and structural conventions." },
    { id: "J-03", label: "Clarity", desc: "Precision and unambiguity of language used." },
    { id: "J-04", label: "Completeness", desc: "All required sections present: scope, definitions, references, annexures." },
    { id: "J-05", label: "Creativity", desc: "Relevance to theme and quality of product selection." },
];

// ─── NOISE HELPERS ────────────────────────────────────────────────────────────
function noise3(x, y, z) {
    return Math.sin(x * 1.7 + y * 2.3) * Math.cos(y * 1.4 + z * 1.9) * Math.sin(z * 2.1 + x * 1.3);
}
function noise3b(x, y, z) {
    return (
        Math.sin(x * 3.1 + z * 1.7) * 0.5 +
        Math.cos(y * 2.8 + x * 1.3) * 0.3 +
        Math.sin(z * 2.4 + y * 2.1) * 0.2
    );
}

// ─── 3D OBJECT: SHATTER SHELL ────────────────────────────────────────────────
function FloatingGeometry() {
    const coreRef = useRef();
    const shellRef = useRef();
    const ringRef = useRef();
    const coreOriginal = useRef(null);
    const shellOriginal = useRef(null);

    useFrame((state, delta) => {
        const t = state.clock.elapsedTime;

        // ── Core: smooth noise morph ──
        if (coreRef.current) {
            coreRef.current.rotation.y += delta * 0.1;
            const geo = coreRef.current.geometry;
            if (!coreOriginal.current) {
                coreOriginal.current = new Float32Array(geo.attributes.position.array);
            }
            const posAttr = geo.attributes.position;
            const orig = coreOriginal.current;
            const pos = posAttr.array;
            for (let i = 0; i < posAttr.count; i++) {
                const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
                const ox = orig[ix], oy = orig[iy], oz = orig[iz];
                const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
                const nx = ox / len, ny = oy / len, nz = oz / len;
                const n = noise3(nx * 2.5 + t * 0.3, ny * 2.5 + t * 0.25, nz * 2.5 + t * 0.28);
                const d = 0.9 + n * 0.12;
                pos[ix] = nx * d; pos[iy] = ny * d; pos[iz] = nz * d;
            }
            posAttr.needsUpdate = true;
            geo.computeVertexNormals();
        }

        // ── Shell: chunkier slower displacement, counter-rotates ──
        if (shellRef.current) {
            shellRef.current.rotation.y -= delta * 0.04;
            shellRef.current.rotation.x = Math.sin(t * 0.12) * 0.15;
            const geo = shellRef.current.geometry;
            if (!shellOriginal.current) {
                shellOriginal.current = new Float32Array(geo.attributes.position.array);
            }
            const posAttr = geo.attributes.position;
            const orig = shellOriginal.current;
            const pos = posAttr.array;
            for (let i = 0; i < posAttr.count; i++) {
                const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
                const ox = orig[ix], oy = orig[iy], oz = orig[iz];
                const len = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
                const nx = ox / len, ny = oy / len, nz = oz / len;
                const n = noise3b(nx * 1.5 + t * 0.15, ny * 1.5 + t * 0.12, nz * 1.5 + t * 0.18);
                const d = 1.45 + n * 0.22;
                pos[ix] = nx * d; pos[iy] = ny * d; pos[iz] = nz * d;
            }
            posAttr.needsUpdate = true;
        }

        // ── Ring: slow tilt + float ──
        if (ringRef.current) {
            ringRef.current.rotation.x = Math.sin(t * 0.18) * 0.6;
            ringRef.current.rotation.z = t * 0.04;
        }
    });

    return (
        <group>
            {/* Inner gold core — emissive-heavy so it reads gold without env map */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[0.9, 64, 64]} />
                <meshStandardMaterial
                    color="#ffd700"
                    emissive="#ffa500"
                    emissiveIntensity={0.55}
                    metalness={0.6}
                    roughness={0.25}
                />
            </mesh>

            {/* Outer wireframe shell */}
            <mesh ref={shellRef}>
                <sphereGeometry args={[1.45, 32, 32]} />
                <meshBasicMaterial color="#ffd700" wireframe transparent opacity={0.15} />
            </mesh>

            {/* Equatorial ring */}
            <mesh ref={ringRef}>
                <torusGeometry args={[1.2, 0.006, 4, 120]} />
                <meshBasicMaterial color="#ffd700" transparent opacity={0.35} />
            </mesh>
        </group>
    );
}

// ─── PRELOADER ────────────────────────────────────────────────────────────────
function Preloader({ onDone }) {
    const [step, setStep] = useState(0);
    const lines = [
        "INITIALIZING EVENT MODULE...",
        "LOADING BIS PROTOCOL v2.6.1...",
        "STANDARDS WRITING // IWD 2026",
        "SYSTEM READY",
    ];
    useEffect(() => {
        if (step < lines.length) {
            const t = setTimeout(() => setStep((s) => s + 1), step === lines.length - 1 ? 600 : 420);
            return () => clearTimeout(t);
        } else {
            const t = setTimeout(onDone, 500);
            return () => clearTimeout(t);
        }
    }, [step]);
    return (
        <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
        >
            <div className="relative mb-10">
                <div className="w-20 h-20 rounded-full border border-yellow-400/30 animate-spin" style={{ animationDuration: "3s" }} />
                <div className="absolute inset-2 rounded-full border border-yellow-400/60 animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
                <div className="absolute inset-5 rounded-full border border-yellow-400 animate-pulse" />
            </div>
            <div className="font-mono text-xs space-y-1.5 w-72">
                {lines.map((line, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={step > i ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.3 }}
                        className={`flex gap-2 ${i === lines.length - 1 ? "text-yellow-400" : "text-white/50"}`}
                    >
                        <span className="text-yellow-400/50">{`>`}</span>
                        <span>{line}</span>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 40);
        window.addEventListener("scroll", handler);
        return () => window.removeEventListener("scroll", handler);
    }, []);
    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? "border-b border-white/10 bg-black/80 backdrop-blur-md" : ""}`}
        >
            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="font-mono text-xs text-yellow-400 tracking-widest">
                    BIS-VIT // SW-2026
                </div>
                <div className="hidden md:flex items-center gap-8">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link}
                            href={`#${link.toLowerCase()}`}
                            className="font-mono text-xs text-white/50 hover:text-yellow-400 transition-colors duration-200 tracking-widest uppercase relative group"
                        >
                            {link}
                            <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-yellow-400 group-hover:w-full transition-all duration-300" />
                        </a>
                    ))}
                </div>
                <div className="font-mono text-xs text-white/30">
                    09 MAR 2026
                </div>
            </div>
        </motion.nav>
    );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────
function Hero() {
    const containerRef = useRef();
    const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start start", "end start"] });
    const y3d = useTransform(scrollYProgress, [0, 1], [0, 120]);
    const opacity3d = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

    const words = ["STANDARDS", "WRITING"];

    return (
        <section ref={containerRef} id="overview" className="relative min-h-screen flex items-center overflow-hidden bg-black">
            {/* CAD grid background */}
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                }}
            />
            {/* Radial gradient overlay */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black" style={{ background: "radial-gradient(ellipse at 60% 50%, rgba(255,215,0,0.04) 0%, transparent 60%)" }} />

            {/* 3D Canvas */}
            <motion.div
                style={{ y: y3d, opacity: opacity3d }}
                className="absolute right-0 top-0 w-full md:w-1/2 h-full pointer-events-none"
            >
                <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }}>
                    <ambientLight intensity={0.6} />
                    <pointLight position={[4, 4, 4]} color="#ffd700" intensity={4} />
                    <pointLight position={[-3, -2, 3]} color="#ffffff" intensity={1.2} />
                    <pointLight position={[0, 3, 2]} color="#ffeeaa" intensity={2} />
                    <FloatingGeometry />
                </Canvas>
            </motion.div>

            {/* Foreground text */}
            <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24">
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    className="font-mono text-xs text-yellow-400/70 tracking-widest mb-6 flex items-center gap-3"
                >
                    <span className="w-8 h-px bg-yellow-400/50" />
                    STATUS: ACTIVE // BIS STANDARDS CLUB VIT // IWD 2026
                </motion.div>

                <div className="overflow-hidden">
                    {words.map((word, i) => (
                        <motion.div
                            key={word}
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 + i * 0.15, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="block text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white leading-none"
                        >
                            {i === 1 ? (
                                <span className="text-transparent" style={{ WebkitTextStroke: "1px rgba(255,215,0,0.8)" }}>
                                    {word}
                                </span>
                            ) : word}
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="mt-8 max-w-lg"
                >
                    <p className="text-white/50 text-base leading-relaxed">
                        Draft real-world BIS standards for products that impact women's lives. Learn the language of quality, safety, and compliance — then write it yourself.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75, duration: 0.5 }}
                    className="mt-10 flex flex-wrap items-center gap-6"
                >
                    <a
                        href="#submit"
                        className="group relative font-mono text-sm tracking-widest uppercase px-8 py-3 border border-yellow-400 text-yellow-400 overflow-hidden transition-colors duration-300 hover:text-black"
                    >
                        <span className="absolute inset-0 bg-yellow-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        <span className="relative">SUBMIT DRAFT</span>
                    </a>
                    <a href="#schedule" className="font-mono text-xs text-white/40 hover:text-white/80 transition-colors tracking-widest uppercase flex items-center gap-2">
                        VIEW SCHEDULE <span className="text-yellow-400">↓</span>
                    </a>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.6 }}
                    className="mt-16 grid grid-cols-3 gap-px border border-white/10 max-w-md"
                >
                    {[
                        { label: "DATE", value: "09 MAR 2026" },
                        { label: "VENUE", value: "CS HALL" },
                        { label: "TIME", value: "14:00–16:00" },
                    ].map((item) => (
                        <div key={item.label} className="bg-white/[0.02] px-4 py-3">
                            <div className="font-mono text-[10px] text-white/30 tracking-widest mb-1">{item.label}</div>
                            <div className="font-mono text-xs text-yellow-400 font-bold">{item.value}</div>
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black to-transparent" />
        </section>
    );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ index, label, title }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-14"
        >
            <div className="font-mono text-xs text-yellow-400/60 tracking-widest mb-3 flex items-center gap-3">
                <span className="w-6 h-px bg-yellow-400/40" />
                {index} // {label}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{title}</h2>
        </motion.div>
    );
}

// ─── SCHEDULE SECTION ─────────────────────────────────────────────────────────
function Schedule() {
    const [active, setActive] = useState(null);
    return (
        <section id="schedule" className="py-24 bg-black border-t border-white/5">
            <div className="max-w-6xl mx-auto px-6">
                <SectionHeader index="02" label="EVENT FLOW" title="Schedule" />
                <div className="space-y-px">
                    {SCHEDULE.map((item, i) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            onClick={() => setActive(active === item.id ? null : item.id)}
                            className={`group cursor-pointer border-l-2 transition-all duration-300 ${active === item.id
                                ? "border-yellow-400 bg-yellow-400/5"
                                : "border-white/10 bg-white/[0.02] hover:border-yellow-400/40 hover:bg-white/[0.03]"
                                }`}
                        >
                            <div className="px-6 py-5 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-6 flex-1 min-w-0">
                                    <span className="font-mono text-[10px] text-yellow-400/60 shrink-0">{item.id}</span>
                                    <div>
                                        <div className="font-semibold text-white text-sm md:text-base">{item.label}</div>
                                        <div className="font-mono text-xs text-white/40 mt-0.5">{item.time}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <span className="hidden md:block font-mono text-xs text-white/30 border border-white/10 px-2 py-0.5">{item.duration}</span>
                                    <motion.span
                                        animate={{ rotate: active === item.id ? 45 : 0 }}
                                        className="text-yellow-400/60 text-lg leading-none"
                                    >+</motion.span>
                                </div>
                            </div>
                            <AnimatePresence>
                                {active === item.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-6 pb-5 border-t border-white/5">
                                            <p className="text-white/50 text-sm leading-relaxed mt-4 mb-4">{item.desc}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {item.tags.map((tag) => (
                                                    <span key={tag} className="font-mono text-[10px] text-yellow-400/60 border border-yellow-400/20 px-2 py-0.5 tracking-widest">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── THEME SECTION ────────────────────────────────────────────────────────────
function Theme() {
    return (
        <section className="py-24 bg-black border-t border-white/5 overflow-hidden">
            <div className="max-w-6xl mx-auto px-6">
                <SectionHeader index="03" label="COMPETITION THEME" title="Women's Day Challenge" />
                <div className="grid md:grid-cols-2 gap-px">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="bg-white/[0.02] border border-white/5 p-8"
                    >
                        <div className="font-mono text-[10px] text-yellow-400/60 tracking-widest mb-4">OBJECTIVE</div>
                        <p className="text-white/70 text-sm leading-relaxed">
                            Draft standards for products widely used by women in daily life. The objective is to promote awareness of quality, safety, and sustainability in products that directly impact women's well-being.
                        </p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1, duration: 0.6 }}
                        className="bg-white/[0.02] border border-white/5 p-8"
                    >
                        <div className="font-mono text-[10px] text-yellow-400/60 tracking-widest mb-4">ELIGIBLE PRODUCT CATEGORIES</div>
                        <ul className="space-y-2">
                            {["Personal care products", "Safety devices", "Health & hygiene products", "Wearable items", "Household appliances"].map((cat, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-white/60">
                                    <span className="w-1.5 h-1.5 bg-yellow-400/60 rounded-full shrink-0" />
                                    {cat}
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                </div>

                {/* Judging criteria */}
                <div className="mt-px grid grid-cols-2 md:grid-cols-5 gap-px">
                    {CRITERIA.map((c, i) => (
                        <motion.div
                            key={c.id}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.07, duration: 0.5 }}
                            className="bg-white/[0.02] border border-white/5 p-5 group hover:bg-yellow-400/5 hover:border-yellow-400/20 transition-all duration-300"
                        >
                            <div className="font-mono text-[10px] text-white/25 tracking-widest mb-2">{c.id}</div>
                            <div className="text-white text-sm font-semibold mb-1.5 group-hover:text-yellow-400 transition-colors">{c.label}</div>
                            <div className="text-white/40 text-xs leading-relaxed">{c.desc}</div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── RULES SECTION ────────────────────────────────────────────────────────────
function Rules() {
    return (
        <section id="rules" className="py-24 bg-black border-t border-white/5">
            <div className="max-w-6xl mx-auto px-6">
                <SectionHeader index="04" label="PARTICIPATION" title="Rules & Regulations" />
                <div className="grid md:grid-cols-2 gap-12">
                    <div className="space-y-px">
                        {RULES.map((rule, i) => (
                            <motion.div
                                key={rule.code}
                                initial={{ opacity: 0, x: -16 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08, duration: 0.5 }}
                                className="flex gap-4 p-4 border border-white/5 bg-white/[0.015] hover:bg-white/[0.03] transition-colors group"
                            >
                                <span className="font-mono text-[10px] text-yellow-400/50 shrink-0 mt-0.5">{rule.code}</span>
                                <span className="text-white/60 text-sm leading-relaxed group-hover:text-white/80 transition-colors">{rule.text}</span>
                            </motion.div>
                        ))}
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="space-y-6"
                    >
                        <div className="border border-white/10 p-6 bg-white/[0.02]">
                            <div className="font-mono text-[10px] text-yellow-400/60 tracking-widest mb-4">GENERAL JUDGING CRITERIA</div>
                            <div className="space-y-3">
                                {["Creativity and relevance to theme", "Teamwork and coordination", "Effective time management", "Presentation quality"].map((item, i) => (
                                    <div key={i} className="flex items-start gap-3 text-sm text-white/50">
                                        <span className="font-mono text-yellow-400/40 text-xs mt-0.5">{String(i + 1).padStart(2, "0")}.</span>
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="border border-yellow-400/20 bg-yellow-400/5 p-6">
                            <div className="font-mono text-[10px] text-yellow-400 tracking-widest mb-2">EXPECTED PARTICIPANTS</div>
                            <div className="text-5xl font-black text-yellow-400">100</div>
                            <div className="font-mono text-xs text-white/30 mt-1">REGISTERED PARTICIPANTS // MAX CAP</div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// ─── REGISTER SECTION ─────────────────────────────────────────────────────────
function Register() {
    const [submitted, setSubmitted] = useState(false);
    const [form, setForm] = useState({ name: "", roll: "", email: "", partner: "" });

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <section id="submit" className="py-24 bg-black border-t border-white/5">
            <div className="max-w-6xl mx-auto px-6">
                <SectionHeader index="05" label="ENROLL" title="Register" />
                <div className="grid md:grid-cols-2 gap-12 items-start">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <p className="text-white/50 text-sm leading-relaxed mb-8">
                            Open to all VIT students. Participation in the learning session is mandatory before the competition. Judging begins immediately after drafting time closes.
                        </p>
                        <div className="space-y-4">
                            {[
                                { label: "ORGANIZED BY", value: "BIS Standards Club, VIT Vellore" },
                                { label: "VENUE", value: "CS Hall, VIT Vellore" },
                                { label: "DATE", value: "Sunday, 09 March 2026" },
                                { label: "TIME", value: "2:00 PM — 4:00 PM IST" },
                                { label: "TEAM SIZE", value: "1 — 2 Members" },
                            ].map((row) => (
                                <div key={row.label} className="flex justify-between border-b border-white/5 pb-3">
                                    <span className="font-mono text-[10px] text-white/30 tracking-widest">{row.label}</span>
                                    <span className="font-mono text-xs text-white/70">{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.15, duration: 0.6 }}
                    >
                        <AnimatePresence mode="wait">
                            {!submitted ? (
                                <motion.div key="form" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
                                    <div className="border border-white/10 bg-white/[0.02] p-6 space-y-4">
                                        <div className="font-mono text-[10px] text-yellow-400/60 tracking-widest mb-2">REGISTRATION FORM // STANDARDS-WRITING-2026</div>
                                        {[
                                            { key: "name", label: "FULL NAME", placeholder: "Enter your name" },
                                            { key: "roll", label: "ROLL NUMBER", placeholder: "e.g. 23BCE0000" },
                                            { key: "email", label: "VIT EMAIL", placeholder: "name@vitstudent.ac.in" },
                                            { key: "partner", label: "PARTNER ROLL (OPTIONAL)", placeholder: "Leave blank if solo" },
                                        ].map((field) => (
                                            <div key={field.key}>
                                                <label className="font-mono text-[10px] text-white/30 tracking-widest block mb-1.5">{field.label}</label>
                                                <input
                                                    type="text"
                                                    placeholder={field.placeholder}
                                                    value={form[field.key]}
                                                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 text-white text-sm px-4 py-2.5 font-mono placeholder-white/20 focus:outline-none focus:border-yellow-400/50 transition-colors"
                                                />
                                            </div>
                                        ))}
                                        <button
                                            onClick={handleSubmit}
                                            className="group relative w-full font-mono text-sm tracking-widest uppercase py-3 border border-yellow-400 text-yellow-400 overflow-hidden hover:text-black transition-colors duration-300 mt-2"
                                        >
                                            <span className="absolute inset-0 bg-yellow-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                                            <span className="relative">SUBMIT REGISTRATION</span>
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="border border-yellow-400/30 bg-yellow-400/5 p-8 text-center"
                                >
                                    <div className="text-yellow-400 text-4xl mb-4">✓</div>
                                    <div className="font-mono text-sm text-yellow-400 tracking-widest mb-2">REGISTRATION RECEIVED</div>
                                    <div className="text-white/50 text-xs font-mono">See you at Anna Auditorium on 09 MAR 2026 at 14:00 IST.</div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer() {
    return (
        <footer className="border-t border-white/5 bg-black py-10">
            <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <div className="font-mono text-xs text-yellow-400 tracking-widest">BIS STANDARDS CLUB // VIT VELLORE</div>
                    <div className="font-mono text-[10px] text-white/20 mt-1">STANDARDS WRITING EVENT // IWD 2026</div>
                </div>
                <div className="font-mono text-[10px] text-white/20 tracking-widest">
                    © 2026 BIS-VIT. ALL RIGHTS RESERVED.
                </div>
            </div>
        </footer>
    );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
    const [loading, setLoading] = useState(true);

    return (
        <div className="bg-black min-h-screen text-white">
            <AnimatePresence>
                {loading && <Preloader onDone={() => setLoading(false)} />}
            </AnimatePresence>

            {!loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                    <Navbar />
                    <Hero />
                    <Schedule />
                    <Theme />
                    <Rules />
                    <Register />
                    <Footer />
                </motion.div>
            )}
        </div>
    );
}