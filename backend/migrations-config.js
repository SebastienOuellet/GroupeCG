import sequelizeConfig from "./config/config.js";
import { NodeEnv } from "./src/enum/NodeEnv.js";

const env = process.env.NODE_ENV || NodeEnv.DEVELOPMENT;
const config = sequelizeConfig[env];

export default {
  groupecg: {
    username: config.username,
    password: config.password,
    database: config.database,
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    dialectOptions: config.dialectOptions
  }
};
