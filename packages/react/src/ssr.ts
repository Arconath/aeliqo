/** Opt-in React SSR and client hydration setup. Import before React and Aeliqo bindings. */
import "@lit-labs/ssr-react/enable-lit-ssr.js";
import {registerAeliqoElements} from "@aeliqo/sdk-web/register";
registerAeliqoElements();
