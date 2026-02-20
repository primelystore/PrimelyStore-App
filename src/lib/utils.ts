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
