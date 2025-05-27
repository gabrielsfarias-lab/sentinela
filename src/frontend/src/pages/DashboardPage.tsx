import React, { useEffect, useState, useCallback, useRef } from 'react';
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

import { format, parseISO, isValid, parse as parseDateFns } from 'date-fns'; // Renomeado parse para parseDateFns para evitar conflito
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

interface EditingCell {
  docId: string;
  field: 'displayName' | 'expiryDate' | 'notes';
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

  const fetchDocuments = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true); setError(null);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error("Erro ao buscar documentos:", err);
      setError("Não foi possível carregar os documentos.");
    } finally { setIsLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setIsSubmitting(true); setError(null);
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
    } finally { setIsSubmitting(false); }
  }, [fetchDocuments]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });
  const handleLogout = () => { logout({ navigate }); };

  const displayFormattedDate = (isoDateString: string | null | undefined): string => {
    if (!isoDateString) return 'N/A';
    try {
      const dateInUtc = parseISO(isoDateString);
      if (!isValid(dateInUtc)) return 'Data Inv.';
      const dateInBrasilia = toZonedTime(dateInUtc, BRASILIA_TIME_ZONE);
      return format(dateInBrasilia, 'dd/MM/yyyy'); // Não precisa de timeZone aqui pois dateInBrasilia já está "zonada"
    } catch (e) {
      console.error("Erro ao formatar data para exibição:", isoDateString, e);
      return 'Data Err.';
    }
  };

  const getUpcomingExpiryDocuments = (days: number = 30): FeDocumentDto[] => {
    const today = new Date();
    const brasiliaCurrentTime = toZonedTime(today, BRASILIA_TIME_ZONE); // Hora atual em Brasília

    const startOfTodayBrasilia = new Date(brasiliaCurrentTime.getFullYear(), brasiliaCurrentTime.getMonth(), brasiliaCurrentTime.getDate(), 0, 0, 0);
    const startOfTodayUtc = fromZonedTime(startOfTodayBrasilia, BRASILIA_TIME_ZONE); // Convertido para UTC

    // Fim do dia X dias no futuro em Brasília
    const futureDateBrasilia = new Date(brasiliaCurrentTime.getFullYear(), brasiliaCurrentTime.getMonth(), brasiliaCurrentTime.getDate() + days, 23, 59, 59, 999);
    const endOfFutureDateUtc = fromZonedTime(futureDateBrasilia, BRASILIA_TIME_ZONE); // Convertido para UTC

    return documents
      .filter(doc => {
        if (!doc.expiryDate) return false;
        try {
          const expiryUtc = parseISO(doc.expiryDate);
          if (!isValid(expiryUtc)) return false;
          return expiryUtc >= startOfTodayUtc && expiryUtc <= endOfFutureDateUtc;
        } catch { return false; }
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
          setEditValue(format(dateInBrasilia, 'yyyy-MM-dd')); // Formato para input type="date"
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
      setEditValue(''); // Limpa o valor de edição
      return;
    }

    let processedEditValueForApi: string | null | undefined = undefined; // Valor final a ser enviado para a API
    let originalValueFromDoc: string | null | undefined = originalDocument[field];
    let valueHasChanged = false;
    const updatePayload: FeUpdateDocumentDto = {};

    if (field === 'displayName') {
      const currentDisplayName = (typeof editValue === 'string' ? editValue.trim() : '') || originalDocument.originalFileName;
      originalValueFromDoc = originalDocument.displayName; // Pega o valor original específico

      if (originalValueFromDoc !== currentDisplayName) {
        updatePayload.displayName = currentDisplayName;
        updatePayload.updateDisplayName = true;
        valueHasChanged = true;
      }
    } else if (field === 'expiryDate') {
      const inputDateStr = typeof editValue === 'string' ? editValue.trim() : "";
      originalValueFromDoc = originalDocument.expiryDate ? parseISO(originalDocument.expiryDate).toISOString() : null; // Original como ISO ou null

      if (inputDateStr) { // Se o usuário digitou algo
        try {
          const parsedDateLocal = parseDateFns(inputDateStr, 'yyyy-MM-dd', new Date());
          if (!isValid(parsedDateLocal)) throw new Error("Data do input inválida");

          const endOfDayInBrasilia = new Date(parsedDateLocal.getFullYear(), parsedDateLocal.getMonth(), parsedDateLocal.getDate(), 23, 59, 59, 999);
          processedEditValueForApi = fromZonedTime(endOfDayInBrasilia, BRASILIA_TIME_ZONE).toISOString();
        } catch (e) {
          setError("Formato de data inválido. Use YYYY-MM-DD.");
          console.error("Erro ao parsear data do input:", inputDateStr, e);
          // Não limpa editingCell aqui para o usuário poder corrigir
          return;
        }
      } else { // Usuário limpou o campo de data
        processedEditValueForApi = null;
      }

      if (processedEditValueForApi !== originalValueFromDoc) {
        updatePayload.expiryDate = processedEditValueForApi;
        updatePayload.updateExpiryDate = true;
        valueHasChanged = true;
      }
    } else if (field === 'notes') {
      const currentNotes = (typeof editValue === 'string' ? editValue.trim() : null) || null;
      originalValueFromDoc = originalDocument.notes || null; // Original normalizado para null se undefined

      if (originalValueFromDoc !== currentNotes) {
        updatePayload.notes = currentNotes;
        updatePayload.updateNotes = true;
        valueHasChanged = true;
      }
    }

    if (valueHasChanged && (updatePayload.updateDisplayName || updatePayload.updateExpiryDate || updatePayload.updateNotes)) {
      setIsSubmitting(true); setError(null);
      try {
        const updatedDoc = await updateDocumentMetadata(docId, updatePayload);
        setDocuments(prevDocs =>
          prevDocs.map(doc => (doc.id === docId ? updatedDoc : doc))
        );
      } catch (err: any) {
        console.error(`Erro ao atualizar ${field} do documento ${docId}:`, err);
        let errorMsg = `Falha ao salvar ${field}.`;
        if (err.response && err.response.data && err.response.data.message) {
          errorMsg = err.response.data.message;
        } else if (err.response && err.response.data && err.response.data.errors) {
          const apiErrors = err.response.data.errors;
          errorMsg = Object.values(apiErrors).flat().join(' ');
        }
        setError(errorMsg);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      if (!valueHasChanged) {
        console.log(`Valor para ${field} não alterado, não salvando.`);
      } else {
        console.log("Nenhuma propriedade marcada para atualização no payload (nenhuma flag 'updateXyz' é true).");
      }
    }

    setEditingCell(null);
    setEditValue(''); // Sempre limpa o valor de edição ao sair do modo de edição
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.currentTarget.tagName.toLowerCase() === 'textarea' && !e.shiftKey) {
        e.preventDefault();
        handleEditSave();
      } else if (e.currentTarget.tagName.toLowerCase() !== 'textarea') {
        handleEditSave();
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o registro de "${docName}"? Esta ação não apaga o arquivo do seu computador.`)) {
      setIsSubmitting(true); setError(null);
      try {
        await deleteDocumentMetadata(docId);
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
      } catch (err) {
        console.error(`Erro ao excluir documento ${docId}:`, err);
        setError("Falha ao excluir o documento.");
      } finally { setIsSubmitting(false); }
    }
  };

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

      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? 'green' : '#ccc'}`,
          padding: '40px 20px',
          textAlign: 'center',
          marginBottom: '30px',
          backgroundColor: isDragActive ? '#e6ffe6' : '#f9f9f9',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        <input {...getInputProps()} /> {/* getInputProps e isDragActive são usados aqui */}
        {isDragActive ? (
          <p>Solte os arquivos aqui para registrar...</p>
        ) : (
          <p>Arraste e solte arquivos aqui, ou clique para selecionar</p>
        )}
      </div>

      {isSubmitting && <p>Processando...</p>}
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

      <h3>Todos os Documentos</h3>
      {(documents.length === 0 && !isLoading) ? ( // Parênteses adicionados para clareza
        <p>Nenhum documento registrado. Arraste arquivos para a área acima para começar.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f2f2f2' }}>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Nome Exibição</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Data Validade</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Nome Original</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Notas</th>
              <th style={{ padding: '10px 8px', textAlign: 'left' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => ( // docId e docName são usados em handleDeleteDocument
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
                  ) : (
                    displayFormattedDate(doc.expiryDate)
                  )}
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
                <td style={{ padding: '10px 8px' }}>
                  <span onClick={() => handleDeleteDocument(doc.id, doc.displayName)} // docId e docName usados aqui
                    style={{ color: 'red', cursor: 'pointer', textDecoration: 'underline' }}
                    title="Excluir registro deste documento"
                  >Excluir</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isLoading && documents.length > 0 && <p>Atualizando lista...</p>}
      {isSubmitting && !isLoading && <p>Salvando alterações...</p>} {/* Ajustado para não sobrepor o loading principal */}
    </div>
  );
};

export default DashboardPage;