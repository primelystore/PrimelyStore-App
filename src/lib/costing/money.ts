import { Money } from './types';

export const money = (amount: number | string): Money => {
    if (typeof amount === 'string') return BigInt(Math.round(parseFloat(amount) * 100));
    return BigInt(Math.round(amount * 100));
};

export const fromMoney = (m: Money): number => {
    return Number(m) / 100;
};

export const formatMoney = (m: Money): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(fromMoney(m));
};

export const add = (a: Money, b: Money): Money => a + b;
export const sub = (a: Money, b: Money): Money => a - b;

export const mul = (amount: Money, qty: number): Money => {
    return amount * BigInt(qty);
};

// Round Half Away From Zero (Symmetric)
export const div = (amount: Money, qty: number): Money => {
    if (qty === 0) return 0n;
    const q = BigInt(qty);

    // Handle signs
    const sign = (amount >= 0n ? 1n : -1n) * (q >= 0n ? 1n : -1n);
    const num = amount >= 0n ? amount : -amount;
    const den = q >= 0n ? q : -q;

    // (num + den/2) / den
    return sign * ((num + den / 2n) / den);
};

// Precise calculation of a partial value from a total
// (total * share / totalShares)
// Uses rounding to avoid drift where possible
export const calcProportional = (totalValue: Money, totalQty: number, targetQty: number): Money => {
    if (totalQty === 0) return 0n;
    // Reuse rounded division: (Value * Target) / Total
    return div(totalValue * BigInt(targetQty), totalQty);
};
