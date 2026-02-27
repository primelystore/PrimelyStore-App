import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const body = await req.json();
        const jobId = body?.job_id;
        const publicToken = body?.public_token;

        if (!jobId || !publicToken) {
            return new Response(
                JSON.stringify({ error: "job_id e public_token são obrigatórios" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── Supabase client com service_role (bypass RLS) ──────────
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        // ── Buscar job por id + public_token ───────────────────────
        const { data: job, error } = await supabase
            .from("ads_ai_jobs")
            .select("id, status, result_json, render_markdown, error_message, created_at, updated_at")
            .eq("id", jobId)
            .eq("public_token", publicToken)
            .maybeSingle();

        if (error) {
            console.error("Query error:", error);
            return new Response(
                JSON.stringify({ error: "Erro ao consultar job" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        if (!job) {
            return new Response(
                JSON.stringify({ error: "Job não encontrado" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        return new Response(
            JSON.stringify({
                status: job.status,
                result_json: job.result_json,
                render_markdown: job.render_markdown,
                error_message: job.error_message,
                created_at: job.created_at,
                updated_at: job.updated_at,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (e) {
        console.error("ads-ai-status error:", e);
        return new Response(
            JSON.stringify({ error: "internal_error", message: String((e as Error)?.message ?? e) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
