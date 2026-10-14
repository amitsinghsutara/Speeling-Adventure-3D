import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Three Fiber elements (<mesh>, <group>, ...) take Three.js props
    // such as `args`, `attach`, `position` that the React plugin does not know.
    files: ["src/game/**/*.tsx"],
    rules: {
      "react/no-unknown-property": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "spelling-adventure-3d-speckit/**",
  ]),
]);

export default eslintConfig;
