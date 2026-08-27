import { Routes } from "./routes/Routes.js";
import { Server } from "./server/Server.js";
import { ConfigService } from "./config/configService.js";
import { notificationWorker } from "./notifications/NotificationWorker.js";
import { registerCronJobs } from "./cron/cronJobs.js";

const configService = new ConfigService();
const config = configService.getAll();

const server = new Server(config);
const routes = new Routes(server);

server.setRoutes(routes.routes());
server.setHandleErrors();

notificationWorker.start();
registerCronJobs();
