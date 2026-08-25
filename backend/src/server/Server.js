import express from "express";
import { InternalServerError, NotFoundError } from "../errors/Errors.js";
import { asyncMiddleware } from "../middlewares/asyncMiddleware.js";
import { requiredUserAuthenticated } from "../middlewares/requiredUserAuthenticated.js";
import { setupExpressListeners, setupExpressServer } from "./express/expressServer.js";
import { logger } from "../config/logger.js";

export class Server {
  /**
   * @param {Object} config - Configuration de l'application (voir ConfigService).
   * @throws {InternalServerError} Si aucune config n'est fournie.
   */
  constructor(config) {
    if (!config) {
      throw new InternalServerError("No config passed to Server constructor");
    }
    this.config = config;
    this.app = express();
    this.router = null;

    setupExpressServer(this.app);
    setupExpressListeners(this.app, this.config);
  }

  /**
   * @param {Array<{method: string, url: string, middleware?: Function[], authRequired?: boolean}>} routes
   * @throws {InternalServerError} Si les routes sont déjà définies.
   */
  setRoutes(routes) {
    if (this.router) {
      throw new InternalServerError("Routes already set");
    }
    this.router = express.Router();

    for (const { method, url, middleware = [], authRequired = true } of routes) {
      const asyncMiddlewares = [];
      if (authRequired) {
        asyncMiddlewares.push(asyncMiddleware(requiredUserAuthenticated));
      }
      asyncMiddlewares.push(...middleware.map(asyncMiddleware));
      this.router[method.toLowerCase()](url, ...asyncMiddlewares);
    }

    this.app.use(this.router);
  }

  setHandleErrors() {
    this.app.use((req, res, next) => next(new NotFoundError()));

    // eslint-disable-next-line no-unused-vars
    this.app.use((error, req, res, next) => {
      logger.error(`${error.message} - ${error.stack}`);
      const statusCode = error.status || 500;
      return res.status(statusCode).json({
        error: {
          message: error.message,
          status: statusCode
        }
      });
    });
  }
}
