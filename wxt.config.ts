import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ browser }) => {
    const permissions: string[] = ["tabs", "clipboardWrite"];
    if (browser === "firefox") {
      permissions.push("contextualIdentities", "cookies");
    }
    return {
      permissions,
      host_permissions: ["http://*/*", "https://*/*"],
    };
  },
  modules: ["@wxt-dev/module-solid"],
  runner: {
    startUrls: ["https://en.wikipedia.org"],
  },
});
