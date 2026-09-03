import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Batas backend/frontend: UI tidak boleh mengimpor backend/. Akses data lewat HTTP.
    files: ["app/**", "components/**", "lib/**"],
    ignores: ["app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/backend/*", "@/backend", "**/backend/*"],
              message:
                "Frontend tidak boleh mengimpor backend/. Akses data lewat fetch ke app/api/.",
            },
          ],
        },
      ],
    },
  },
  {
    // Sebaliknya: backend/ murni, tanpa React.
    files: ["backend/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "next/*", "@/components/*", "@/lib/*"],
              message: "backend/ tidak boleh bergantung pada React atau kode frontend." },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
