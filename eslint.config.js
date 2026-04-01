import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [
    "dist", 
    "coverage/**", 
    "**/*.{png,jpg,jpeg,gif,ico,svg,mp3,wav,pdf,zip,exe,lockb,lock,map}", 
    "node_modules/**", 
    "*.lockb", 
    "*.lock",
    "supabase/.temp/**",
    "supabase/.branches/**",
    "supabase/migrations_backup/**",
    "**/*.npmrc",
    "**/_current_branch",
    "**/cli-latest",
    "**/gotrue-version",
    "**/pooler-url",
    "**/postgres-version",
    "**/project-ref",
    "**/rest-version",
    "**/storage-version"
  ] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  }
);
