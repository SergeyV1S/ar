import { ESLint } from "eslint";
import type { Linter } from "eslint";

import config from "../eslint.config.ts";

const eslint = new ESLint({
  // Node loads the TypeScript config directly. ESLint 9's config loader requires jiti.
  overrideConfigFile: true,
  // Both types describe flat configs. Ours uses no ECMAScript version newer than ESLint 9 supports.
  overrideConfig: config as Linter.Config[]
});
const results = await eslint.lintFiles(["."]);
const formatter = await eslint.loadFormatter("stylish");
const report = await formatter.format(results);

if (report) process.stdout.write(report);
if (results.some(({ errorCount }) => errorCount > 0)) process.exitCode = 1;
