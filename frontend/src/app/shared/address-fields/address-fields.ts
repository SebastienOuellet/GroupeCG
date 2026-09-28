import { Component, OnInit, model } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ServiceAddress } from "../../core/models/domain.model";
import { DRIVEWAY_SURFACE_OPTIONS, DrivewaySurface } from "../../core/models/driveway-surface";
import { DRIVEWAY_SIZE_OPTIONS, DrivewaySize } from "../../core/models/driveway-size";
import { ResolvedAddress } from "../../core/services/google-maps.service";
import { AddressAutocomplete } from "../address-autocomplete/address-autocomplete";
import { StreetView } from "../street-view/street-view";

type AddressField = "CivicNumber" | "Street" | "City" | "PostalCode" | "Notes";

/** Champs qui situent l'adresse : les modifier invalide les coordonnées Google. */
const LOCATION_FIELDS: AddressField[] = ["CivicNumber", "Street"];

/**
 * Champs d'une adresse de service (recherche Google, adresse, revêtement, notes, aperçu Street View).
 * Utilisé à la création, à la modification et dans la création rapide. Le parent garde le
 * <form> et les boutons ; ce composant ne fait que modifier `address` (liaison [(address)]).
 */
@Component({
  selector: "app-address-fields",
  imports: [FormsModule, AddressAutocomplete, StreetView],
  templateUrl: "./address-fields.html",
  styleUrl: "./address-fields.scss"
})
export class AddressFields implements OnInit {
  readonly address = model.required<Partial<ServiceAddress>>();

  readonly surfaceOptions = DRIVEWAY_SURFACE_OPTIONS;
  readonly sizeOptions = DRIVEWAY_SIZE_OPTIONS;

  /** Coordonnées à l'ouverture : en modification, pas de Street View tant que l'adresse ne change pas. */
  private initialCoords = "";

  ngOnInit(): void {
    this.initialCoords = this.coordsKey();
  }

  private coordsKey(): string {
    const a = this.address();
    return a.Latitude != null && a.Longitude != null ? `${Number(a.Latitude)},${Number(a.Longitude)}` : "";
  }

  applyResolved(resolved: ResolvedAddress): void {
    this.address.update((a) => ({ ...a, ...resolved }));
  }

  setField(field: AddressField, value: string): void {
    this.address.update((a) => {
      const next: Partial<ServiceAddress> = { ...a, [field]: value };
      if (LOCATION_FIELDS.includes(field) && a.Latitude != null) {
        next.Latitude = null;
        next.Longitude = null;
        next.PlaceId = null;
      }
      return next;
    });
  }

  /** Recliquer sur le revêtement choisi le retire (non précisé). */
  toggleSurface(surface: DrivewaySurface): void {
    this.address.update((a) => ({ ...a, DrivewaySurface: a.DrivewaySurface === surface ? null : surface }));
  }

  /** Recliquer sur la taille choisie la retire (non précisée = simple). */
  toggleSize(size: DrivewaySize): void {
    this.address.update((a) => ({ ...a, DrivewaySize: a.DrivewaySize === size ? null : size }));
  }

  /** Aperçu seulement pour une adresse nouvellement choisie : chaque chargement Street View est facturé. */
  get showPreview(): boolean {
    const key = this.coordsKey();
    return key !== "" && key !== this.initialCoords;
  }
}
