# Agriculture document review v1

See DECISIONS.md #25, #26 and #27.

Each document is an **independent RAG source** with its own metadata. A document may cover only one area, such as harvest, pests or irrigation. Answers combine cited passages from several approved documents. A Growth Profile is a separate step, created only when the approved documents for a crop together provide enough cited data.

## Flow

1. **Upload** (`POST /api/v1/ai/knowledge/documents`, PlatformAdmin) with `file`, crop scope, `documentType`, `category` and `topics` (several allowed). The server extracts text (PDF text layer with `[TRANG n]` page markers, Gemini OCR for scanned PDFs, DOCX, TXT) and reads any missing metadata from the content.
2. **Duplicate check.** A SHA-256 hash of the normalised text (`content_hash`) is compared with existing documents in the same tenant scope or the public library. A match returns `409` and nothing is stored.
3. **Saved as `PendingReview`** with chunks, but no AI sufficiency gate. Chunks are split by structure (`StructuredChunker`): web-page chrome is removed, sections follow numbered headings, chunks are about 1,800 characters, and each chunk stores `page_number`, `section_title` and `topic`.
4. **Cited extraction in the background.** The embedding worker runs Gemini extraction for one document per cycle (`extraction_attempted_at_utc` prevents retry loops). Admins can re-run it with `POST …/documents/{id}/extract`.
5. **Human review** (`POST …/documents/{id}/review`). The reviewer checks the text against the retained original file. Approval requires only the items below; any other gap is informational.
6. **`Approved`**: embedded by the background worker and eligible for RAG. Approving a document marks older approved documents with the same title and publisher, in the same tenant scope, as `Superseded`.

## Required on review

| Item | Required when |
|---|---|
| Traceable source: publisher or standard code | always (SRS 4.2.4 "curated and traceable") |
| Standard code (TCVN/QCVN/VietGAP) | `documentType = OfficialStandard` |
| Content for each declared topic | for each value in `topics`: `soil` → soil, `irrigation` → water, `nutrition` → fertiliser, `pest` → IPM, `harvest` → harvest, `record` → records, `climate` → climate values |

A missing required item can still be approved with a review note of at least 20 characters. The same rules live in `VietGapCompletenessChecker` (backend, authoritative) and `frontend/src/pages/admin/vietGapCompleteness.ts`.

## States

- `PendingReview`: newly uploaded, or the text changed. Excluded from embeddings, RAG retrieval and Growth Profile drafting.
- `NeedsCorrection`: a reviewer saved text or notes without approving. Still excluded.
- `Approved`: eligible for embedding, RAG and Growth Profile drafting.
- `Superseded`: a newer version was approved (`superseded_by_document_id`). Kept for traceability and excluded from RAG.

Seed rows (`file_type = 'seed'`) are `Approved`. A text change resets the review state, recomputes the hash and re-queues extraction. Metadata-only edits preserve all three.

## Retrieval (multi-document)

`AgricultureKnowledgeRetriever` fetches three times `topK` candidates (vector search with an HNSW index where pgvector is available, keyword fallback otherwise), filtered by tenant, approval and crop. It then:

- boosts chunks whose `topic` matches a topic detected in the question (`TopicClassifier.ClassifyQuestion`),
- keeps at most two chunks per document, so an answer draws on several sources,
- returns each passage with document, page and section. The prompt receives page and section; the server attaches source titles from `citedPassages`.

## Growth Profile

`POST /api/v1/ai/knowledge/draft-growth-profile`:

- With `documentId`: uses that single approved document (as before).
- Without `documentId`: gathers every approved document for the crop. Official standards come first, then newer documents, each block labelled `=== NGUỒN: … ===`, up to 200,000 characters, with no document cut mid-way.
  - The existing strict generator runs: each stage, duration and threshold must quote the source verbatim.
  - When the documents together still lack the cited data, the endpoint returns `409` with the documents considered; no template values are filled in.
  - On success, each quotation is tagged with its source document title, and `sourceDocuments` lists the documents used.

## Cited extraction rules

Stored as JSON in `structured_extraction` and returned as `extraction` on the document detail.

- Text field values are the verbatim quotation, never the AI's paraphrase.
- A quotation must be found in the stored text after Unicode/whitespace normalisation; otherwise the field is empty.
- Days and ranges are kept only when their numbers appear in the quotation.
- A stage is kept only when its name appears in its own quotation.
- The page number is computed from `[TRANG n]` markers.
- Truncated AI replies (`MAX_TOKENS` or incomplete JSON) are retried with the next model or key, not parsed.

## Other endpoints

- `GET …/documents/{id}/file` (PlatformAdmin, FarmOwner, tenant-scoped) downloads the original bytes.
- `POST /api/v1/ai/knowledge/rechunk` (PlatformAdmin) re-chunks every document with `StructuredChunker`. Vectors are rebuilt in the background, and approved documents are not retrievable until they are re-embedded.
- AI-drafted text saved through `POST …/documents/text` is also stored as an independent source and requires human review.
