import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

/** Onglets de la section Paramètres. */
@Component({
  selector: "app-settings-tabs",
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="settings-tabs" aria-label="Sections des paramètres">
      <a routerLink="/parametres" routerLinkActive="settings-tabs__tab--active" [routerLinkActiveOptions]="{ exact: true }" class="settings-tabs__tab">Utilisateurs</a>
      <a routerLink="/parametres/contrat" routerLinkActive="settings-tabs__tab--active" class="settings-tabs__tab">Contrat</a>
      <a routerLink="/parametres/routes" routerLinkActive="settings-tabs__tab--active" class="settings-tabs__tab">Routes</a>
    </nav>
  `,
  styles: `
    .settings-tabs {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 1.25rem;
      border-bottom: 2px solid #e3e6ea;
    }
    .settings-tabs__tab {
      padding: 0.625rem 1rem;
      margin-bottom: -2px;
      border-bottom: 2px solid transparent;
      color: #5a646e;
      font-weight: 600;
      font-size: 0.9375rem;
      text-decoration: none;
    }
    .settings-tabs__tab:hover { color: var(--color-primary); }
    .settings-tabs__tab--active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
    @media (max-width: 720px) {
      .settings-tabs__tab { flex: 1; text-align: center; min-height: 44px; display: flex; align-items: center; justify-content: center; }
    }
  `
})
export class SettingsTabs {}
