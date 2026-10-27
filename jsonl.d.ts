// Turbopack's "text" rule in next.config.ts exports a .jsonl file as a string.
declare module "*.jsonl" {
  const content: string;
  export default content;
}
