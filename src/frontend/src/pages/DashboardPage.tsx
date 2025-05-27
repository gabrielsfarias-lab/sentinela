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

// Estado para controlar qual célula está em modo de edição
interface EditingCell {
  docId: string;
  field: 'displayName' | 'expiryDate' | 'notes'; // Campos editáveis
}

const DashboardPage: React.FC = () => {
  const { userEmail, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<FeDocumentDto[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Loading geral para a página/lista
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading para ações específicas (upload, save, delete)
  const [error, setError] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>(''); // Valor temporário durante a edição (sempre string para input)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

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
    if (!acceptedFiles.length) return;
    setIsSubmitting(true);
    setError(null);

    const metadataList: FeCreateDocumentDto[] = acceptedFiles.map(file => ({
      originalFileName: file.name,
      originalFileSize: file.size,
      originalFileLastModified: new Date(file.lastModified).toISOString(),
      displayName: file.name,
    }));

    try {
      await createDocumentsMetadata(metadataList);
      fetchDocuments(); // Recarrega a lista para incluir os novos
    } catch (err) {
      console.error("Erro ao criar metadados de documentos:", err);
      setError("Falha ao registrar os novos documentos.");
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchDocuments]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpeg', '.jpg', '.png'] }
  });

  const handleLogout = () => {
    logout({ navigate });
  };

  const getUpcomingExpiryDocuments = (days: number = 30): FeDocumentDto[] => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const today = new Date(); // Para garantir que não mostre os já vencidos como "próximos"
    today.setHours(0, 0, 0, 0); // Começo do dia de hoje

    return documents
      .filter(doc => {
        if (!doc.expiryDate) return false;
        const expiry = new Date(doc.expiryDate);
        return expiry >= today && expiry <= futureDate;
      })
      .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime());
  };

  const upcomingDocuments = getUpcomingExpiryDocuments(30);

  const handleCellDoubleClick = (docId: string, field: EditingCell['field'], currentValue: string | null | undefined) => {
    setEditingCell({ docId, field });
    if (field === 'expiryDate') {
      // O input type="date" espera "YYYY-MM-DD"
      setEditValue(currentValue ? new Date(currentValue).toISOString().split('T')[0] : '');
    } else {
      setEditValue(currentValue ?? ''); // Se null ou undefined, usa string vazia
    }
  };

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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
      return;
    }

    let processedEditValue: string | null = typeof editValue === 'string' ? editValue.trim() : null;
    let originalFieldValue: string | null | undefined = originalDocument[field];

    const updatePayload: FeUpdateDocumentDto = {};
    let valueHasChanged = false;

    if (field === 'displayName') {
      processedEditValue = processedEditValue || originalDocument.originalFileName; // Fallback para nome original se vazio
      if (originalFieldValue !== processedEditValue) {
        updatePayload.displayName = processedEditValue;
        updatePayload.updateDisplayName = true;
        valueHasChanged = true;
      }
    } else if (field === 'expiryDate') {
      const inputDateValue = processedEditValue; // "YYYY-MM-DD" ou ""
      let apiDateValue: string | null = null;

      if (inputDateValue && inputDateValue.trim() !== '') {
        const dateObj = new Date(inputDateValue + "T00:00:00Z"); // Adiciona Z para UTC se a data for só YYYY-MM-DD
        if (!isNaN(dateObj.getTime())) {
          apiDateValue = dateObj.toISOString();
        } else {
          setError("Formato de data inválido.");
          // Não limpa editingCell para o usuário poder corrigir
          return;
        }
      }
      // Compara com a data original (que também deve ser ISO string ou null)
      const originalIsoDate = originalDocument.expiryDate ? new Date(originalDocument.expiryDate).toISOString() : null;
      if (apiDateValue !== originalIsoDate) {
        updatePayload.expiryDate = apiDateValue;
        updatePayload.updateExpiryDate = true;
        valueHasChanged = true;
      }
    } else if (field === 'notes') {
      // Permite string vazia ou null. Se o input está vazio, consideramos null.
      processedEditValue = (processedEditValue && processedEditValue.trim() !== '') ? processedEditValue : null;
      if (originalFieldValue !== processedEditValue) {
        updatePayload.notes = processedEditValue;
        updatePayload.updateNotes = true;
        valueHasChanged = true;
      }
    }

    if (valueHasChanged && (updatePayload.updateDisplayName || updatePayload.updateExpiryDate || updatePayload.updateNotes)) {
      setIsSubmitting(true); // Loading específico para esta ação
      setError(null);
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
      console.log("Nenhuma alteração real detectada para salvar ou nenhuma flag de update.");
    }

    setEditingCell(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.currentTarget.tagName.toLowerCase() === 'textarea' && !e.shiftKey) { // Para textarea, Enter salva, Shift+Enter nova linha
        e.preventDefault(); // Previne nova linha se não for Shift+Enter
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
        <input {...getInputProps()} />
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
                <strong>{doc.displayName}</strong> - Vence em: {new Date(doc.expiryDate!).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>Todos os Documentos</h3>
      {documents.length === 0 && !isLoading ? (
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
            {documents.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 8px' }} onDoubleClick={() => handleCellDoubleClick(doc.id, 'displayName', doc.displayName)}>
                  {editingCell?.docId === doc.id && editingCell?.field === 'displayName' ? (
                    <input
                      ref={editingCell.field === 'displayName' ? inputRef as React.RefObject<HTMLInputElement> : null}
                      type="text"
                      value={editValue}
                      onChange={handleEditChange}
                      onBlur={handleEditSave}
                      onKeyDown={handleEditKeyDown}
                      style={{ width: '95%', padding: '6px', boxSizing: 'border-box' }}
                    />
                  ) : (
                    doc.displayName
                  )}
                </td>
                <td style={{ padding: '10px 8px' }} onDoubleClick={() => handleCellDoubleClick(doc.id, 'expiryDate', doc.expiryDate)}>
                  {editingCell?.docId === doc.id && editingCell?.field === 'expiryDate' ? (
                    <input
                      ref={editingCell.field === 'expiryDate' ? inputRef as React.RefObject<HTMLInputElement> : null}
                      type="date"
                      value={editValue} // editValue já está como YYYY-MM-DD ou ''
                      onChange={handleEditChange}
                      onBlur={handleEditSave}
                      onKeyDown={handleEditKeyDown}
                      style={{ width: '95%', padding: '6px', boxSizing: 'border-box' }}
                    />
                  ) : (
                    doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'
                  )}
                </td>
                <td style={{ padding: '10px 8px' }}>{doc.originalFileName}</td>
                {/* <td style={{ padding: '10px 8px' }}>{doc.originalFileType || 'N/A'}</td> */}
                <td style={{ padding: '10px 8px' }} onDoubleClick={() => handleCellDoubleClick(doc.id, 'notes', doc.notes)}>
                  {editingCell?.docId === doc.id && editingCell?.field === 'notes' ? (
                    <textarea
                      ref={editingCell.field === 'notes' ? inputRef as React.RefObject<HTMLTextAreaElement> : null}
                      value={editValue}
                      onChange={handleEditChange}
                      onBlur={handleEditSave}
                      onKeyDown={handleEditKeyDown}
                      rows={2}
                      style={{ width: '95%', padding: '6px', boxSizing: 'border-box', minHeight: '40px' }}
                    />
                  ) : (
                    doc.notes || '---'
                  )}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <span
                    onClick={() => handleDeleteDocument(doc.id, doc.displayName)}
                    style={{ color: 'red', cursor: 'pointer', textDecoration: 'underline' }}
                    title="Excluir registro deste documento"
                  >
                    Excluir
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isLoading && documents.length > 0 && <p>Atualizando lista...</p>}
      {isSubmitting && <p>Salvando alterações...</p>}
    </div>
  );
};

export default DashboardPage;