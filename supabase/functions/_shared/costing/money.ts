import { Money } from './types.ts';

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

// Simple integer division (floor)
export const div = (amount: Money, qty: number): Money => {
    if (qty === 0) return 0n;
    return amount / BigInt(qty);
};

// Precise calculation of a partial value from a total
// (total * share / totalShares)
// Example: Lot Value 1000, Qty 3. Exit 1. Value = 1000 * 1 / 3 = 333.
export const calcProportional = (totalValue: Money, totalQty: number, targetQty: number): Money => {
    if (totalQty === 0) return 0n;
    return (totalValue * BigInt(targetQty)) / BigInt(totalQty);
};
