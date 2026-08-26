import globals from "globals";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      "indent": ["error", 2],
      "semi": ["error", "always"],
      "quotes": ["error", "double"],
      "no-unused-vars": ["warn", { "ignoreRestSiblings": true }],
      "no-console": "warn"
    }
  },
  prettier
];
