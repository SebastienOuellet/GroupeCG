import { ConfigService } from "../config/configService.js";
import { LocalRouteOptimizer } from "./LocalRouteOptimizer.js";
import { GoogleRouteOptimizer } from "./GoogleRouteOptimizer.js";

const configService = new ConfigService();
let optimizer = null;

/**
 * POINT DE SWAP : pour changer d'optimiseur (ex. VROOM/OSRM auto-hébergé), écrire une
 * classe qui étend RouteOptimizer et la retourner ici.
 * ROUTE_OPTIMIZATION_DRY_RUN=true (défaut) → optimiseur local, aucun appel Google.
 */
export const getRouteOptimizer = () => {
  if (!optimizer) {
    optimizer = configService.get("ROUTE_OPTIMIZATION_DRY_RUN")
      ? new LocalRouteOptimizer()
      : new GoogleRouteOptimizer({
        projectId: configService.get("GOOGLE_CLOUD_PROJECT_ID"),
        credentialFile: configService.get("GOOGLE_ROUTE_OPTIMIZATION_CREDENTIAL_FILE"),
        timeoutSeconds: configService.get("ROUTE_OPTIMIZATION_TIMEOUT_SECONDS"),
        validateOnly: configService.get("ROUTE_OPTIMIZATION_VALIDATE_ONLY")
      });
  }
  return optimizer;
};

/** Tests : remplacer l'optimiseur (ex. faux client Google). */
export const setRouteOptimizer = (instance) => {
  optimizer = instance;
};
