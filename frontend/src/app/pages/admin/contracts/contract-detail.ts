import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ContractService } from "../../../core/services/contract.service";
import { RouteService } from "../../../core/services/route.service";
import { Contract, RouteModel } from "../../../core/models/domain.model";

@Component({
  selector: "app-contract-detail",
  imports: [FormsModule, RouterLink],
  templateUrl: "./contract-detail.html"
})
export class ContractDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly contractService = inject(ContractService);
  private readonly routeService = inject(RouteService);

  readonly contract = signal<Contract | null>(null);
  readonly routes = signal<RouteModel[]>([]);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  form: Partial<Contract> = {};

  private contractId!: number;

  async ngOnInit(): Promise<void> {
    this.contractId = Number(this.route.snapshot.paramMap.get("id"));
    try {
      const [contract, routes] = await Promise.all([
        this.contractService.getContract(this.contractId),
        this.routeService.getRoutes()
      ]);
      this.contract.set(contract);
      this.routes.set(routes);
      this.form = { ...contract };
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.contractService.updateContract(this.contractId, {
        RouteId: this.form.RouteId ? Number(this.form.RouteId) : null,
        StartDate: this.form.StartDate,
        EndDate: this.form.EndDate,
        Price: this.form.Price,
        Status: this.form.Status,
        Notes: this.form.Notes
      });
      this.contract.set(await this.contractService.getContract(this.contractId));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
