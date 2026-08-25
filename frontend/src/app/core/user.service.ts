import { inject, Injectable } from "@angular/core";
import { ApiService } from "./api.service";
import { User } from "./models/user.model";

@Injectable({
  providedIn: "root"
})
export class UserService {
  private readonly api = inject(ApiService);

  getMe(): Promise<User> {
    return this.api.get<User>("user/me");
  }
}
