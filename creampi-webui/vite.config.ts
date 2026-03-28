import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		svelte(),
		tailwindcss(),
	],
	resolve: {
		dedupe: [
			"lit",
			"lit-html",
			"lit-element",
			"@lit/reactive-element",
		],
	},
	optimizeDeps: {
		include: [
			"lit",
			"lit-html",
			"lit-element",
			"@lit/reactive-element",
			"@mariozechner/pi-web-ui",
			"@mariozechner/mini-lit",
		],
	},
});
