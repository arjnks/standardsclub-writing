import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!GEMINI_API_KEY) console.error("MISSING: GEMINI_API_KEY")
if (!SUPABASE_URL) console.error("MISSING: SUPABASE_URL")
if (!SUPABASE_SERVICE_ROLE_KEY) console.error("MISSING: SUPABASE_SERVICE_ROLE_KEY")

const RUBRIC = `
1. Document Structure (3 marks): Presence/order of Title, Foreword, Scope, Definitions, Requirements, Testing.
2. Clarity of Scope & Definitions (2 marks): Clear explanation of standard application and term precision.
3. Technical Requirements (3 marks): Clear, measurable, and realistic specifications.
4. Testing / Verification Method (1 mark): Explanation of how to verify if standard is met.
5. Formatting & Presentation (1 mark): Proper headings, numbering, and professional look.
Total: 10 marks.
`

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }
    try {
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
        const { data: fileData, error: downloadErr } = await supabase.storage
            .from('submissions')
            .download(submission.file_path)

        if (downloadErr) throw new Error('Failed to download file')

        // 3. Convert to Base64 for Gemini
        const arrayBuffer = await fileData.arrayBuffer()
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

        // 4. Call Gemini
        const prompt = `You are a professional auditor for the Bureau of Indian Standards (BIS). 
    Grade the attached document based on this rubric: ${RUBRIC}. 
    Provide a JSON response with 'scores' (array of numbers for each criterion), 'totalScore' (float), and 'feedback' (string summarizing points for improvement).`

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: submission.file_type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                data: base64Content
                            }
                        }
                    ]
                }],
                generationConfig: { response_mime_type: "application/json" }
            })
        })

        const result = await response.json()
        if (!result.candidates || result.candidates.length === 0) {
            console.error("Gemini Error:", result)
            throw new Error(`AI failed to generate content: ${JSON.stringify(result.error || result)}`)
        }

        let text = result.candidates[0].content.parts[0].text
        // Remove markdown code blocks if present
        text = text.replace(/```json\n?/, '').replace(/```/, '').trim()

        let aiOutput;
        try {
            aiOutput = JSON.parse(text)
        } catch (e) {
            console.error("Parse Error. Text was:", text)
            throw new Error("AI returned invalid JSON. Please try again.")
        }

        if (typeof aiOutput.totalScore !== 'number') {
            throw new Error("AI response missing totalScore or invalid format.")
        }

        // 5. Save results back to DB
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
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
