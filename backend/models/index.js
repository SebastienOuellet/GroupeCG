import path from "node:path";
import { DataTypes, Sequelize } from "sequelize";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import sequelizeConfig from "../config/config.js";
import { NodeEnv } from "../src/enum/NodeEnv.js";

const require = createRequire(import.meta.url);
const glob = require("glob");

const env = process.env.NODE_ENV || NodeEnv.DEVELOPMENT;
const config = sequelizeConfig[env];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelizeInstance = new Sequelize(config);

const db = {};

// Chaque feature vit dans src/components/<feature>/ et expose son *.model.js
const componentDirs = glob.sync("*", {
  cwd: path.resolve(__dirname, "../src/components"),
  onlyDirectories: true
});

for (const componentDir of componentDirs) {
  const componentModels = glob.sync("*.model.js", {
    cwd: path.resolve(__dirname, "../src/components", componentDir)
  });

  for (const modelFile of componentModels) {
    const modelPath = pathToFileURL(
      path.resolve(__dirname, "../src/components", componentDir, modelFile)
    ).href;
    const modelDefiner = await import(modelPath);
    const model = modelDefiner.default(sequelizeInstance, DataTypes);
    db[model.name] = model;
  }
}

for (const modelName of Object.keys(db)) {
  if (typeof db[modelName].associate === "function") {
    db[modelName].associate(db);
  }
}

db.sequelize = sequelizeInstance;
db.Sequelize = Sequelize;

export default db;
