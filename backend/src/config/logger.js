import winston from "winston";
import "winston-daily-rotate-file";
import { formatInTimeZone } from "date-fns-tz";
import { ConfigService } from "./configService.js";

const configService = new ConfigService();

const { combine, colorize, printf, timestamp } = winston.format;

const estTimestamp = timestamp({
  format: () => formatInTimeZone(new Date(), "America/New_York", "yyyy-MM-dd HH:mm:ssXXX")
});

const readableFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const errorFileTransport = new winston.transports.DailyRotateFile({
  dirname: "./logs/errors",
  filename: "error-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxFiles: "14d",
  format: combine(estTimestamp, winston.format.json())
});

const infoFileTransport = new winston.transports.DailyRotateFile({
  dirname: "./logs/info",
  filename: "info-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  level: "info",
  maxFiles: "14d",
  format: combine(estTimestamp, winston.format.json())
});

const consoleTransport = new winston.transports.Console({
  format: combine(colorize({ all: true }), estTimestamp, readableFormat)
});

export const logger = winston.createLogger({
  level: configService.get("LOG_LEVEL"),
  format: combine(estTimestamp, winston.format.json()),
  transports: [errorFileTransport, infoFileTransport, consoleTransport]
});
