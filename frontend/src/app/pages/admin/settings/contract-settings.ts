import { Component, inject, OnInit, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SettingService } from "../../../core/services/setting.service";
import { ContractTerms } from "../../../core/models/setting.model";
import { SettingsTabs } from "./settings-tabs/settings-tabs";
import { PdfDialog } from "../../../shared/pdf-dialog/pdf-dialog";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Valeurs saisonnières imprimées dans les conditions du contrat PDF. */
@Component({
  selector: "app-contract-settings",
  imports: [FormsModule, SettingsTabs, PdfDialog],
  templateUrl: "./contract-settings.html"
})
export class ContractSettings implements OnInit {
  private readonly settingService = inject(SettingService);

  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly saving = signal(false);
  readonly loaded = signal(false);
  readonly updatedAt = signal<string | null>(null);
  /** Aperçu d'un contrat fictif avec les valeurs du formulaire (null = en chargement). */
  readonly previewPdf = signal<Blob | null>(null);
  private readonly previewDialog = viewChild<PdfDialog>("previewDialog");

  readonly months = MONTHS.map((label, index) => ({ value: index + 1, label }));
  readonly days = Array.from({ length: 31 }, (_, index) => index + 1);

  form = {} as ContractTerms;
  private defaults = {} as ContractTerms;

  async ngOnInit(): Promise<void> {
    try {
      const response = await this.settingService.getContractTerms();
      this.form = { ...response.values };
      this.defaults = response.defaults;
      this.updatedAt.set(response.updatedAt);
      this.loaded.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  deadlineLabel(): string {
    return `${this.form.signatureDeadlineDay === 1 ? "1er" : this.form.signatureDeadlineDay} ${MONTHS[this.form.signatureDeadlineMonth - 1] ?? ""}`;
  }

  /** Valeurs du formulaire telles quelles, même non enregistrées : on voit avant de sauvegarder. */
  async preview(): Promise<void> {
    this.error.set(null);
    this.previewPdf.set(null);
    this.previewDialog()?.open();
    try {
      this.previewPdf.set(await this.settingService.previewContractTerms(this.form));
    } catch (e) {
      this.previewDialog()?.close();
      this.error.set((e as Error).message);
    }
  }

  downloadPreview(): void {
    const pdf = this.previewPdf();
    if (!pdf) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(pdf);
    link.download = "Contrat-exemple.pdf";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  restoreDefaults(): void {
    this.form = { ...this.defaults };
    this.info.set("Valeurs du contrat papier 2025-2026 rétablies dans le formulaire. Enregistrez pour les appliquer.");
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const response = await this.settingService.updateContractTerms(this.form);
      this.form = { ...response.values };
      this.updatedAt.set(response.updatedAt);
      this.info.set("Conditions enregistrées. Les prochains contrats générés utiliseront ces valeurs.");
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
