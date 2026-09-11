/// <reference types="vite/client" />

declare module '@aeliqo/catalog-examples' {
  export const CATALOG_EXAMPLE_IDS: readonly string[];
  export function catalogExample(id:string, container:HTMLElement): () => void;
}
