# Agriculture document review and RAG v1

Agriculture documents are independent, human-reviewed sources for AI advisory. A document may cover only irrigation, soil, pests, harvest or another topic; it does not need to provide every field in a crop profile.

## Upload and review flow

1. PlatformAdmin uploads a PDF, DOCX or TXT. The server reads embedded/searchable text with local parsers and stores the original file, text and chunks in `PendingReview`.
2. PDF files without an extractable text layer are rejected with instructions to OCR them outside SmartFarm and upload a searchable PDF, DOCX or TXT. SmartFarm does not send files to an AI model to transcribe them.
3. Rule-based metadata detection may suggest title, crop, publisher, standard code, version, document type and topics. These are suggestions to verify against the original, not AI-generated facts.
4. A background AI check may assess whether the content appears to be about agriculture. It does not verify technical correctness, compare with VietGAP rules, or certify compliance. Human review remains required.
5. The reviewer checks the stored text against the original file, corrects metadata/text if needed, and approves or requests correction. Only `Approved` documents are embedded and eligible for RAG.
6. Approving a new version with the same title and publisher supersedes the older approved version. Identical content in scope is rejected with `409`.

## Review requirements

- Documents must have a determined document type and crop scope (a specific crop or an explicitly confirmed general scope).
- Source/publisher, standard code and declared-topic content are checked by the document review rules. A reviewer may approve an incomplete thematic source with a written explanation.
- AI agriculture relevance results are advisory. `NotAgricultural` requires a review note to override; `Uncertain` or `VerificationError` does not imply the document is valid.

## Retrieval

`AgricultureKnowledgeRetriever` searches only approved documents in the authorized tenant/public scope and the matching crop scope (plus general sources). It ranks by vector similarity when available and falls back to keyword search, boosts matching topics, limits passages per document, and returns document/page/section citations. AI advisory uses these retrieved passages as sources; document upload does not create or modify a Growth Profile.

## Out of scope

SmartFarm no longer provides a document-to-Growth-Profile generation endpoint. Growth Profiles are managed separately from uploaded RAG documents. The existing AI advisory flow remains available and can use approved document passages when relevant.
