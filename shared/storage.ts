export const disabledGlobally = storage.defineItem<boolean>(
  "local:disabledGlobally",
  { fallback: false, version: 1 }
);

type IgnoredWebsiteV1 = {
  id: string;
  type: "exact" | "prefix" | "domain" | "regexp";
  value: string;
  enabled: boolean;
};

export type Blocklist = IgnoredWebsiteV1[];

export const storedBlocklist = storage.defineItem<Blocklist>(
  "local:ignoredWebsites",
  { fallback: [], version: 1 }
);

export type ConfigV1 = {
  interactiveElementsSelector: string;
};

export const storedConfig = storage.defineItem<ConfigV1>("local:config", {
  fallback: {
    interactiveElementsSelector: "",
  },
  version: 1,
});
