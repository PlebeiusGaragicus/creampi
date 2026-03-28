<script lang="ts">
	import Router from "svelte-spa-router";
	import Login from "./routes/Login.svelte";
	import Chat from "./routes/Chat.svelte";
	import Admin from "./routes/Admin.svelte";

	const routes = {
		"/": Chat,
		"/login": Login,
		"/chat": Chat,
		"/admin": Admin,
	};
</script>

<Router {routes} />
