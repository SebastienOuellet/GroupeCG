import { Component, ElementRef, effect, input, signal, viewChild } from "@angular/core";

/**
 * Affiche un PDF page par page dans des <canvas> (pdf.js). Contrairement à un
 * <iframe>, ça fonctionne aussi sur téléphone (iOS/Android n'affichent pas un
 * PDF intégré). pdf.js est chargé à la demande : seulement quand un aperçu s'ouvre.
 */
@Component({
  selector: "app-pdf-preview",
  template: `
    @if (status() === "loading") {
      <p class="pdf-preview__state">Préparation de l'aperçu...</p>
    } @else if (status() === "error") {
      <p class="pdf-preview__state pdf-preview__state--error">Aperçu impossible. Le téléchargement reste disponible.</p>
    }
    <div #pages class="pdf-preview__pages"></div>
  `,
  styles: `
    :host { display: block; }
    .pdf-preview__pages { display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .pdf-preview__pages ::ng-deep canvas { width: 100%; max-width: 820px; height: auto; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
    .pdf-preview__state { text-align: center; color: #7a8591; padding: 2rem 1rem; margin: 0; }
    .pdf-preview__state--error { color: #a13224; }
  `
})
export class PdfPreview {
  /** null = en cours de chargement côté parent. */
  readonly pdf = input<Blob | null>(null);
  readonly status = signal<"loading" | "ready" | "error">("loading");

  private readonly pages = viewChild.required<ElementRef<HTMLDivElement>>("pages");
  private renderId = 0;

  constructor() {
    effect(() => {
      const blob = this.pdf();
      void this.render(blob);
    });
  }

  private async render(blob: Blob | null): Promise<void> {
    const id = ++this.renderId;
    const container = this.pages().nativeElement;
    container.replaceChildren();
    if (!blob) {
      this.status.set("loading");
      return;
    }
    try {
      // Build « legacy » : polyfills inclus (le build standard exige des API JS très récentes,
      // ex. Map.getOrInsertComputed, absentes de bien des téléphones).
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      // Worker copié tel quel dans le build (angular.json → assets « pdfjs/ »)
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs/pdf.worker.min.mjs", document.baseURI).toString();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const cssWidth = Math.min(container.clientWidth || 820, 820);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      for (let n = 1; n <= pdf.numPages; n++) {
        if (id !== this.renderId) return; // un rendu plus récent a pris le relais
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: (cssWidth / page.getViewport({ scale: 1 }).width) * pixelRatio });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
      }
      if (id === this.renderId) this.status.set("ready");
    } catch (error) {
      console.error("Aperçu PDF impossible", error);
      if (id === this.renderId) this.status.set("error");
    }
  }
}
