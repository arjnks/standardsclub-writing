import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as unpdf from "https://esm.sh/unpdf@0.12.1"


const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RUBRIC = `
BIS Standards Writing — Judging Rubric (Total: 10 Marks)

Step 0 — Document Validity Check (Mandatory)
A document is INVALID if:
- Not structured like a standard (no sections/headings)
- Pure essay/story instead of rules/specifications
- Extremely incomplete (less than ~1 page or only a title)
ACTION: If INVALID, assign totalScore: 0 and stop evaluation.

Scoring Criteria:
1. Structure & Format (2 Marks): Logical structure, clear headings.
2. Scope & Clarity (1.5 Marks): Clear explanation of application.
3. Definitions/Terminology (1.5 Marks): Technical terms defined.
4. Tech Requirements (3 Marks): Measurable criteria and rules (MOST IMPORTANT).
5. Testing/Compliance (1 Mark): Verification methods explained.
6. Presentation (1 Mark): Numbering and professional look.

Guidelines: Be lenient with minor formatting; focus on conceptual understanding.
`

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY secret is not set")

        const { submissionId } = await req.json()
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        // 1. Get submission info
        const { data: submission, error: fetchErr } = await supabase
            .from('submissions')
            .select('*')
            .eq('id', submissionId)
            .single()

        if (fetchErr || !submission) throw new Error('Submission not found')

        // 2. Download file
        const { data: fileBlob, error: downloadErr } = await supabase.storage
            .from('submissions')
            .download(submission.file_path)

        if (downloadErr) throw new Error(`Storage download failed: ${downloadErr.message}`)

        // 3. Extract Text based on file type
        let extractedText = ""
        const arrayBuffer = await fileBlob.arrayBuffer()

        if (submission.file_type === 'pdf') {
            try {
                // unpdf 0.12.1+ uses extractText
                const { text } = await unpdf.extractText(arrayBuffer)
                extractedText = (Array.isArray(text) ? text.join("\n") : text) || ""
            } catch (err: any) {
                console.error("PDF extraction failed:", err)
                throw new Error(`Failed to extract text from PDF: ${err.message}`)
            }
        } else {
            throw new Error(`Unsupported file type: ${submission.file_type}`)
        }

        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error("Could not extract any text from the document.")
        }

        // 4. Call Groq
        const prompt = `You are an expert auditor for the Bureau of Indian Standards (BIS). 
        Grade this document according to this rubric:
        
        ${RUBRIC}
        
        DOCUMENT CONTENT:
        """
        ${extractedText.substring(0, 35000)}
        """

        CRITICAL INSTRUCTIONS:
        1. Perform Step 0 check. If it's an essay/story or not a standard-style document, totalScore MUST be 0.
        2. Provide helpful feedback based on the rubric sections.
        3. Respond ONLY with a JSON object: {"totalScore": number, "feedback": string}.`

        console.log(`Calling Groq for submission: ${submissionId}`)

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        })

        if (!groqResponse.ok) {
            const errorData = await groqResponse.text()
            throw new Error(`Groq API error: ${errorData}`)
        }

        const groqJson = await groqResponse.json()
        const aiOutput = JSON.parse(groqJson.choices[0].message.content)

        // 5. Update database
        await supabase
            .from('submissions')
            .update({
                ai_score: aiOutput.totalScore,
                ai_feedback: aiOutput.feedback,
                reviewed: true
            })
            .eq('id', submissionId)

        return new Response(JSON.stringify(aiOutput), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err) {
        console.error(err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

