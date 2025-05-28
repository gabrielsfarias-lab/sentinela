import { type FeDocumentDto } from '../services/DocumentService'; // Ajuste o caminho se necessário

export interface EditingCell {
    docId: string;
    field: 'displayName' | 'expiryDate' | 'notes';
}

export type SortableKeys = keyof Pick<FeDocumentDto, 'displayName' | 'expiryDate' | 'originalFileName' | 'updatedAt'>;

export interface SortConfig {
    key: SortableKeys | null;
    direction: 'ascending' | 'descending' | null;
}