// Vite raw imports: `import html from "../fixtures/cocoa.html?raw"` gives
// the fixture file's contents as a string, so tests stay fully offline.
declare module "*.html?raw" {
  const content: string;
  export default content;
}
