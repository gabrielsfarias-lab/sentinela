import React, { type JSX } from 'react';
import { type FeDocumentDto } from '../../services/DocumentService'; // Ajuste o caminho
import { type EditingCell, type SortConfig, type SortableKeys } from '../../types/dashboardTypes';

interface DocumentTableProps {
    documents: FeDocumentDto[];
    editingCell: EditingCell | null;
    editValue: string;
    inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    onCellDoubleClick: (docId: string, field: EditingCell['field'], currentValue: string | null | undefined) => void;
    onEditChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onEditSave: () => Promise<void>;
    onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onDeleteDocument: (docId: string, docName: string) => Promise<void>;
    sortConfig: SortConfig;
    requestSort: (key: SortableKeys) => void;
    getSortIcon: (key: SortableKeys) => JSX.Element;
    displayFormattedDate: (isoDateString: string | null | undefined) => string;
}

const DocumentTable: React.FC<DocumentTableProps> = ({
    documents,
    editingCell,
    editValue,
    inputRef,
    onCellDoubleClick,
    onEditChange,
    onEditSave,
    onEditKeyDown,
    onDeleteDocument,
    requestSort,
    getSortIcon,
    displayFormattedDate,
}) => {

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
                <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f2f2f2' }}>
                    <th style={{ padding: '10px 8px', textAlign: 'left', cursor: 'pointer' }} onClick={() => requestSort('displayName')}>
                        Nome Exibição {getSortIcon('displayName')}
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', cursor: 'pointer' }} onClick={() => requestSort('expiryDate')}>
                        Data Validade {getSortIcon('expiryDate')}
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', cursor: 'pointer' }} onClick={() => requestSort('originalFileName')}>
                        Nome Original {getSortIcon('originalFileName')}
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Notas</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', cursor: 'pointer' }} onClick={() => requestSort('updatedAt')}>
                        Atualizado Em {getSortIcon('updatedAt')}
                    </th>
                    <th style={{ padding: '10px 8px', textAlign: 'left' }}>Ações</th>
                </tr>
            </thead>
            <tbody>
                {documents.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px 8px' }} onDoubleClick={() => onCellDoubleClick(doc.id, 'displayName', doc.displayName)}>
                            {editingCell?.docId === doc.id && editingCell?.field === 'displayName' ? (
                                <input
                                    ref={editingCell.field === 'displayName' ? inputRef as React.RefObject<HTMLInputElement> : null}
                                    type="text" value={editValue} onChange={onEditChange}
                                    onBlur={onEditSave} onKeyDown={onEditKeyDown}
                                    style={{ width: '95%', padding: '6px', boxSizing: 'border-box' }}
                                />
                            ) : (doc.displayName)}
                        </td>
                        <td style={{ padding: '10px 8px' }} onDoubleClick={() => onCellDoubleClick(doc.id, 'expiryDate', doc.expiryDate)}>
                            {editingCell?.docId === doc.id && editingCell?.field === 'expiryDate' ? (
                                <input
                                    ref={editingCell.field === 'expiryDate' ? inputRef as React.RefObject<HTMLInputElement> : null}
                                    type="date" value={editValue}
                                    onChange={onEditChange} onBlur={onEditSave}
                                    onKeyDown={onEditKeyDown}
                                    style={{ width: '95%', padding: '6px', boxSizing: 'border-box' }}
                                />
                            ) : (displayFormattedDate(doc.expiryDate))}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{doc.originalFileName}</td>
                        <td style={{ padding: '10px 8px' }} onDoubleClick={() => onCellDoubleClick(doc.id, 'notes', doc.notes)}>
                            {editingCell?.docId === doc.id && editingCell?.field === 'notes' ? (
                                <textarea
                                    ref={editingCell.field === 'notes' ? inputRef as React.RefObject<HTMLTextAreaElement> : null}
                                    value={editValue} onChange={onEditChange}
                                    onBlur={onEditSave} onKeyDown={onEditKeyDown}
                                    rows={2} style={{ width: '95%', padding: '6px', boxSizing: 'border-box', minHeight: '40px' }}
                                />
                            ) : (doc.notes || '---')}
                        </td>
                        <td style={{ padding: '10px 8px' }}>{displayFormattedDate(doc.updatedAt)}</td>
                        <td style={{ padding: '10px 8px' }}>
                            <span onClick={() => onDeleteDocument(doc.id, doc.displayName)}
                                style={{ color: 'red', cursor: 'pointer', textDecoration: 'underline' }}
                                title="Excluir registro deste documento"
                            >Excluir</span>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};
export default DocumentTable;