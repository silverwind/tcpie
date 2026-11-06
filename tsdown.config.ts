import {nodeCli, nodeLib} from "tsdown-config-silverwind";
import {defineConfig} from "tsdown";

export default defineConfig([
  nodeLib({
    url: import.meta.url,
    entry: "index.ts",
    minify: true,
  }),
  nodeCli({
    url: import.meta.url,
    entry: "tcpie.ts",
    sourcemap: false,
  }),
]);
