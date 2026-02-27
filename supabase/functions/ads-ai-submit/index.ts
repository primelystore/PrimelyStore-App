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

        // ── Validação mínima ───────────────────────────────────────
        const payload = body?.payload ?? body;
        if (!payload || typeof payload !== "object") {
            return new Response(
                JSON.stringify({ error: "payload inválido" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── Supabase client com service_role (bypass RLS) ──────────
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        // ── Criar job PENDING ──────────────────────────────────────
        const { data: job, error: insertErr } = await supabase
            .from("ads_ai_jobs")
            .insert({ status: "PENDING", payload })
            .select("id, public_token")
            .single();

        if (insertErr || !job) {
            console.error("Insert error:", insertErr);
            return new Response(
                JSON.stringify({ error: "Falha ao criar job", detail: insertErr?.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        // ── Disparar n8n webhook (fire-and-forget) ─────────────────
        const n8nUrl = Deno.env.get("N8N_WEBHOOK_URL");
        const secret = Deno.env.get("PRIMELY_SECRET") ?? "";

        if (n8nUrl) {
            // Build callback URL dinamicamente
            const callbackUrl = `${supabaseUrl}/functions/v1/ads-ai-callback`;

            // Fire-and-forget: não esperamos a resposta do n8n
            // (n8n deve estar configurado para responder On Received)
            fetch(n8nUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-primely-secret": secret,
                },
                body: JSON.stringify({
                    job_id: job.id,
                    callback_url: callbackUrl,
                    secret, // para o n8n repassar no callback
                    payload,
                }),
            }).catch((err) => {
                console.error("Falha ao disparar n8n (fire-and-forget):", err);
            });
        } else {
            console.warn("N8N_WEBHOOK_URL não configurado. Job criado mas n8n não foi notificado.");
        }

        // ── Retornar job_id + public_token para o front ────────────
        return new Response(
            JSON.stringify({ job_id: job.id, public_token: job.public_token }),
            { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (e) {
        console.error("ads-ai-submit error:", e);
        return new Response(
            JSON.stringify({ error: "internal_error", message: String((e as Error)?.message ?? e) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
