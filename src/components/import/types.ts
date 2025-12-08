export interface ColumnMapping {
    [columnIndex: number]: {
        destination: 'name' | 'role' | 'shares' | 'investment' | 'ignored';
        roundId?: string; // If destination is 'shares' or 'investment'
        roundName?: string; // Name of the round (for new rounds)
    }
}

export interface ImportedRow {
    [key: string]: any;
}

export interface DetectedRound {
    id: string;
    name: string;
    sharesColumnIndex?: number;
    investmentColumnIndex?: number;
}
