import { Routes } from "@angular/router";
import { authGuard, guestGuard } from "./core/auth/auth.guard";
import { roleGuard } from "./core/auth/role.guard";

export const routes: Routes = [
  {
    path: "login",
    canMatch: [guestGuard],
    loadComponent: () => import("./pages/login/login").then((m) => m.Login)
  },
  {
    path: "",
    canMatch: [authGuard, roleGuard("admin")],
    loadComponent: () => import("./pages/admin/admin-shell/admin-shell").then((m) => m.AdminShell),
    children: [
      { path: "", pathMatch: "full", redirectTo: "clients" },
      {
        path: "clients",
        loadComponent: () => import("./pages/admin/clients/clients-list").then((m) => m.ClientsList)
      },
      {
        path: "clients/:id",
        loadComponent: () => import("./pages/admin/clients/client-detail").then((m) => m.ClientDetail)
      },
      {
        path: "contrats",
        loadComponent: () => import("./pages/admin/contracts/contracts-list").then((m) => m.ContractsList)
      },
      {
        path: "contrats/:id",
        loadComponent: () => import("./pages/admin/contracts/contract-detail").then((m) => m.ContractDetail)
      },
      {
        path: "routes",
        loadComponent: () => import("./pages/admin/routes/routes-list").then((m) => m.RoutesList)
      }
    ]
  },
  { path: "**", redirectTo: "" }
];
