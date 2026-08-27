import { healthController } from "../components/health/health.controller.js";
import { userController } from "../components/user/user.controller.js";
import { clientController } from "../components/client/client.controller.js";
import { serviceAddressController } from "../components/serviceAddress/serviceAddress.controller.js";
import { routeController } from "../components/route/route.controller.js";
import { contractController } from "../components/contract/contract.controller.js";
import { tenantController } from "../components/tenant/tenant.controller.js";
import { templateController } from "../components/template/template.controller.js";
import { notificationController } from "../components/notification/notification.controller.js";
import { consentController } from "../components/consent/consent.controller.js";
import { webhookController } from "../components/webhook/webhook.controller.js";
import { unsubscribeController } from "../components/unsubscribe/unsubscribe.controller.js";
import { portalController } from "../components/portal/portal.controller.js";
import { invoiceController } from "../components/invoice/invoice.controller.js";

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
      ...consentController.routes.map(this.addAPIUrl("/consent")),
      ...contractController.routes.map(this.addAPIUrl("/contract")),
      ...healthController.routes.map(this.addAPIUrl("/health")),
      ...invoiceController.routes.map(this.addAPIUrl("/invoice")),
      ...notificationController.routes.map(this.addAPIUrl("/notification")),
      ...portalController.routes.map(this.addAPIUrl("/portal")),
      ...routeController.routes.map(this.addAPIUrl("/route")),
      ...serviceAddressController.routes.map(this.addAPIUrl("/service-address")),
      ...tenantController.routes.map(this.addAPIUrl("/tenant")),
      ...templateController.routes.map(this.addAPIUrl("/template")),
      ...unsubscribeController.routes.map(this.addAPIUrl("/unsubscribe")),
      ...userController.routes.map(this.addAPIUrl("/user")),
      ...webhookController.routes.map(this.addAPIUrl("/webhook"))
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
