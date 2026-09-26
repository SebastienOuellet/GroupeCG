import { Component, computed, input, model } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ContractItem } from "../../core/models/domain.model";
import { computeTotals, formatMoney, lineTotal } from "../../core/models/billing";

let nextId = 0;

/**
 * Lignes d'un contrat (description, quantité, prix unitaire) avec aperçu
 * sous-total / TPS / TVQ / total. Les descriptions déjà utilisées sont
 * proposées en autocomplétion (datalist natif : fonctionne aussi sur mobile).
 */
@Component({
  selector: "app-contract-items-editor",
  imports: [FormsModule],
  templateUrl: "./contract-items-editor.html",
  styleUrl: "./contract-items-editor.scss"
})
export class ContractItemsEditor {
  readonly items = model.required<ContractItem[]>();
  readonly suggestions = input<string[]>([]);

  readonly listId = `contract-item-suggestions-${nextId++}`;
  readonly totals = computed(() => computeTotals(this.items()));
  readonly lineTotal = lineTotal;
  readonly formatMoney = formatMoney;

  update(index: number, field: keyof ContractItem, value: unknown): void {
    this.items.update((list) => list.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  add(): void {
    this.items.update((list) => [...list, { Description: "", Quantity: 1, UnitPrice: null }]);
  }

  remove(index: number): void {
    this.items.update((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }
}
