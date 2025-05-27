import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
  getDocuments,
  createDocumentsMetadata,
  updateDocumentMetadata,
  deleteDocumentMetadata,
  type FeDocumentDto,
  type FeCreateDocumentDto,
  type FeUpdateDocumentDto
} from '../services/DocumentService';
import { useDropzone } from 'react-dropzone';
import { format, parseISO, isValid, parse as parseDateFns } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

interface EditingCell {
  docId: string;
  field: 'displayName' | 'expiryDate' | 'notes';
}

type SortableKeys = keyof Pick<FeDocumentDto, 'displayName' | 'expiryDate' | 'originalFileName' | 'updatedAt'>;
interface SortConfig {
  key: SortableKeys | null;
  direction: 'ascending' | 'descending' | null;
}

const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';

const DashboardPage: React.FC = () => {
  const { userEmail, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<FeDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'updatedAt', direction: 'descending' });

  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchDocuments = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error("Erro ao buscar documentos:", err);
      setError("Não foi possível carregar os documentos.");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const metadataList: FeCreateDocumentDto[] = acceptedFiles.map(file => ({
      originalFileName: file.name,
      originalFileType: file.type,
      originalFileSize: file.size,
      originalFileLastModified: new Date(file.lastModified).toISOString(),
      displayName: file.name,
    }));
    try {
      await createDocumentsMetadata(metadataList);
      fetchDocuments();
    } catch (err) {
      console.error("Erro ao criar metadados:", err);
      setError("Falha ao registrar novos documentos.");
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchDocuments, isSubmitting]);

  const { getRootProps, getInputProps, isDragActive, isFocused, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    disabled: isSubmitting
  });

  const handleLogout = () => {
    logout({ navigate });
  };

  const displayFormattedDate = (isoDateString: string | null | undefined): string => {
    if (!isoDateString) return 'N/A';
    try {
      const dateInUtc = parseISO(isoDateString);
      if (!isValid(dateInUtc)) return 'Data Inv.';
      const dateInBrasilia = toZonedTime(dateInUtc, BRASILIA_TIME_ZONE);
      return format(dateInBrasilia, 'dd/MM/yyyy');
    } catch (e) {
      console.error("Erro ao formatar data para exibição:", isoDateString, e);
      return 'Data Err.';
    }
  };

  const getUpcomingExpiryDocuments = (days: number = 30): FeDocumentDto[] => {
    const today = new Date();
    const brasiliaCurrentTime = toZonedTime(today, BRASILIA_TIME_ZONE);
    const startOfTodayBrasilia = new Date(brasiliaCurrentTime.getFullYear(), brasiliaCurrentTime.getMonth(), brasiliaCurrentTime.getDate(), 0, 0, 0);
    const startOfTodayUtc = fromZonedTime(startOfTodayBrasilia, BRASILIA_TIME_ZONE);
    const futureDateBrasilia = new Date(brasiliaCurrentTime.getFullYear(), brasiliaCurrentTime.getMonth(), brasiliaCurrentTime.getDate() + days, 23, 59, 59, 999);
    const endOfFutureDateUtc = fromZonedTime(futureDateBrasilia, BRASILIA_TIME_ZONE);

    return documents
      .filter(doc => {
        if (!doc.expiryDate) return false;
        try {
          const expiryUtc = parseISO(doc.expiryDate);
          if (!isValid(expiryUtc)) return false;
          return expiryUtc >= startOfTodayUtc && expiryUtc <= endOfFutureDateUtc;
        } catch {
          return false;
        }
      })
      .sort((a, b) => parseISO(a.expiryDate!).getTime() - parseISO(b.expiryDate!).getTime());
  };

  const upcomingDocuments = getUpcomingExpiryDocuments(30);

  const handleCellDoubleClick = (docId: string, field: EditingCell['field'], currentValue: string | null | undefined) => {
    setEditingCell({ docId, field });
    if (field === 'expiryDate') {
      if (currentValue) {
        try {
          const dateInUtc = parseISO(currentValue);
          const dateInBrasilia = toZonedTime(dateInUtc, BRASILIA_TIME_ZONE);
          setEditValue(format(dateInBrasilia, 'yyyy-MM-dd'));
        } catch (e) {
          setEditValue('');
          console.error("Data inválida (expiryDate) ao iniciar edição:", currentValue, e);
        }
      } else {
        setEditValue('');
      }
    } else {
      setEditValue(currentValue ?? '');
    }
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.tagName.toLowerCase() === 'input' && (inputRef.current as HTMLInputElement).type === 'text' ||
        inputRef.current.tagName.toLowerCase() === 'textarea') {
        (inputRef.current as HTMLInputElement | HTMLTextAreaElement).select();
      }
    }
  }, [editingCell]);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  };

  const handleEditSave = async () => {
    if (!editingCell) return;
    const { docId, field } = editingCell;
    const originalDocument = documents.find(d => d.id === docId);

    if (!originalDocument) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    // Usar estas variáveis consistentemente
    const updatePayload: FeUpdateDocumentDto = {};
    let valueActuallyChanged = false; // Renomeado para clareza e para evitar conflito com nome antigo

    // Lógica para processar 'displayName'
    if (field === 'displayName') {
      const currentDisplayName = (typeof editValue === 'string' ? editValue.trim() : '') || originalDocument.originalFileName;
      const originalDisplayName = originalDocument.displayName || originalDocument.originalFileName;

      if (originalDisplayName !== currentDisplayName) {
        updatePayload.displayName = currentDisplayName;
        updatePayload.updateDisplayName = true;
        valueActuallyChanged = true;
      }
    }
    // Lógica para processar 'expiryDate'
    else if (field === 'expiryDate') {
      const inputDateStr = typeof editValue === 'string' ? editValue.trim() : "";
      const originalApiDateValue = originalDocument.expiryDate ? parseISO(originalDocument.expiryDate).toISOString() : null;
      let newApiDateValue: string | null = null;

      if (inputDateStr) {
        try {
          const parsedDateLocal = parseDateFns(inputDateStr, 'yyyy-MM-dd', new Date());
          if (!isValid(parsedDateLocal)) throw new Error("Data do input inválida");
          const endOfDayInBrasilia = new Date(parsedDateLocal.getFullYear(), parsedDateLocal.getMonth(), parsedDateLocal.getDate(), 23, 59, 59, 999);
          newApiDateValue = fromZonedTime(endOfDayInBrasilia, BRASILIA_TIME_ZONE).toISOString();
        } catch (e) {
          setError("Formato de data inválido. Use YYYY-MM-DD.");
          console.error("Erro ao parsear data do input:", inputDateStr, e);
          return; // Mantém o modo de edição
        }
      } // Se inputDateStr for vazio, newApiDateValue permanece null

      if (newApiDateValue !== originalApiDateValue) {
        updatePayload.expiryDate = newApiDateValue;
        updatePayload.updateExpiryDate = true;
        valueActuallyChanged = true;
      }
    }
    // Lógica para processar 'notes'
    else if (field === 'notes') {
      const currentNotes = (typeof editValue === 'string' ? editValue.trim() : null);
      const originalNotes = originalDocument.notes || null;

      if (originalNotes !== currentNotes) {
        updatePayload.notes = currentNotes;
        updatePayload.updateNotes = true;
        valueActuallyChanged = true;
      }
    }

    // Lógica para chamar a API se houve mudança
    if (valueActuallyChanged) { // Agora esta flag reflete corretamente se algum campo mudou
      // E as flags updateXyz no payload indicam quais campos mudaram
      if (updatePayload.updateDisplayName || updatePayload.updateExpiryDate || updatePayload.updateNotes) {
        setIsSubmitting(true);
        setError(null);
        try {
          const updatedDoc = await updateDocumentMetadata(docId, updatePayload);
          setDocuments(prevDocs => prevDocs.map(doc => (doc.id === docId ? updatedDoc : doc)));
          setEditingCell(null); // Sucesso: sai do modo de edição
          setEditValue('');     // Limpa valor de edição
        } catch (err: any) {
          console.error(`Erro ao atualizar ${field} do documento ${docId}:`, err);
          let errorMsg = `Falha ao salvar ${field}.`;
          if (err.response?.data?.message) {
            errorMsg = err.response.data.message;
          } else if (err.response?.data?.errors) {
            errorMsg = Object.values(err.response.data.errors).flat().join(' ');
          }
          setError(errorMsg);
          // Não sai do modo de edição em caso de erro da API
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // Este caso não deveria ser atingido se valueActuallyChanged for true
        console.warn("valueActuallyChanged era true, mas nenhuma flag de update foi definida. Saindo do modo de edição.");
        setEditingCell(null);
        setEditValue('');
      }
    } else {
      console.log(`Valor para ${field} não alterado, saindo do modo de edição.`);
      setEditingCell(null); // Sai do modo de edição se não houve mudança
      setEditValue('');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.currentTarget.tagName.toLowerCase() === 'textarea' && e.shiftKey) {
        return;
      }
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o registro de "${docName}"? Esta ação não apaga o arquivo do seu computador.`)) {
      setIsSubmitting(true);
      setError(null);
      try {
        await deleteDocumentMetadata(docId);
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
      } catch (err) {
        console.error(`Erro ao excluir documento ${docId}:`, err);
        setError("Falha ao excluir o documento.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const processedDocuments = useMemo(() => {
    let filteredItems = [...documents];

    if (searchTerm.trim() !== '') {
      const lowercasedFilter = searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(doc =>
        doc.displayName.toLowerCase().includes(lowercasedFilter) ||
        doc.originalFileName.toLowerCase().includes(lowercasedFilter) ||
        (doc.notes && doc.notes.toLowerCase().includes(lowercasedFilter))
      );
    }

    if (sortConfig.key !== null && sortConfig.direction !== null) {
      filteredItems.sort((a, b) => {
        if (!Object.prototype.hasOwnProperty.call(a, sortConfig.key!) || !Object.prototype.hasOwnProperty.call(b, sortConfig.key!)) {
          return 0;
        }
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];

        if (sortConfig.key === 'expiryDate' || sortConfig.key === 'updatedAt') {
          const timeA = valA ? parseISO(valA as string).getTime() : (sortConfig.direction === 'ascending' ? Infinity : -Infinity);
          const timeB = valB ? parseISO(valB as string).getTime() : (sortConfig.direction === 'ascending' ? Infinity : -Infinity);
          if (timeA < timeB) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (timeA > timeB) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          const comparison = valA.toLowerCase().localeCompare(valB.toLowerCase());
          return sortConfig.direction === 'ascending' ? comparison : -comparison;
        }
        if (valA! < valB!) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA! > valB!) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return filteredItems;
  }, [documents, searchTerm, sortConfig]);

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortableKeys) => {
    if (sortConfig.key !== key) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕️</span>;
    return sortConfig.direction === 'ascending' ? '🔼' : '🔽';
  };

  const dropzoneStyle = useMemo(() => ({
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderColor: isDragAccept ? 'green' : isDragReject ? 'red' : (isFocused || isDragActive ? '#2196f3' : '#ccc'),
    padding: '40px 20px',
    textAlign: 'center' as const,
    marginBottom: '30px',
    backgroundColor: isDragActive ? '#e6ffe6' : (isSubmitting ? '#e0e0e0' : '#f9f9f9'),
    borderRadius: '8px',
    cursor: isSubmitting ? 'default' : 'pointer',
    opacity: isSubmitting ? 0.6 : 1,
    transition: 'border .24s ease-in-out, background-color .24s ease-in-out, opacity .24s ease-in-out'
  }), [isDragActive, isFocused, isDragAccept, isDragReject, isSubmitting]);

  // MUDANÇA PRINCIPAL: Mover o return condicional para depois de todos os hooks
  if (isLoading && !documents.length) {
    return <div style={{ padding: '20px' }}>Carregando documentos...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Dashboard de Documentos</h1>
        <div>
          {userEmail && <span style={{ marginRight: '15px' }}>Bem-vindo, {userEmail}!</span>}
          <Link to="/account/change-password" style={{ marginRight: '10px', color: '#007bff' }}>Alterar Senha</Link>
          <button onClick={handleLogout} style={{ padding: '8px 12px' }}>Sair</button>
        </div>
      </div>

      <div {...getRootProps({ style: dropzoneStyle })}>
        <input {...getInputProps()} />
        {isSubmitting ? (
          <p>Registrando documentos, por favor aguarde...</p>
        ) : isDragActive ? (
          <p>Solte os arquivos aqui para registrar...</p>
        ) : (
          <p>Arraste e solte arquivos aqui, ou clique para selecionar</p>
        )}
      </div>

      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Erro: {error}</p>}

      {upcomingDocuments.length > 0 && (
        <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ffc107', borderRadius: '8px', backgroundColor: '#fff3cd' }}>
          <h3 style={{ marginTop: 0, color: '#856404' }}>⚠️ Próximos do Vencimento (30 dias)</h3>
          <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
            {upcomingDocuments.map(doc => (
              <li key={`upcoming-${doc.id}`} style={{ padding: '8px 0', borderBottom: '1px solid #ffeeba' }}>
                <strong>{doc.displayName}</strong> - Vence em: {displayFormattedDate(doc.expiryDate)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ margin: '20px 0' }}>
        <input
          type="text"
          placeholder="Buscar documentos por nome, nome original ou notas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={isSubmitting || isLoading}
          style={{ width: '100%', padding: '10px', fontSize: '1em', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
        />
      </div>

      <h3>Todos os Documentos</h3>
      {(processedDocuments.length === 0 && !isLoading && searchTerm.trim() === '') ? (
        <p>Nenhum documento registrado. Arraste arquivos para a área acima para começar.</p>
      ) : (processedDocuments.length === 0 && !isLoading && searchTerm.trim() !== '') ? (
        <p>Nenhum documento encontrado para o termo: "{searchTerm}"</p>
      ) :
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
            {processedDocuments.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 8px' }} onDoubleClick={() => handleCellDoubleClick(doc.id, 'displayName', doc.displayName)}>
                  {editingCell?.docId === doc.id && editingCell?.field === 'displayName' ? (
                    <input
                      ref={editingCell.field === 'displayName' ? inputRef as React.RefObject<HTMLInputElement> : null}
                      type="text" value={editValue} onChange={handleEditChange}
                      onBlur={handleEditSave} onKeyDown={handleEditKeyDown}
                      style={{ width: '95%', padding: '6px', boxSizing: 'border-box' }}
                    />
                  ) : (doc.displayName)}
                </td>
                <td style={{ padding: '10px 8px' }} onDoubleClick={() => handleCellDoubleClick(doc.id, 'expiryDate', doc.expiryDate)}>
                  {editingCell?.docId === doc.id && editingCell?.field === 'expiryDate' ? (
                    <input
                      ref={editingCell.field === 'expiryDate' ? inputRef as React.RefObject<HTMLInputElement> : null}
                      type="date" value={editValue}
                      onChange={handleEditChange} onBlur={handleEditSave}
                      onKeyDown={handleEditKeyDown}
                      style={{ width: '95%', padding: '6px', boxSizing: 'border-box' }}
                    />
                  ) : (displayFormattedDate(doc.expiryDate))}
                </td>
                <td style={{ padding: '10px 8px' }}>{doc.originalFileName}</td>
                <td style={{ padding: '10px 8px' }} onDoubleClick={() => handleCellDoubleClick(doc.id, 'notes', doc.notes)}>
                  {editingCell?.docId === doc.id && editingCell?.field === 'notes' ? (
                    <textarea
                      ref={editingCell.field === 'notes' ? inputRef as React.RefObject<HTMLTextAreaElement> : null}
                      value={editValue} onChange={handleEditChange}
                      onBlur={handleEditSave} onKeyDown={handleEditKeyDown}
                      rows={2} style={{ width: '95%', padding: '6px', boxSizing: 'border-box', minHeight: '40px' }}
                    />
                  ) : (doc.notes || '---')}
                </td>
                <td style={{ padding: '10px 8px' }}>{displayFormattedDate(doc.updatedAt)}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span onClick={() => handleDeleteDocument(doc.id, doc.displayName)}
                    style={{ color: 'red', cursor: 'pointer', textDecoration: 'underline' }}
                    title="Excluir registro deste documento"
                  >Excluir</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      {isLoading && documents.length > 0 && <p>Atualizando lista...</p>}
    </div>
  );
};

export default DashboardPage;