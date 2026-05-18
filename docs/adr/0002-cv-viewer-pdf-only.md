# CV viewer renders only PDFs in v1

The bulk uploader accepts `.pdf`, `.txt`, `.md`, `.doc`, `.docx`, but the Application detail's CV pane only embeds PDFs. Other formats and the no-CV state both render an empty placeholder with an "Upload CV" affordance; non-PDF uploads also offer a "Download original" link.

The alternative ("show extracted `cvText` for non-PDFs, with download for original") was rejected as scope creep for v1. The schema already stores extracted text on `hrApplication.cvText`, so adding the fallback later is a UI change with no data-model impact.

If a recruiter uploads a `.docx` they will see an empty pane until either the format support is added here or the file is re-uploaded as a PDF. That's the trade-off we accepted to keep this iteration small.
