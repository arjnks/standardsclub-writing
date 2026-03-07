import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RUBRIC = `
1. Document Structure (3 marks): Presence/order of Title, Foreword, Scope, Definitions, Requirements, Testing.
2. Clarity of Scope & Definitions (2 marks): Clear explanation of standard application and term precision.
3. Technical Requirements (3 marks): Clear, measurable, and realistic specifications.
4. Testing / Verification Method (1 mark): Explanation of how to verify if standard is met.
5. Formatting & Presentation (1 mark): Proper headings, numbering, and professional look.
Total: 10 marks.
`

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY secret is not set")

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

        if (downloadErr) throw new Error(`Storage download failed: ${downloadErr.message}`)

        // 3. Convert to Base64
        const uint8Array = new Uint8Array(await fileData.arrayBuffer());
        let binary = '';
        for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Content = btoa(binary);

        // 4. Call Gemini
        const prompt = `You are an expert auditor for the Bureau of Indian Standards (BIS). 
        Grade this document according to this rubric out of 10 marks: ${RUBRIC}.
        Respond with a JSON object containing "totalScore" (number) and "feedback" (string).
        Ensure the response is valid JSON.`

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        })

        const result = await response.json()
        if (!result.candidates || result.candidates.length === 0) {
            throw new Error(`Gemini API Error: ${JSON.stringify(result.error || result)}`)
        }

        let text = result.candidates[0].content.parts[0].text
        // Clean markdown backticks if they appear despite JSON mode
        text = text.replace(/```json\n?/, '').replace(/```/, '').trim()

        let aiOutput;
        try {
            aiOutput = JSON.parse(text)
        } catch (e) {
            console.error("Parse error, raw text:", text)
            // Fallback: try to extract something that looks like JSON or just fail
            throw new Error(`Invalid JSON from AI: ${text.substring(0, 100)}...`)
        }

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
