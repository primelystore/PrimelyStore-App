/**
 * Cálculos determinísticos para Amazon Ads — Sponsored Products
 *
 * Portado de .agent/skills/amazon-ads-perfect/scripts/calc_ads_financials.py
 * Segue estritamente as fórmulas e multiplicadores da Skill.
 */

// ── Tipos ──────────────────────────────────────────────────────

export type AdsGoal = "profit" | "defend" | "test" | "rank" | "launch" | "clearance";

export interface AdsInput {
    asin_or_sku: string;
    sell_price: number;       // R$ (float)
    product_cost: number;     // R$ (float)
    prep_cost: number;
    inbound_shipping_cost: number;
    extra_packaging_cost: number;
    fees: {
        commission: number;
        fulfillment: number;
        storage: number;
        other: number;
    };
    tax: {
        mode: "percent" | "fixed";
        value: number;
    };
    daily_budget: number;
    goal: AdsGoal;
    cvr_estimate: number | null;      // 0-1 (ex: 0.08 = 8%)
    max_target_acos_cap?: number | null;
}

export interface AdsFinancials {
    sell_price: number;
    total_variable_cost: number;
    contribution_profit: number;
    break_even_acos: number;          // 0-1
    recommended_target_acos: number;  // 0-1
    max_cpc: number | null;           // R$ ou null
    assumptions: string[];
}

export interface AdsBids {
    auto: number;
    broad: number;
    phrase: number;
    exact: number;
    product: number;
}

export interface AdsResult {
    status: "OK" | "NEEDS_INPUT";
    financials: AdsFinancials;
    bids: AdsBids | null;
    missing_fields: string[];
    warnings: string[];
}

// ── Constantes da Skill ────────────────────────────────────────

export const GOAL_MULTIPLIERS: Record<AdsGoal, number> = {
    profit: 0.70,
    defend: 0.80,
    test: 0.85,
    rank: 0.95,
    launch: 1.10,
    clearance: 1.00,
};

export const GOAL_LABELS: Record<AdsGoal, string> = {
    profit: "Lucro",
    defend: "Defender posição",
    test: "Teste",
    rank: "Ranking",
    launch: "Lançamento",
    clearance: "Liquidação",
};

const BID_MULTIPLIERS = {
    auto: 0.75,
    broad: 0.70,
    phrase: 0.80,
    exact: 0.90,
    product: 0.80,
} as const;

// ── Funções auxiliares ─────────────────────────────────────────

function round2(x: number): number {
    return Math.round(x * 100) / 100;
}

function round4(x: number): number {
    return Math.round(x * 10000) / 10000;
}

// ── Cálculo principal ──────────────────────────────────────────

export function calcAdsFinancials(input: AdsInput): AdsResult {
    const warnings: string[] = [];
    const missing_fields: string[] = [];

    // 1. Imposto
    const tax_value = input.tax.mode === "percent"
        ? input.sell_price * (input.tax.value / 100)
        : input.tax.value;

    // 2. Custo variável total
    const total_variable_cost =
        input.product_cost +
        input.prep_cost +
        input.inbound_shipping_cost +
        input.extra_packaging_cost +
        input.fees.commission +
        input.fees.fulfillment +
        input.fees.storage +
        input.fees.other +
        tax_value;

    // 3. Lucro de contribuição
    const contribution_profit = input.sell_price - total_variable_cost;

    if (contribution_profit <= 0) {
        warnings.push("⚠️ Lucro de contribuição ≤ 0. Não é recomendado rodar Ads até corrigir preço/custos/fees.");
    }

    // 4. Break-even ACoS
    const break_even_acos = input.sell_price > 0
        ? contribution_profit / input.sell_price
        : 0;

    // 5. Target ACoS recomendado
    const mult = GOAL_MULTIPLIERS[input.goal] ?? 0.80;
    let recommended_target_acos = break_even_acos * mult;

    // Cap opcional
    if (input.max_target_acos_cap != null && input.max_target_acos_cap > 0) {
        recommended_target_acos = Math.min(recommended_target_acos, input.max_target_acos_cap);
    }

    // 6. Max CPC e Bids
    const assumptions: string[] = [];
    let max_cpc: number | null = null;
    let bids: AdsBids | null = null;

    if (input.cvr_estimate != null && input.cvr_estimate > 0) {
        max_cpc = recommended_target_acos * input.sell_price * input.cvr_estimate;
        assumptions.push(`max_cpc calculado com cvr_estimate=${input.cvr_estimate.toFixed(4)}`);

        bids = {
            auto: round2(max_cpc * BID_MULTIPLIERS.auto),
            broad: round2(max_cpc * BID_MULTIPLIERS.broad),
            phrase: round2(max_cpc * BID_MULTIPLIERS.phrase),
            exact: round2(max_cpc * BID_MULTIPLIERS.exact),
            product: round2(max_cpc * BID_MULTIPLIERS.product),
        };
    } else {
        assumptions.push("cvr_estimate não informado; max_cpc não calculado");
        missing_fields.push("cvr_estimate");
    }

    const status: "OK" | "NEEDS_INPUT" = missing_fields.length > 0 ? "NEEDS_INPUT" : "OK";

    return {
        status,
        financials: {
            sell_price: round2(input.sell_price),
            total_variable_cost: round2(total_variable_cost),
            contribution_profit: round2(contribution_profit),
            break_even_acos: round4(break_even_acos),
            recommended_target_acos: round4(recommended_target_acos),
            max_cpc: max_cpc != null ? round2(max_cpc) : null,
            assumptions,
        },
        bids,
        missing_fields,
        warnings,
    };
}

