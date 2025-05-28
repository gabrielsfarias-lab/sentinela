import React from 'react';
import { type FeDocumentDto } from '../../services/DocumentService'; // Ajuste o caminho

interface UpcomingExpiriesProps {
    upcomingDocuments: FeDocumentDto[];
    displayFormattedDate: (isoDateString: string | null | undefined) => string;
}

const UpcomingExpiries: React.FC<UpcomingExpiriesProps> = ({ upcomingDocuments, displayFormattedDate }) => {
    if (upcomingDocuments.length === 0) {
        return null;
    }

    return (
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
    );
};

export default UpcomingExpiries;