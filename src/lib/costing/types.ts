export type Money = bigint; // Value in cents

export type Deposito = 'prep_center' | 'amazon_fba' | 'full_ml';

export type TipoMov = 'entrada' | 'saida' | 'transferencia';

// Raw input from Database
export interface Movement {
    id: string;
    produto_id: string;
    tipo: string; // validated later
    deposito_origem: string | null;
    deposito_destino: string | null;
    quantidade: number;
    // Costs from DB might be string/number/null
    custo_unitario_informado?: number | string | null;
    custo_total_informado?: number | string | null;
    data_movimentacao: string; // YYYY-MM-DD
    created_at: string; // ISO
}

export interface MovementNormalized {
    id: string;
    produtoId: string;
    tipo: TipoMov;

    // For transfers: move from Origin to Dest
    // For entries: into Dest (origin null)
    // For exits: from Origin (dest null)
    origem: Deposito | null;
    destino: Deposito | null;

    quantidade: number; // integer > 0

    // Only for explicit purchases/entries
    custoInformadoUnit?: Money;
    custoInformadoTotal?: Money;

    // Reporting / Display purposes only (never used for calculation)
    precoUnitarioRelatorio?: Money;

    dataMov: string; // YYYY-MM-DD
    createdAt: string; // ISO
    
    // Deterministic sorting fields
    occurredAt: Date; 
    sortKey: string; // constructed from date+created+id
}

export interface StockPosition {
    deposito: Deposito;
    quantidade: number;
    valorTotal: Money;
    custoMedio: Money; // derived: valorTotal / quantidade
}

export interface ProductStockState {
    produtoId: string;
    positions: Record<Deposito, StockPosition>;

    // Global aggregates for convenience
    totalQty: number;
    totalValue: Money;
}

export interface LedgerEntry {
    movementId: string;
    produtoId: string;
    metodo: 'cmp' | 'fifo';
    tipo: TipoMov;

    origem: Deposito | null;
    destino: Deposito | null;

    quantidade: number;

    // The cost applied to this movement
    custoUnitarioAplicado: Money;
    custoTotalMovimento: Money;

    // Saldo após o movimento (snapshot)
    saldoAnteriorOrigem?: { qtd: number, valor: Money };
    saldoAtualOrigem?: { qtd: number, valor: Money };

    saldoAnteriorDestino?: { qtd: number, valor: Money };
    saldoAtualDestino?: { qtd: number, valor: Money };
}

export interface EngineResult {
    status: 'OK' | 'NEEDS_INPUT' | 'ERROR';
    issues: Array<{ movementId: string; message: string }>;
    stock: Map<string, ProductStockState>; // Keyed by productId
    ledger: LedgerEntry[];
    cogs: Array<{ produtoId: string; deposito: Deposito; qty: number; value: Money }>;
}
