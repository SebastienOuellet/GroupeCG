import { Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ApiService } from "../../../core/api.service";

type PageState = "loading" | "confirm" | "done" | "invalid";

@Component({
  selector: "app-unsubscribe-page",
  imports: [],
  templateUrl: "./unsubscribe-page.html",
  styleUrl: "./unsubscribe-page.scss"
})
export class UnsubscribePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly state = signal<PageState>("loading");
  readonly email = signal<string>("");

  private token = "";

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const email = params.get("e") || "";
    this.token = params.get("t") || "";
    this.email.set(email);

    if (!email || !this.token) {
      this.state.set("invalid");
      return;
    }

    try {
      await this.api.get(`unsubscribe?e=${encodeURIComponent(email)}&t=${this.token}`);
      this.state.set("confirm");
    } catch {
      this.state.set("invalid");
    }
  }

  async confirm(): Promise<void> {
    try {
      await this.api.post("unsubscribe/confirm", { email: this.email(), token: this.token });
      this.state.set("done");
    } catch {
      this.state.set("invalid");
    }
  }
}
