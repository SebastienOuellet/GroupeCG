import { Routes } from "@angular/router";
import { authGuard, guestGuard } from "./core/auth/auth.guard";
import { roleGuard } from "./core/auth/role.guard";
import { homeGuard } from "./core/auth/home.guard";
import { portalGuard } from "./core/portal/portal.guard";

export const routes: Routes = [
  {
    path: "login",
    canMatch: [guestGuard],
    loadComponent: () => import("./pages/login/login").then((m) => m.Login)
  },
  {
    path: "desabonnement",
    loadComponent: () => import("./pages/public/unsubscribe/unsubscribe-page").then((m) => m.UnsubscribePage)
  },
  {
    path: "portail",
    loadComponent: () => import("./pages/public/portal/portal-login").then((m) => m.PortalLogin)
  },
  {
    path: "portail/gestion",
    canMatch: [portalGuard],
    loadComponent: () => import("./pages/public/portal/portal-manage").then((m) => m.PortalManage)
  },
  {
    path: "operateur",
    canMatch: [authGuard, roleGuard("admin", "operator")],
    loadComponent: () => import("./pages/operator/my-routes/my-routes").then((m) => m.MyRoutes)
  },
  {
    path: "operateur/route/:id",
    canMatch: [authGuard, roleGuard("admin", "operator")],
    loadComponent: () => import("./pages/operator/route-run/route-run-page").then((m) => m.RouteRunPage)
  },
  {
    path: "",
    canMatch: [authGuard, homeGuard],
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
      },
      {
        path: "modeles",
        loadComponent: () => import("./pages/admin/templates/templates-list").then((m) => m.TemplatesList)
      },
      {
        path: "notifications",
        loadComponent: () => import("./pages/admin/notifications/notifications-page").then((m) => m.NotificationsPage)
      },
      {
        path: "notifications/:id",
        loadComponent: () => import("./pages/admin/notifications/batch-detail").then((m) => m.BatchDetail)
      },
      {
        path: "factures",
        loadComponent: () => import("./pages/admin/invoices/invoices-list").then((m) => m.InvoicesList)
      }
    ]
  },
  { path: "**", redirectTo: "" }
];
