/**
 * Small, typed index of the maintained framework recipes.
 *
 * The source paths point at executable fixtures.  Documentation and the public
 * site can use this index to link to those sources instead of maintaining a
 * second set of illustrative snippets.
 */
export interface AeliqoFrameworkRecipe {
  readonly id: "vanilla" | "react" | "vue" | "next-ssr";
  readonly title: string;
  readonly sourcePaths: readonly string[];
  readonly packages: readonly string[];
  readonly proves: readonly string[];
  readonly modelRequired: false;
  readonly studioRequired: false;
}

export const frameworkRecipes: readonly AeliqoFrameworkRecipe[] = [
  {
    id: "vanilla",
    title: "Vanilla web components",
    sourcePaths: ["examples/platform/index.html", "examples/platform/src/main.ts"],
    packages: ["@aeliqo/web"],
    proves: ["properties", "typed custom events", "native forms", "focus"],
    modelRequired: false,
    studioRequired: false,
  },
  {
    id: "react",
    title: "React 19 bindings",
    sourcePaths: ["examples/platform/react.html", "examples/platform/src/react.tsx"],
    packages: ["@aeliqo/react", "@aeliqo/web"],
    proves: ["controlled properties", "typed events", "shared custom elements"],
    modelRequired: false,
    studioRequired: false,
  },
  {
    id: "vue",
    title: "Vue 3 embedding",
    sourcePaths: ["examples/platform/vue.html", "examples/platform/src/vue.ts"],
    packages: ["@aeliqo/web"],
    proves: ["shared custom elements", "typed event bridge", "shared renderer"],
    modelRequired: false,
    studioRequired: false,
  },
  {
    id: "next-ssr",
    title: "Next.js App Router SSR and hydration",
    sourcePaths: [
      "examples/next-platform/app/page.tsx",
      "examples/next-platform/app/hydrate.tsx",
      "examples/next-platform/next.config.mjs",
    ],
    packages: ["@aeliqo/web", "@lit-labs/ssr-client"],
    proves: ["server rendering", "declarative shadow DOM", "client hydration"],
    modelRequired: false,
    studioRequired: false,
  },
] as const;
