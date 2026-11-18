import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default [
  {
    ignores: [
      "**/dist/**",
      "**/src/generated/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
  { files: ["**/*.{js,mjs}"], rules: eslint.configs.recommended.rules },
  {
    files: ["apps/web/src/**/*.tsx"],
    plugins: { "react-hooks": hooks },
    rules: hooks.configs.recommended.rules,
  },
];
