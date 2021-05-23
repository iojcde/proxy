module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: ["node_modules/*", "build/*"],
  extends: ["eslint:recommended"],
  overrides: [
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: "@typescript-eslint/parser",
      env: {
        browser: false,
        node: true,
        es6: true,
      },
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended", // TypeScript rules
        "plugin:prettier/recommended", // Prettier recommended rules
      ],
      rules: {

        "@typescript-eslint/no-unused-vars": ["error"],
        "@typescript-eslint/explicit-function-return-type": [
          // I suggest this setting for requiring return types on functions only where usefull
          "warn",
          {
            allowExpressions: true,
            allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          },
        ],
        "prettier/prettier": ["error", {}, { usePrettierrc: true }], // Includes .prettierrc.js rules
      },
    },
  ],
}
