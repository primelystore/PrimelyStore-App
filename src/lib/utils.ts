import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatarMoeda(valor: number | undefined | null): string {
    if (valor === undefined || valor === null) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}


export function formatarPorcentagem(valor: number | undefined | null): string {
    if (valor === undefined || valor === null) return "0,00%";
    return `${valor.toFixed(2).replace('.', ',')}%`;
}

/**
 * Formata uma string de data "YYYY-MM-DD" para "DD/MM/YYYY" sem conversão de fuso horário.
 * Se a string não estiver no formato esperado, tenta usar toLocaleDateString.
 */
export function formatarData(dataString: string | null | undefined): string {
    if (!dataString) return "—";

    // Se for formato YYYY-MM-DD (apenas data), faz split para evitar problemas de timezone
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataString)) {
        const [ano, mes, dia] = dataString.split('-');
        return `${dia}/${mes}/${ano}`;
    }

    // Fallback para outros formatos (ISO com hora, etc)
    try {
        return new Date(dataString).toLocaleDateString("pt-BR");

    } catch (e) {
        return dataString;
    }
}

/**
 * Retorna a data de hoje no formato "YYYY-MM-DD" considerando o fuso horário local.
 * Evita o problema de new Date().toISOString() que retorna UTC (pode ser amanhã à noite).
 */
export function obterDataHoje(): string {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

export function formatCentsToBRL(cents: number): string {
    if (isNaN(cents)) return "0,00";
    const isNegative = cents < 0;
    const absCents = Math.abs(cents);
    const text = absCents.toString().padStart(3, '0');
    const integerPart = text.slice(0, -2);
    const decimalPart = text.slice(-2);

    // Formatar com pontos de milhar
    const formattedInteger = parseInt(integerPart, 10).toLocaleString('pt-BR');
    const result = `${formattedInteger},${decimalPart}`;

    return isNegative ? `-${result}` : result;
}

export function parseBRLCentsFromInput(raw: string): number {
    if (!raw) return 0;
    const isNegative = raw.indexOf('-') !== -1;
    // Remove tudo que não for dígito
    const digits = raw.replace(/\D/g, '');
    if (!digits) return 0;
    const cents = parseInt(digits, 10);
    if (isNaN(cents)) return 0;
    return isNegative ? -cents : cents;
}
