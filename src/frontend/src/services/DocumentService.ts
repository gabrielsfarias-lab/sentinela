// Se você não criar um dtoTypes.ts, importe diretamente dos arquivos DTO do backend (menos ideal)
// ou defina interfaces equivalentes aqui no frontend.
// Por agora, vamos definir interfaces equivalentes aqui para simplicidade.

import axios from 'axios';

// --- Tipos de Dados para as Requisições e Respostas ---
export interface FeDocumentDto {
    id: string; // Guid é string no JS/TS
    originalFileName: string;
    // originalFileType?: string; // Removido se você decidiu
    originalFileSize?: number;
    originalFileLastModified?: string; // ISO Date string
    displayName: string;
    expiryDate?: string | null; // Permitir null
    notes?: string | null;     // Permitir null
    createdAt: string; // ISO Date string
    updatedAt: string; // ISO Date string
}

export interface FeCreateDocumentDto {
    originalFileName: string;
    // originalFileType?: string; // Removido se você decidiu
    originalFileSize?: number;
    originalFileLastModified?: string; // Date.toISOString()
    displayName?: string;
    expiryDate?: string | null; // Date.toISOString() ou null
    notes?: string | null;
}

export interface FeUpdateDocumentDto {
    displayName?: string;       // Novo valor para displayName
    updateDisplayName?: boolean; // True se displayName deve ser atualizado

    expiryDate?: string | null; // Novo valor para expiryDate (string ISO ou null)
    updateExpiryDate?: boolean; // True se expiryDate deve ser atualizado

    notes?: string | null;      // Novo valor para notes
    updateNotes?: boolean;    // True se notes deve ser atualizado
}

const API_DOCUMENTS_URL = '/documentos';

export const getDocuments = async (): Promise<FeDocumentDto[]> => {
    const response = await axios.get<FeDocumentDto[]>(API_DOCUMENTS_URL);
    return response.data;
};

export const createDocumentsMetadata = async (metadataList: FeCreateDocumentDto[]): Promise<FeDocumentDto[]> => {
    const response = await axios.post<FeDocumentDto[]>(API_DOCUMENTS_URL, metadataList);
    return response.data;
};

export const updateDocumentMetadata = async (id: string, data: FeUpdateDocumentDto): Promise<FeDocumentDto> => {
    // 'data' agora deve conter os valores E as flags booleanas.
    const response = await axios.patch<FeDocumentDto>(`${API_DOCUMENTS_URL}/${id}`, data);
    return response.data;
};

export const deleteDocumentMetadata = async (id: string): Promise<void> => {
    await axios.delete(`${API_DOCUMENTS_URL}/${id}`);
};

// Funções PATCH e DELETE virão depois
// export const updateDocumentMetadata = async (id: string, data: FeUpdateDocumentDto): Promise<FeDocumentDto> => {
//     const response = await axios.patch<FeDocumentDto>(`${API_DOCUMENTS_URL}/${id}`, data);
//     return response.data;
// };

// export const deleteDocumentMetadata = async (id: string): Promise<void> => {
//     await axios.delete(`${API_DOCUMENTS_URL}/${id}`);
// };
