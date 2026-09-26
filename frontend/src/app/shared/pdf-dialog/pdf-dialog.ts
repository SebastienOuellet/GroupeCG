import { Component, ElementRef, input, output, signal, viewChild } from "@angular/core";
import { PdfPreview } from "../pdf-preview/pdf-preview";

/**
 * Dialogue plein écran (mobile) / centré (ordi) qui affiche un PDF.
 * Contenu projeté :
 *  - [pdfDialogSubtitle] : ligne sous le titre (ex. destinataire)
 *  - [pdfDialogActions]  : boutons du pied, à droite de « Fermer »
 * Le parent appelle open() / close() et fournit le PDF via [pdf] (null = chargement).
 */
@Component({
  selector: "app-pdf-dialog",
  imports: [PdfPreview],
  templateUrl: "./pdf-dialog.html",
  styleUrl: "./pdf-dialog.scss"
})
export class PdfDialog {
  readonly heading = input.required<string>();
  readonly pdf = input<Blob | null>(null);
  readonly closed = output<void>();

  readonly isOpen = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

  open(): void {
    this.isOpen.set(true);
    this.dialog().nativeElement.showModal();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  /** Échap, bouton × ou « Fermer » : tout passe par l'événement natif close. */
  onClose(): void {
    this.isOpen.set(false);
    this.closed.emit();
  }
}
