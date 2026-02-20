import { describe, it, expect } from 'vitest';
import { computeCMP } from '../computeCMP';
import { MovementNormalized, Deposito, TipoMov } from '../types';
import { money } from '../money';

// Helper to create valid normalized movements for testing
const makeMov = (
    id: string,
    tipo: TipoMov,
    qty: number,
    data: string,
    opts: Partial<MovementNormalized> = {}
): MovementNormalized => {
    return {
        id,
        produtoId: 'p1',
        tipo,
        quantidade: qty,
        dataMov: data,
        createdAt: data + 'T12:00:00Z',
        occurredAt: new Date(data + 'T12:00:00Z'),
        sortKey: `${data}|${id}`,
        origem: null,
        destino: null,
        ...opts
    };
};

describe('CMP Engine', () => {
    it('should calculate simple entry and exit', () => {
        const movements: MovementNormalized[] = [
            makeMov('1', 'entrada', 10, '2023-01-01', {
                destino: 'prep_center',
                custoInformadoUnit: money(10)
            }),
            makeMov('2', 'saida', 5, '2023-01-02', {
                origem: 'prep_center'
            })
        ];

        const result = computeCMP(movements);

        expect(result.status).toBe('OK');
        const stock = result.stock.get('p1')!;

        // Prep Center: 5 units remaining
        expect(stock.positions.prep_center.quantidade).toBe(5);
        expect(Number(stock.positions.prep_center.custoMedio)).toBe(1000); // 10.00
        expect(Number(stock.positions.prep_center.valorTotal)).toBe(5000); // 5 * 10.00

        // COGS
        expect(result.cogs).toHaveLength(1);
        expect(Number(result.cogs[0].value)).toBe(5000); // 5 * 10.00
    });

    it('should handle price variance (Weighted Average)', () => {
        const movements: MovementNormalized[] = [
            makeMov('1', 'entrada', 10, '2023-01-01', { destino: 'prep_center', custoInformadoUnit: money(10) }),
            makeMov('2', 'entrada', 10, '2023-01-02', { destino: 'prep_center', custoInformadoUnit: money(20) })
        ];

        const result = computeCMP(movements);
        const stock = result.stock.get('p1')!;

        // Total 20 units. Value = 100 + 200 = 300. Avg = 15.
        expect(stock.positions.prep_center.quantidade).toBe(20);
        expect(Number(stock.positions.prep_center.valorTotal)).toBe(30000); // 300.00
        expect(Number(stock.positions.prep_center.custoMedio)).toBe(1500); // 15.00
    });

    it('should preserve cost on transfer', () => {
        const movements: MovementNormalized[] = [
            makeMov('1', 'entrada', 10, '2023-01-01', { destino: 'prep_center', custoInformadoUnit: money(10) }),
            makeMov('2', 'entrada', 10, '2023-01-02', { destino: 'amazon_fba', custoInformadoUnit: money(20) }),
            makeMov('3', 'transferencia', 5, '2023-01-03', { origem: 'prep_center', destino: 'amazon_fba' })
        ];

        const result = computeCMP(movements);
        const stock = result.stock.get('p1')!;

        // Prep: 5 units @ 10
        expect(stock.positions.prep_center.quantidade).toBe(5);
        expect(Number(stock.positions.prep_center.custoMedio)).toBe(1000);

        // Amazon: 15 units. Total Value 250.00
        // Previous: 10 @ 20 = 200
        // Incoming from Prep: 5 @ 10 = 50
        // Total: 250
        expect(stock.positions.amazon_fba.quantidade).toBe(15);
        expect(Number(stock.positions.amazon_fba.valorTotal)).toBe(25000);

        // 25000 / 15 = 1666.666... => 1666n (floor)
        expect(Number(stock.positions.amazon_fba.custoMedio)).toBe(1666);
    });

    it('should block negative stock', () => {
        const movements: MovementNormalized[] = [
            makeMov('1', 'entrada', 5, '2023-01-01', { destino: 'prep_center', custoInformadoUnit: money(10) }),
            makeMov('2', 'saida', 10, '2023-01-02', { origem: 'prep_center' }) // Try to sell 10, have 5
        ];

        const result = computeCMP(movements);

        expect(result.status).toBe('NEEDS_INPUT');
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0].message).toContain('Estoque insuficiente');

        // Stock should remain at 5 (transaction skipped)
        const stock = result.stock.get('p1')!;
        expect(stock.positions.prep_center.quantidade).toBe(5);
    });
});
