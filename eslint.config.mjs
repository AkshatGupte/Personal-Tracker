import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Preserved, not shipped. Nothing imports it and it is excluded from
      // tsconfig too — see archive/README.md.
      "archive/**",
      // Screenshot tooling, not application code. Plain ESM run by hand with
      // node — see qa/README.md.
      "qa/**",
    ],
  },
];

export default eslintConfig;
