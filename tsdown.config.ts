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
    minify: true,
    sourcemap: false,
    dts: false,
  }),
]);
