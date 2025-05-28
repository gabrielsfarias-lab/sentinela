import React, { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';

interface DocumentDropzoneProps {
    onDropAccepted: (acceptedFiles: File[]) => void;
    isSubmitting: boolean;
}

const DocumentDropzone: React.FC<DocumentDropzoneProps> = ({
    onDropAccepted,
    isSubmitting,
}) => {
    const {
        getRootProps,
        getInputProps,
        isDragActive,
        isFocused,
        isDragAccept,
        isDragReject
    } = useDropzone({
        onDrop: onDropAccepted,
        disabled: isSubmitting,
        // accept: { 'application/pdf': ['.pdf'], 'image/*': [] } // Exemplo
    });

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

    return (
        <div {...getRootProps({ style: dropzoneStyle as React.CSSProperties })}>
            <input {...getInputProps()} />
            {isSubmitting ? (
                <p>Registrando documentos, por favor aguarde...</p>
            ) : isDragActive ? (
                <p>Solte os arquivos aqui para registrar...</p>
            ) : (
                <p>Arraste e solte arquivos aqui, ou clique para selecionar</p>
            )}
        </div>
    );
};

export default DocumentDropzone;