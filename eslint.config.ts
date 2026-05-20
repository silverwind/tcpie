import silverwind from "eslint-config-silverwind";
import {defineConfig} from "eslint/config";

export default defineConfig(...silverwind, {
  rules: {
    "import-x/extensions": "off",
  },
});
