import React, { useEffect, useState, useCallback, useRef, useMemo, type JSX } from 'react';
import { useAuth } from '../contexts/UseAuthHooks';
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
import { format, parseISO, isValid, parse as parseDateFns } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { toast } from 'react-toastify';
import axios, { AxiosError } from 'axios';
import DocumentTable from '../components/dashboard/DocumentTable';
import DocumentDropzone from '../components/dashboard/DocumentDropzone';
import UpcomingExpiries from '../components/dashboard/UpcomingExpiries';
import { type EditingCell, type SortConfig, type SortableKeys } from '../types/dashboardTypes';

interface ApiErrorData {
  message?: string;
  errors?: Record<string, string[]>;
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
    setIsLoading(true); setError(null);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err: unknown) {
      console.error("Erro ao buscar documentos:", err);
      const errorMsg = "Não foi possível carregar os documentos.";
      setError(errorMsg);

      if (err instanceof AxiosError) {
        toast.error(err.response?.data?.message || err.message || errorMsg);
      } else if (err instanceof Error) {
        toast.error(err.message || errorMsg);
      } else {
        toast.error(errorMsg);
      }
    } finally { setIsLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // Callback para ser passado ao DocumentDropzone
  const handleOnDropAccepted = useCallback(async (acceptedFiles: File[]) => {

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
      const newDocs = await createDocumentsMetadata(metadataList);
      fetchDocuments();
      toast.success(`${newDocs.length} documento(s) registrado(s) com sucesso!`);
    } catch (err: unknown) {
      console.error("Erro ao criar metadados:", err);
      let errorMsg = "Falha ao registrar novos documentos.";

      if (axios.isAxiosError(err) && err.response?.data) {
        const serverError = err.response.data as ApiErrorData;
        if (serverError.message) errorMsg = serverError.message;
      } else if (err instanceof Error) { errorMsg = err.message; }
      setError(errorMsg); toast.error(errorMsg);
    } finally { setIsSubmitting(false); }
  }, [fetchDocuments]);

  const handleLogout = () => { logout({ navigate }); };

  const displayFormattedDate = useCallback((isoDateString: string | null | undefined): string => {
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
  }, []);

  const getUpcomingExpiryDocuments = useCallback((days: number = 30): FeDocumentDto[] => {
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
        } catch { return false; }
      })
      .sort((a, b) => parseISO(a.expiryDate!).getTime() - parseISO(b.expiryDate!).getTime());
  }, [documents]);

  const upcomingDocuments = useMemo(() => getUpcomingExpiryDocuments(30), [getUpcomingExpiryDocuments]);

  const handleCellDoubleClick = useCallback((docId: string, field: EditingCell['field'], currentValue: string | null | undefined) => {
    setEditingCell({ docId, field });
    if (field === 'expiryDate') {
      if (currentValue) {
        try {
          const dateInUtc = parseISO(currentValue);
          const dateInBrasilia = toZonedTime(dateInUtc, BRASILIA_TIME_ZONE);
          setEditValue(format(dateInBrasilia, 'yyyy-MM-dd'));
        } catch (e) { setEditValue(''); console.error("Data inválida (expiryDate) ao iniciar edição:", currentValue, e); }
      } else { setEditValue(''); }
    } else { setEditValue(currentValue ?? ''); }
  }, []);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current.tagName.toLowerCase() === 'input' && ((inputRef.current as HTMLInputElement).type === 'text' || (inputRef.current as HTMLInputElement).type === 'email') ||
        inputRef.current.tagName.toLowerCase() === 'textarea') {
        (inputRef.current as HTMLInputElement | HTMLTextAreaElement).select();
      }
    }
  }, [editingCell]);

  const handleEditChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!editingCell) return;
    const { docId, field } = editingCell;
    const originalDocument = documents.find(d => d.id === docId);
    if (!originalDocument) { setEditingCell(null); setEditValue(''); return; }

    const updatePayload: FeUpdateDocumentDto = {};
    let valueActuallyChanged = false;

    if (field === 'displayName') {
      const currentDisplayName = (typeof editValue === 'string' ? editValue.trim() : '') || originalDocument.originalFileName;
      const originalDisplayName = originalDocument.displayName || originalDocument.originalFileName;
      if (originalDisplayName !== currentDisplayName) {
        updatePayload.displayName = currentDisplayName;
        updatePayload.updateDisplayName = true;
        valueActuallyChanged = true;
      }
    } else if (field === 'expiryDate') {
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
          const errorDateMsg = "Formato de data inválido. Use YYYY-MM-DD.";
          setError(errorDateMsg); toast.error(errorDateMsg);
          console.error("Erro ao parsear data do input:", inputDateStr, e);
          return;
        }
      } else { newApiDateValue = null; }
      if (newApiDateValue !== originalApiDateValue) {
        updatePayload.expiryDate = newApiDateValue;
        updatePayload.updateExpiryDate = true;
        valueActuallyChanged = true;
      }
    } else if (field === 'notes') {
      const currentNotes = (typeof editValue === 'string' ? editValue.trim() : null);
      const originalNotes = originalDocument.notes || null;
      if (originalNotes !== currentNotes) {
        updatePayload.notes = currentNotes;
        updatePayload.updateNotes = true;
        valueActuallyChanged = true;
      }
    }

    if (valueActuallyChanged) {
      if (updatePayload.updateDisplayName || updatePayload.updateExpiryDate || updatePayload.updateNotes) {
        setIsSubmitting(true); setError(null);
        try {
          const updatedDoc = await updateDocumentMetadata(docId, updatePayload);
          setDocuments(prevDocs => prevDocs.map(doc => (doc.id === docId ? updatedDoc : doc)));
          toast.success(`"${field === 'displayName' ? updatedDoc.displayName : field}" atualizado com sucesso!`);
          setEditingCell(null); setEditValue('');
        } catch (err: unknown) {
          console.error(`Erro ao atualizar ${field} do documento ${docId}:`, err);
          let errorMsg = `Falha ao salvar ${field}.`;
          if (axios.isAxiosError(err) && err.response?.data) {
            const serverError = err.response.data as ApiErrorData;
            if (serverError.message) errorMsg = serverError.message;
            else if (serverError.errors) errorMsg = Object.values(serverError.errors).flat().join(' ');
          } else if (err instanceof Error) { errorMsg = err.message; }
          setError(errorMsg); toast.error(errorMsg);
        } finally { setIsSubmitting(false); }
      } else {
        console.warn("valueActuallyChanged era true, mas nenhuma flag de update foi definida.");
        setEditingCell(null); setEditValue('');
      }
    } else {
      console.log(`Valor para ${field} não alterado, saindo do modo de edição.`);
      setEditingCell(null); setEditValue('');
    }
  }, [editingCell, documents, editValue, setDocuments, setError, setIsSubmitting]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.currentTarget.tagName.toLowerCase() === 'textarea' && e.shiftKey) return;
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null); setEditValue('');
    }
  }, [handleEditSave]);

  const handleDeleteDocument = useCallback(async (docId: string, docName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o registro de "${docName}"? Esta ação não apaga o arquivo do seu computador.`)) {
      setIsSubmitting(true); setError(null);
      try {
        await deleteDocumentMetadata(docId);
        setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
        toast.info(`Registro de "${docName}" foi excluído.`);
      } catch (err: unknown) {
        console.error(`Erro ao excluir documento ${docId}:`, err);
        let errorMsg = "Falha ao excluir o documento.";
        if (axios.isAxiosError(err) && err.response?.data?.message) {
          errorMsg = err.response.data.message;
        } else if (err instanceof Error) { errorMsg = err.message; }
        setError(errorMsg); toast.error(errorMsg);
      } finally { setIsSubmitting(false); }
    }
  }, [setDocuments, setError, setIsSubmitting]); // Adicionado setDocuments, setError, setIsSubmitting como dependências

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
        if (!Object.prototype.hasOwnProperty.call(a, sortConfig.key!) || !Object.prototype.hasOwnProperty.call(b, sortConfig.key!)) return 0;
        const valA = a[sortConfig.key!]; const valB = b[sortConfig.key!];
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

  const requestSort = useCallback((key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  }, [sortConfig]);

  const getSortIcon = useCallback((key: SortableKeys): JSX.Element => {
    if (sortConfig.key !== key) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕️</span>;
    return sortConfig.direction === 'ascending' ? <span aria-label="ascending">🔼</span> : <span aria-label="descending">🔽</span>;
  }, [sortConfig]);

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

      <DocumentDropzone
        onDropAccepted={handleOnDropAccepted} // Nome corrigido do callback
        isSubmitting={isSubmitting}
      />

      {error && <p style={{ color: 'red', fontWeight: 'bold', marginTop: '10px', textAlign: 'center' }}>{error}</p>}

      <UpcomingExpiries
        upcomingDocuments={upcomingDocuments}
        displayFormattedDate={displayFormattedDate}
      />

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
      ) : (
        <DocumentTable
          documents={processedDocuments}
          editingCell={editingCell}
          editValue={editValue}
          inputRef={inputRef}
          onCellDoubleClick={handleCellDoubleClick}
          onEditChange={handleEditChange}
          onEditSave={handleEditSave}
          onEditKeyDown={handleEditKeyDown}
          onDeleteDocument={handleDeleteDocument}
          sortConfig={sortConfig}
          requestSort={requestSort}
          getSortIcon={getSortIcon}
          displayFormattedDate={displayFormattedDate}
        />
      )}
      {isLoading && documents.length > 0 && <p>Atualizando lista...</p>}
    </div>
  );
};

export default DashboardPage;