// ── Build JSON conforme output.schema.json ─────────────────────

export function buildOutputJSON(input: AdsInput, result: AdsResult) {
    const asin = input.asin_or_sku;
    const budgetPerCampaign = round2(input.daily_budget / 5);

    const buildAdGroup = (name: string, bid: number) => ({
        name,
        default_bid: round2(bid),
        targets: [],
        negative_keywords: [],
    });

    const campaigns = result.bids
        ? [
            {
                name: `SP | ${asin} | AUTO | Harvest`,
                type: "AUTO" as const,
                daily_budget: budgetPerCampaign,
                bidding_strategy: "Dynamic bids – down only",
                ad_groups: [buildAdGroup("All", result.bids.auto)],
            },
            {
                name: `SP | ${asin} | MANUAL | Broad`,
                type: "MANUAL_KEYWORDS" as const,
                daily_budget: budgetPerCampaign,
                bidding_strategy: "Dynamic bids – down only",
                ad_groups: [buildAdGroup("Broad", result.bids.broad)],
            },
            {
                name: `SP | ${asin} | MANUAL | Phrase`,
                type: "MANUAL_KEYWORDS" as const,
                daily_budget: budgetPerCampaign,
                bidding_strategy: "Dynamic bids – down only",
                ad_groups: [buildAdGroup("Phrase", result.bids.phrase)],
            },
            {
                name: `SP | ${asin} | MANUAL | Exact`,
                type: "MANUAL_KEYWORDS" as const,
                daily_budget: budgetPerCampaign,
                bidding_strategy: "Dynamic bids – down only",
                ad_groups: [buildAdGroup("Exact", result.bids.exact)],
            },
            {
                name: `SP | ${asin} | PRODUCT | Competitors`,
                type: "MANUAL_PRODUCT_TARGETING" as const,
                daily_budget: budgetPerCampaign,
                bidding_strategy: "Dynamic bids – down only",
                ad_groups: [buildAdGroup("Competitors", result.bids.product)],
            },
        ]
        : [];

    const output: Record<string, unknown> = {
        status: result.status,
        summary: result.status === "OK"
            ? `Plano de Ads para ${asin} — Goal: ${input.goal}, Target ACoS: ${(result.financials.recommended_target_acos * 100).toFixed(1)}%`
            : `Faltam campos para completar o plano: ${result.missing_fields.join(", ")}`,
        financials: {
            sell_price: result.financials.sell_price,
            total_variable_cost: result.financials.total_variable_cost,
            contribution_profit: result.financials.contribution_profit,
            break_even_acos: result.financials.break_even_acos,
            recommended_target_acos: result.financials.recommended_target_acos,
            max_cpc: result.financials.max_cpc,
            assumptions: result.financials.assumptions,
        },
        plan: {
            campaigns,
            launch_checklist: [
                "Listing otimizado: título, imagens, bullet points e atributos completos",
                "Estoque suficiente (evitar pausa por falta de estoque)",
                "Preço compatível com o mercado (se acima, CVR cai e CPC fica caro)",
                `Objetivo definido: ${GOAL_LABELS[input.goal]}`,
                `Target ACoS definido: ${(result.financials.recommended_target_acos * 100).toFixed(1)}% (abaixo do break-even de ${(result.financials.break_even_acos * 100).toFixed(1)}%)`,
            ],
            optimization_3_days: [
                "Negativar termos obviamente irrelevantes",
                "Reduzir bids em targets que drenam budget rápido",
                "Garantir que Manual não está 'brigando' com Auto (se estiver, negativar no Auto)",
            ],
            optimization_7_days: [
                "Harvest: termos com venda → mover para Phrase/Exact",
                "Pausar targets com gasto alto e 0 vendas após 12–20 cliques",
            ],
            optimization_14_days: [
                "Separar 'campeões' em campanhas próprias (controle total do budget)",
                "Expandir Product Targeting (concorrentes específicos)",
            ],
            optimization_30_days: [
                "Refinar negativas por intenção",
                "Avaliar TACoS (total ACoS incluindo vendas orgânicas)",
                "Ajustar bids conforme performance real (CPC médio x conversões)",
            ],
        },
    };

    if (result.missing_fields.length > 0) {
        output.missing_fields = result.missing_fields;
        output.questions = result.missing_fields.map(f => {
            if (f === "cvr_estimate") return "Qual é a taxa de conversão estimada (CVR)? Ex.: 8% = 0.08";
            return `Informe o campo: ${f}`;
        });
    }

    return output;
}
