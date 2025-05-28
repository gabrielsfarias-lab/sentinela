import axios, { type AxiosError } from 'axios';
import { toast } from 'react-toastify';

// Interface para a estrutura esperada de erros da sua API
// Pode ser expandida conforme necessário
export interface ApiErrorData {
    message?: string;
    title?: string; // Algumas APIs de problema (RFC 7807) retornam um título
    errors?: Record<string, string[]> | string[]; // Para erros de validação de modelo
    // Adicione outros campos que sua API pode retornar em erros
}

/**
 * Processa um erro (geralmente de uma chamada Axios) e retorna uma mensagem de erro amigável.
 * Também exibe um toast de erro.
 * @param error O erro capturado (do tipo unknown).
 * @param defaultMessage Uma mensagem padrão para usar se nenhuma mensagem específica puder ser extraída.
 * @param showToast Se true (padrão), exibe um toast de erro.
 * @returns A mensagem de erro processada, adequada para ser definida no estado de erro de um componente.
 */
export const handleApiServiceError = (
    error: unknown,
    defaultMessage: string = "Ocorreu um erro inesperado. Tente novamente.",
    showToast: boolean = true
): string => {
    console.error(defaultMessage, error); // Logar o erro original para depuração
    let errorMessage = defaultMessage;

    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiErrorData>;
        if (axiosError.response && axiosError.response.data) {
            const apiErrorData = axiosError.response.data;
            // Tenta extrair a mensagem de forma mais específica
            if (typeof apiErrorData.message === 'string' && apiErrorData.message.trim() !== '') {
                errorMessage = apiErrorData.message;
            } else if (apiErrorData.errors) {
                if (Array.isArray(apiErrorData.errors) && apiErrorData.errors.length > 0) {
                    errorMessage = apiErrorData.errors.join(' ');
                } else if (typeof apiErrorData.errors === 'object' && Object.keys(apiErrorData.errors).length > 0) {
                    // Pega a primeira mensagem de erro do primeiro campo, ou junta todas
                    const fieldErrors = Object.values(apiErrorData.errors).flat();
                    if (fieldErrors.length > 0) {
                        errorMessage = fieldErrors.join(' ');
                    }
                }
            } else if (typeof apiErrorData.title === 'string' && apiErrorData.title.trim() !== '') {
                // Fallback para o título do erro RFC 7807 se houver
                errorMessage = apiErrorData.title;
            } else if (axiosError.message && !errorMessage) { // Fallback para a mensagem genérica do AxiosError se nada mais foi encontrado
                errorMessage = axiosError.message;
            }
        } else if (axiosError.message) { // Se não houver response.data, mas houver mensagem no AxiosError
            errorMessage = axiosError.message;
        }
        // Adicionar verificação para status de rede comuns se não houver mensagem específica
        if (errorMessage === defaultMessage || !errorMessage.trim()) { // Se ainda não temos uma boa mensagem
            if (axiosError.response?.status === 404) {
                errorMessage = "Recurso não encontrado no servidor.";
            } else if (axiosError.response?.status === 500) {
                errorMessage = "Erro interno do servidor. Tente novamente mais tarde.";
            } else if (axiosError.isAxiosError && !axiosError.response) {
                errorMessage = "Erro de rede. Verifique sua conexão.";
            }
        }

    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    if (showToast) {
        toast.error(errorMessage);
    }

    return errorMessage;
};