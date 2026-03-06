// /src/app/api/submit/route.ts
// Next.js App Router Route Handler
// Accepts: multipart/form-data with fields: reg_no (string), file (PDF or DOCX)
// Stores: file in Supabase Storage bucket "submissions", metadata in "submissions" table

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qlbhikcofrdusdezvagu.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!; // set in .env.local

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const reg_no = (formData.get("reg_no") as string)?.trim().toUpperCase();
    const file = formData.get("file") as File | null;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!reg_no || !/^[0-9]{2}[A-Z]{3}[0-9]{4}$/.test(reg_no)) {
      return NextResponse.json(
        { error: "Invalid registration number format. Expected e.g. 23BCE0001." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF and DOCX files are accepted." },
        { status: 415 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit." },
        { status: 413 }
      );
    }

    // ── Duplicate check ───────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from("submissions")
      .select("id")
      .eq("reg_no", reg_no)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A submission from this registration number already exists." },
        { status: 409 }
      );
    }

    // ── Upload file to Storage ────────────────────────────────────────────────
    const ext = file.type === "application/pdf" ? "pdf" : "docx";
    const storagePath = `${reg_no}_${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: storageError } = await supabase.storage
      .from("submissions")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.error("Storage error:", storageError);
      return NextResponse.json(
        { error: "File upload failed. Try again." },
        { status: 500 }
      );
    }

    // ── Insert metadata row ───────────────────────────────────────────────────
    const { error: dbError } = await supabase.from("submissions").insert({
      reg_no,
      file_path: storagePath,
      file_name: file.name,
      file_type: ext,
      submitted_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error("DB error:", dbError);
      // Rollback storage upload
      await supabase.storage.from("submissions").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to record submission. Try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Submission received.",
        reg_no,
        file_path: storagePath,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
