// Vite raw imports: `import html from "../fixtures/cocoa.html?raw"` gives
// the fixture file's contents as a string, so tests stay fully offline.
// The same applies to the hand-written SSE fixture lines (*.txt?raw,
// used by tests/sse.test.ts).
declare module "*.html?raw" {
  const content: string;
  export default content;
}
declare module "*.txt?raw" {
  const content: string;
  export default content;
}
