import cors from "cors";
import express from "express";
import helmet from "helmet";
import { logger } from "../../config/logger.js";
import db from "../../../models/index.js";

export const setupExpressServer = (app) => {
  app.use(helmet());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());
};

export const setupExpressListeners = (app, config) => {
  const server = app.listen(config.PORT, onServerStart(config));
  setupProcessListeners(server);
};

const onServerStart = (config) => () => {
  logger.info(`Server started on port ${config.PORT}`);
  initSequelizeORM();
};

const initSequelizeORM = async () => {
  const { sequelize } = db;

  if (!sequelize) {
    throw new Error("L'instance Sequelize est indéfinie dans db.");
  }

  try {
    await sequelize.authenticate();
    logger.info("Connection to the database has been established successfully.");
    logger.debug(`Available models: ${Object.keys(sequelize.models).join(", ")}`);
  } catch (error) {
    logger.error(`Unable to connect to the database: ${error.message}`);
  }
};

const setupProcessListeners = (server) => {
  process.on("uncaughtException", (error) => {
    logger.error(`uncaughtException: ${error}`);
  });

  process.on("unhandledRejection", (error) => {
    logger.error(`unhandledRejection: ${error}`);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM signal received.");
    shutDown(0, server);
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT signal received.");
    shutDown(0, server);
  });
};

const shutDown = (exitCode, server) => {
  logger.info("Shutting down server...");
  server.close((error) => {
    if (error) {
      logger.error(error);
      process.exit(1);
    }
    process.exit(exitCode);
  });
};
