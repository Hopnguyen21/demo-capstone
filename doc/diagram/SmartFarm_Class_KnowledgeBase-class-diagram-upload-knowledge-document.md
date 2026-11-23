# Class Diagram - Upload Knowledge Document

Source: `SmartFarm_R4_Class_KnowledgeBase.drawio`.

```mermaid
flowchart LR
  ctl["AgricultureKnowledgeController"]
  ctl_f["- documentService: IAgricultureDocumentService"]
  ctl_m["+ UploadDocument(request: UploadKnowledgeDocumentRequest, ct): ActionResult"]
  req["«DTO»<br/>UploadKnowledgeDocumentRequest"]
  req_f["req_f"]
  req_m["req_m"]
  isvc["«interface»<br/>IAgricultureDocumentService"]
  isvc_f["isvc_f"]
  isvc_m["+ IngestDocumentAsync(title, fileName, fileType, fileBytes, ...): Task<br/>+ ReviewDocumentAsync(...)<br/>+ RequestVerificationAsync(...)<br/>+ SearchAsync(...)"]
  svc["AgricultureDocumentService"]
  svc_f["svc_f"]
  svc_m["+ IngestDocumentAsync(...): Task<br/>+ ReviewDocumentAsync(...)"]
  ch["StructuredChunker"]
  ch_f["+ MaxChars: int = 1800<br/>+ OverlapChars: int = 200"]
  ch_m["ch_m"]
  emb["GeminiEmbeddingProvider"]
  emb_f["emb_f"]
  emb_m["emb_m"]
  db["SmartFarmDbContext"]
  db_f["+ AgricultureDocuments: DbSet<br/>+ AgricultureKnowledgeChunks: DbSet"]
  db_m["+ SaveChangesAsync(ct): Task"]
  doc["«entity»<br/>AgricultureDocument"]
  doc_f["+ Title: string<br/>+ FileName: string?<br/>+ ContentText: string<br/>+ ReviewStatus: string<br/>+ ContentHash: string?<br/>+ Topics: string"]
  doc_m["doc_m"]
  chunk["«entity»<br/>AgricultureKnowledgeChunk"]
  chunk_f["+ DocumentId: Guid<br/>+ ChunkIndex: int<br/>+ Content: string<br/>+ Embedding: vector(768)<br/>+ Status: string<br/>+ Topic: string"]
  chunk_m["chunk_m"]
  title["Class Diagram - Upload Knowledge Document"]
  ctl --> |documentService| isvc
  ctl --> |uses (parameter)| req
  svc --> isvc
  svc --> |uses| ch
  svc --> |db| db
  svc --> |uses| emb
  db --> |AgricultureDocuments 0..*| doc
  db --> |AgricultureKnowledgeChunks 0..*| chunk
  chunk --> |Document 1| doc
```
