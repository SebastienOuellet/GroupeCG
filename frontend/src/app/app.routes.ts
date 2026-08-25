import { Routes } from "@angular/router";
import { authGuard, guestGuard } from "./core/auth/auth.guard";

export const routes: Routes = [
  {
    path: "login",
    canMatch: [guestGuard],
    loadComponent: () => import("./pages/login/login").then((m) => m.Login)
  },
  {
    path: "",
    canMatch: [authGuard],
    loadComponent: () => import("./pages/dashboard/dashboard").then((m) => m.Dashboard)
  }
];
