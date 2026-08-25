import { defaultConfig } from "./default.js";

/**
 * Accès centralisé et unique (singleton) à la configuration de l'application.
 * Toute nouvelle valeur d'environnement doit être ajoutée dans `default.js`.
 */
export class ConfigService {
  constructor() {
    if (ConfigService.instance) {
      return ConfigService.instance;
    }

    this.configs = { ...defaultConfig };

    ConfigService.instance = this;
  }

  get(key) {
    return this.configs[key];
  }

  getAll() {
    return this.configs;
  }

  set(key, value) {
    return (this.configs[key] = this.parseValue(value));
  }

  parseValue(value) {
    if (typeof value !== "string") return value;

    if (value === "true") return true;
    if (value === "false") return false;

    if (!isNaN(value) && value.trim() !== "") return Number(value);

    return value;
  }
}
