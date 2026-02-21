import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const enc = new TextEncoder();

function toHex(bytes: ArrayBuffer | Uint8Array) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string) {
    const data = enc.encode(input);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return toHex(hash);
}

async function hmacSha256(key: Uint8Array, data: string) {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
    return new Uint8Array(sig);
}

async function getSignatureKey(secret: string, dateStamp: string, region: string, service: string) {
    const kSecret = enc.encode("AWS4" + secret);
    const kDate = await hmacSha256(kSecret, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, "aws4_request");
    return kSigning;
}

function amzDates(now = new Date()) {
    const iso = now.toISOString();
    const amzDate = iso.replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8);
    return { amzDate, dateStamp };
}

async function getLwaAccessToken() {
    const clientId = Deno.env.get("SPAPI_LWA_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("SPAPI_LWA_CLIENT_SECRET") ?? "";
    const refreshToken = Deno.env.get("SPAPI_REFRESH_TOKEN") ?? "";
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing LWA secrets (SPAPI_LWA_CLIENT_ID/SECRET/REFRESH_TOKEN).");
    }

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
    });

    const r = await fetch("https://api.amazon.com/auth/o2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
    });
    const json = await r.json();
    if (!r.ok) throw new Error(`LWA token error: ${JSON.stringify(json)}`);
    return json.access_token as string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const body = await req.json();

        // Compatibilidade: aceita identifier/idType ou sku/asin
        const idType = (body.idType === "ASIN" || body.idType === "SKU") ? body.idType : undefined;
        const identifier = typeof body.identifier === "string" ? body.identifier : undefined;

        const sku = typeof body.sku === "string" ? body.sku : undefined;
        const asin = typeof body.asin === "string" ? body.asin : undefined;

        const chosenIdType =
            (idType && identifier) ? idType :
                (asin && asin.length === 10) ? "ASIN" :
                    (sku) ? "SKU" :
                        undefined;

        const chosenIdentifier =
            (idType && identifier) ? identifier :
                (asin && asin.length === 10) ? asin :
                    (sku) ? sku :
                        undefined;

        const price = Number(body.price);
        const fulfillment = (body.fulfillment === "FBA" || body.fulfillment === "FBM") ? body.fulfillment : "FBM";

        if (!chosenIdType || !chosenIdentifier || !Number.isFinite(price)) {
            return new Response(JSON.stringify({ error: "Missing identifier (or sku/asin) or price" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const marketplaceId = Deno.env.get("SPAPI_MARKETPLACE_ID") ?? "A2Q3Y263D00KWC";

        const lwaAccessToken = await getLwaAccessToken();

        // IAM USER keys (NO STS)
        const accessKeyId = Deno.env.get("SPAPI_AWS_ACCESS_KEY_ID") ?? "";
        const secretAccessKey = Deno.env.get("SPAPI_AWS_SECRET_ACCESS_KEY") ?? "";
        if (!accessKeyId || !secretAccessKey) throw new Error("Missing AWS keys (SPAPI_AWS_ACCESS_KEY_ID / SPAPI_AWS_SECRET_ACCESS_KEY).");

        const host = Deno.env.get("SPAPI_HOST") ?? "sellingpartnerapi-na.amazon.com";
        const region = Deno.env.get("SPAPI_REGION") ?? "us-east-1";
        const service = "execute-api";

        const { amzDate, dateStamp } = amzDates();

        const safeId = encodeURIComponent(chosenIdentifier);
        const canonicalUri = chosenIdType === "ASIN"
            ? `/products/fees/v0/items/${safeId}/feesEstimate`
            : `/products/fees/v0/listings/${safeId}/feesEstimate`;

        const reqBody = {
            FeesEstimateRequest: {
                MarketplaceId: marketplaceId,
                IsAmazonFulfilled: fulfillment === "FBA",
                PriceToEstimateFees: {
                    ListingPrice: { CurrencyCode: "BRL", Amount: Number(price.toFixed(2)) },
                    Shipping: { CurrencyCode: "BRL", Amount: 0 },
                },
                Identifier: `primely-${Date.now()}`,
            },
        };

        const payload = JSON.stringify(reqBody);
        const payloadHash = await sha256Hex(payload);

        const canonicalHeaders =
            `content-type:application/json\nhost:${host}\nx-amz-access-token:${lwaAccessToken}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = "content-type;host;x-amz-access-token;x-amz-date";

        const canonicalRequest =
            `POST\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        const algorithm = "AWS4-HMAC-SHA256";
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign =
            `${algorithm}\n${amzDate}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

        const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
        const signature = toHex(await hmacSha256(signingKey, stringToSign));

        const authorization =
            `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const url = `https://${host}${canonicalUri}`;
        const r = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-amz-date": amzDate,
                "x-amz-access-token": lwaAccessToken,
                "Authorization": authorization,
            },
            body: payload,
        });

        const json = await r.json();
        if (!r.ok) {
            return new Response(JSON.stringify({ error: "SP-API error", details: json }), {
                status: 502,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const feeResult = json?.payload?.FeesEstimateResult ?? json?.FeesEstimateResult ?? json;
        const estimate = feeResult?.FeesEstimate ?? feeResult?.FeesEstimateResult?.FeesEstimate;

        const feeDetailList = estimate?.FeeDetailList ?? [];
        const totalFees = estimate?.TotalFeesEstimate?.Amount ?? 0;

        const sumBy = (pred: (t: string) => boolean) => {
            let sum = 0;
            for (const f of feeDetailList) {
                const t = String(f?.FeeType ?? "");
                const amt = Number(f?.FinalFee?.Amount ?? 0);
                if (pred(t)) sum += amt;
            }
            return Number(sum.toFixed(2));
        };

        const referralFee = sumBy((t) => t.toLowerCase().includes("referral"));
        const fulfillmentFee = sumBy((t) => t.toLowerCase().includes("fba") || t.toLowerCase().includes("fulfillment"));
        const otherFeesTotal = Number((Number(totalFees) - referralFee - fulfillmentFee).toFixed(2));

        const out = {
            marketplaceId,
            idType: chosenIdType,
            identifier: chosenIdentifier,
            fulfillment,
            totalFees: Number(totalFees),
            referralFee,
            fulfillmentFee,
            otherFeesTotal,
            feeDetailList,
            source: "LIVE",
        };

        return new Response(JSON.stringify(out), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: "internal_error", message: String(e?.message ?? e) }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
