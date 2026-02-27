import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

/**
 * ads-ai-callback
 *
 * Recebe resultado do n8n e atualiza o job.
 * NÃO requer JWT — autenticação via header x-primely-secret.
 *
 * Deploy com: supabase functions deploy ads-ai-callback --no-verify-jwt
 */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-primely-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        // ── Verificar secret ───────────────────────────────────────
        const expectedSecret = Deno.env.get("PRIMELY_SECRET") ?? "";
        const receivedSecret = req.headers.get("x-primely-secret") ?? "";

        if (!expectedSecret || receivedSecret !== expectedSecret) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── Parse body ─────────────────────────────────────────────
        const body = await req.json();
        const jobId = body?.job_id;
        const status = body?.status; // OK | NEEDS_INPUT | API_ERROR
        const resultJson = body?.result_json ?? body?.result ?? null;
        const renderMarkdown = body?.render_markdown ?? null;
        const errorMessage = body?.error_message ?? null;

        if (!jobId) {
            return new Response(
                JSON.stringify({ error: "job_id é obrigatório" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // Validar status
        const validStatuses = ["OK", "NEEDS_INPUT", "API_ERROR"];
        const finalStatus = validStatuses.includes(status) ? status : "API_ERROR";

        // ── Supabase client com service_role (bypass RLS) ──────────
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        // ── Atualizar job ──────────────────────────────────────────
        const { error: updateErr } = await supabase
            .from("ads_ai_jobs")
            .update({
                status: finalStatus,
                result_json: resultJson,
                render_markdown: renderMarkdown,
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

        if (updateErr) {
            console.error("Update error:", updateErr);
            return new Response(
                JSON.stringify({ error: "Falha ao atualizar job", detail: updateErr.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        return new Response(
            JSON.stringify({ ok: true, job_id: jobId, status: finalStatus }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (e) {
        console.error("ads-ai-callback error:", e);
        return new Response(
            JSON.stringify({ error: "internal_error", message: String((e as Error)?.message ?? e) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
