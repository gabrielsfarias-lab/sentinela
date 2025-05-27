using System.Security.Claims;
using Backend.Data;
using Backend.DTOs;
using Backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[Authorize]
[ApiController]
[Route("documentos")]
public class DocumentsController : ControllerBase // Removido o construtor primário para clareza com os campos _
{
    private readonly ApplicationDbContext _context;
    private readonly UserManager<IdentityUser> _userManager;
    private readonly ILogger<DocumentsController> _logger;

    public DocumentsController(
        ApplicationDbContext context,
        UserManager<IdentityUser> userManager,
        ILogger<DocumentsController> logger
    )
    {
        _context = context;
        _userManager = userManager;
        _logger = logger;
    }

    private string? GetCurrentUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // GET e POST permanecem os mesmos da sua versão postada (que já estava correta)
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DocumentDto>>> GetDocuments()
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var documents = await _context
            .Documents.Where(d => d.UserId == userId)
            .OrderByDescending(d => d.UpdatedAt)
            .Select(d => new DocumentDto
            {
                Id = d.Id,
                OriginalFileName = d.OriginalFileName,
                OriginalFileSize = d.OriginalFileSize,
                OriginalFileLastModified = d.OriginalFileLastModified,
                DisplayName = d.DisplayName,
                ExpiryDate = d.ExpiryDate,
                Notes = d.Notes,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt,
            })
            .ToListAsync();
        return Ok(documents);
    }

    [HttpPost]
    public async Task<ActionResult<List<DocumentDto>>> CreateDocuments(
        [FromBody] List<CreateDocumentDto> createDtos
    )
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();
        if (createDtos == null || !createDtos.Any())
            return BadRequest("Nenhum dado de documento fornecido.");

        var createdDocuments = new List<Document>();
        var now = DateTime.UtcNow;

        foreach (var dto in createDtos)
        {
            if (string.IsNullOrWhiteSpace(dto.OriginalFileName))
            {
                _logger.LogWarning(
                    "Documento sem OriginalFileName no lote para o usuário {UserId}. Pulando.",
                    userId
                );
                continue;
            }
            var document = new Document
            {
                UserId = userId,
                OriginalFileName = dto.OriginalFileName,
                OriginalFileSize = dto.OriginalFileSize,
                OriginalFileLastModified = dto.OriginalFileLastModified,
                DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName)
                    ? dto.OriginalFileName
                    : dto.DisplayName,
                ExpiryDate = dto.ExpiryDate,
                Notes = dto.Notes,
                CreatedAt = now,
                UpdatedAt = now,
            };
            createdDocuments.Add(document);
        }

        if (createdDocuments.Count == 0)
            return BadRequest("Nenhum documento válido para criação no lote.");

        _context.Documents.AddRange(createdDocuments);
        await _context.SaveChangesAsync();
        _logger.LogInformation(
            "{Count} documentos criados para o usuário {UserId}.",
            createdDocuments.Count,
            userId
        );

        var resultDtos = createdDocuments
            .Select(d => new DocumentDto
            {
                Id = d.Id,
                OriginalFileName = d.OriginalFileName,
                OriginalFileSize = d.OriginalFileSize,
                OriginalFileLastModified = d.OriginalFileLastModified,
                DisplayName = d.DisplayName,
                ExpiryDate = d.ExpiryDate,
                Notes = d.Notes,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt,
            })
            .ToList();
        return Ok(resultDtos);
    }

    // PATCH: /documentos/{id}
    [HttpPatch("{id}")]
    public async Task<IActionResult> UpdateDocument(Guid id, [FromBody] UpdateDocumentDto updateDto)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var document = await _context.Documents.FirstOrDefaultAsync(d =>
            d.Id == id && d.UserId == userId
        );

        if (document == null)
        {
            _logger.LogWarning(
                "Tentativa de PATCH no documento ID {DocumentId} não encontrado para o usuário {UserId}.",
                id,
                userId
            );
            return NotFound("Documento não encontrado.");
        }

        bool changed = false;

        // Usar as flags booleanas do DTO para determinar quais campos atualizar
        if (updateDto.UpdateDisplayName)
        {
            // Mesmo que updateDto.DisplayName seja null, se UpdateDisplayName for true,
            // significa que o usuário intencionalmente quer limpar o DisplayName (se o campo no DB permitir null).
            // No nosso Document.cs, DisplayName é [Required], então não pode ser null.
            // Mas pode ser string vazia.
            if (document.DisplayName != updateDto.DisplayName)
            {
                document.DisplayName = updateDto.DisplayName ?? string.Empty; // Garante que não seja null para campo Required
                changed = true;
            }
        }

        if (updateDto.UpdateExpiryDate)
        {
            if (document.ExpiryDate != updateDto.ExpiryDate)
            {
                document.ExpiryDate = updateDto.ExpiryDate; // Permite definir ExpiryDate como null
                changed = true;
            }
        }

        if (updateDto.UpdateNotes)
        {
            if (document.Notes != updateDto.Notes)
            {
                document.Notes = updateDto.Notes; // Permite definir Notes como null ou string vazia
                changed = true;
            }
        }

        if (changed)
        {
            document.UpdatedAt = DateTime.UtcNow;
            try
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation(
                    "Documento ID {DocumentId} atualizado para o usuário {UserId}.",
                    id,
                    userId
                );
            }
            catch (DbUpdateConcurrencyException)
            {
                // ... (tratamento de concorrência) ...
                _logger.LogError(
                    "Erro de concorrência ao atualizar Documento ID {DocumentId} para o usuário {UserId}.",
                    id,
                    userId
                );
                return Conflict("O documento foi modificado por outra operação. Tente novamente.");
            }
        }
        else
        {
            _logger.LogInformation(
                "Nenhuma alteração aplicada ao Documento ID {DocumentId} para o usuário {UserId} (ou valores eram os mesmos).",
                id,
                userId
            );
            // Mesmo sem alteração, é comum retornar o estado atual do recurso ou 200 OK.
        }

        // Retornar o documento atualizado (ou não) como DTO
        var resultDto = new DocumentDto
        { /* ... mapeamento ... */
        };
        resultDto = new DocumentDto
        {
            Id = document.Id,
            OriginalFileName = document.OriginalFileName,
            OriginalFileSize = document.OriginalFileSize,
            OriginalFileLastModified = document.OriginalFileLastModified,
            DisplayName = document.DisplayName,
            ExpiryDate = document.ExpiryDate,
            Notes = document.Notes,
            CreatedAt = document.CreatedAt,
            UpdatedAt = document.UpdatedAt,
        };
        return Ok(resultDto);
    }

    // DELETE permanece o mesmo da sua versão postada (que já estava correta)
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDocument(Guid id)
    {
        var userId = GetCurrentUserId();
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var document = await _context.Documents.FirstOrDefaultAsync(d =>
            d.Id == id && d.UserId == userId
        );

        if (document == null)
        {
            _logger.LogWarning(
                "Tentativa de DELETE no documento ID {DocumentId} não encontrado para o usuário {UserId}.",
                id,
                userId
            );
            return NotFound("Documento não encontrado.");
        }

        _context.Documents.Remove(document);
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Documento ID {DocumentId} excluído para o usuário {UserId}.",
            id,
            userId
        );
        return NoContent();
    }
}
