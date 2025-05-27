using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs;

public class UpdateDocumentDto
{
    // Para cada campo que pode ser atualizado, o cliente envia o novo valor
    // e um booleano indicando se essa atualização deve ser aplicada.

    [MaxLength(260)] // Validação ainda se aplica se o valor for fornecido E UpdateDisplayName for true
    public string? DisplayName { get; set; }
    public bool UpdateDisplayName { get; set; } // Se true, usa o valor de DisplayName

    public DateTime? ExpiryDate { get; set; }
    public bool UpdateExpiryDate { get; set; } // Se true, usa o valor de ExpiryDate (pode ser null)

    [MaxLength(1000)] // Validação ainda se aplica se o valor for fornecido E UpdateNotes for true
    public string? Notes { get; set; }
    public bool UpdateNotes { get; set; } // Se true, usa o valor de Notes (pode ser null ou string vazia)
}
