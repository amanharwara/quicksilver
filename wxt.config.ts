import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ browser }) => {
    const permissions: string[] = [
      "tabs",
      "clipboardWrite",
      "storage",
      "search",
    ];
    if (browser === "firefox") {
      permissions.push("contextualIdentities", "cookies");
    }
    return {
      permissions,
      host_permissions: ["http://*/*", "https://*/*"],
      browser_specific_settings:
        browser === "firefox"
          ? {
              gecko: {
                id: "{22df968b-e226-4160-8f4f-f0033429aebb}",
              },
            }
          : undefined,
    };
  },
  modules: ["@wxt-dev/module-solid"],
  webExt: {
    startUrls: ["https://en.wikipedia.org"],
    // startUrls: ["http://localhost:5500"],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
