import { healthController } from "../components/health/health.controller.js";
import { userController } from "../components/user/user.controller.js";
import { clientController } from "../components/client/client.controller.js";
import { serviceAddressController } from "../components/serviceAddress/serviceAddress.controller.js";
import { routeController } from "../components/route/route.controller.js";
import { contractController } from "../components/contract/contract.controller.js";
import { tenantController } from "../components/tenant/tenant.controller.js";

/**
 * Agrège les routes de chaque composant et préfixe chacune par /api/<feature>.
 */
export class Routes {
  constructor(server) {
    this.config = server.config;
  }

  routes() {
    return [
      ...clientController.routes.map(this.addAPIUrl("/client")),
      ...contractController.routes.map(this.addAPIUrl("/contract")),
      ...healthController.routes.map(this.addAPIUrl("/health")),
      ...routeController.routes.map(this.addAPIUrl("/route")),
      ...serviceAddressController.routes.map(this.addAPIUrl("/service-address")),
      ...tenantController.routes.map(this.addAPIUrl("/tenant")),
      ...userController.routes.map(this.addAPIUrl("/user"))
    ];
  }

  addAPIUrl = (apiURL) => (route) => {
    const prefix = "/api";
    const cleanedUrl = route.url?.replace(/^\/api/, "") || "";
    const subUrl = cleanedUrl.startsWith("/") ? cleanedUrl : `/${cleanedUrl}`;
    return {
      ...route,
      url: `${prefix}${apiURL}${subUrl}`
    };
  };
}
