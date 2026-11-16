"use client";

import { useEffect, useRef, useState } from "react";
import { useDocumentFile, useDocumentViewer } from "@/hooks/useDocumentViewer";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { LoadingSpinner } from "../LoadingSpinner";

async function renderPdfPage(blob: Blob, canvas: HTMLCanvasElement, pageNumber: number, scale: number, rotation: number) {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  const data = await blob.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  return pdf.numPages;
}

export function DocumentViewer({
  documentId,
  fileName,
  fileType,
}: {
  documentId?: string | null;
  fileName?: string;
  fileType?: string;
}) {
  const file = useDocumentFile(documentId);
  const url = useObjectUrl(file.data?.blob ?? null);
  const viewer = useDocumentViewer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const isPdf = (fileType ?? file.data?.contentType ?? "").toLowerCase().includes("pdf");
  const { page, scale, rotation, setPageCount } = viewer;

  useEffect(() => {
    if (!file.data?.blob || !isPdf || !canvasRef.current || pdfFailed) {
      return;
    }
    let cancelled = false;
    renderPdfPage(file.data.blob, canvasRef.current, page, scale, rotation)
      .then((count) => {
        if (!cancelled) {
          setPageCount(count);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPdfFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file.data?.blob, isPdf, page, pdfFailed, rotation, scale, setPageCount]);

  return (
    <section className="flex h-full min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Original document</p>
          <h2 className="text-sm font-semibold text-ink">{fileName ?? "Invoice"}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs font-semibold" onClick={viewer.zoomOut}>
            Zoom out
          </button>
          <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs font-semibold" onClick={viewer.zoomIn}>
            Zoom in
          </button>
          <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs font-semibold" onClick={viewer.rotate}>
            Rotate
          </button>
          {isPdf ? (
            <>
              <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs font-semibold" onClick={viewer.previousPage}>
                Previous
              </button>
              <span className="px-1 text-xs text-ink-muted">
                {viewer.page} / {viewer.pageCount}
              </span>
              <button type="button" className="rounded-lg border border-line px-2 py-1 text-xs font-semibold" onClick={viewer.nextPage}>
                Next
              </button>
            </>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto bg-paper p-4">
        {file.isLoading ? (
          <LoadingSpinner label="Loading document…" />
        ) : file.isError ? (
          <p className="text-sm text-danger">Unable to load this document.</p>
        ) : isPdf && !pdfFailed ? (
          <canvas ref={canvasRef} className="mx-auto max-w-full rounded-lg bg-white shadow-sm" />
        ) : url && isPdf ? (
          <iframe title={fileName ?? "Invoice PDF"} src={url} className="h-[70vh] w-full rounded-xl bg-white" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={fileName ?? "Invoice"}
            className="mx-auto max-w-full origin-center rounded-xl object-contain"
            style={{ transform: `scale(${viewer.scale}) rotate(${viewer.rotation}deg)` }}
          />
        ) : (
          <p className="text-sm text-ink-muted">No preview available.</p>
        )}
      </div>
    </section>
  );
}
