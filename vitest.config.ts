import { defineConfig } from "vitest/config";

// happy-dom provides DOMParser, which parseEntry (src/content/parser.ts)
// needs for the Oxford HTML fixture tests. The pure tests (background,
// ai-parse) are unaffected by the environment choice.
export default defineConfig({
  test: {
    environment: "happy-dom",
  },
});
