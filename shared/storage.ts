export const disabledGlobally = storage.defineItem<boolean>(
  "local:disabledGlobally",
  { fallback: false, version: 1 },
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
  { fallback: [], version: 1 },
);

export type ConfigV1 = {
  interactiveElementsSelector: string;
};
export type ConfigV2 = {
  interactiveElementsSelector: string;
  autoLowerVolume: boolean;
  volumeToLowerTo: number;
};

export const DefaultInteractiveElementsSelector = `:is(a,button,input,label,[role^="menuitem"],[role="button"],[role="treeitem"],[role="radio"],[role="tab"],select):not(:disabled,[aria-disabled="true"],details)`;

export const DefaultConfig = {
  interactiveElementsSelector: DefaultInteractiveElementsSelector,
  autoLowerVolume: true,
  volumeToLowerTo: 0.5,
};

export const storedConfig = storage.defineItem<ConfigV2>("local:config", {
  fallback: DefaultConfig,
  version: 2,
  migrations: {
    2: (configv1: ConfigV1): ConfigV2 => {
      return {
        ...configv1,
        autoLowerVolume: false,
        volumeToLowerTo: 0.5,
      };
    },
  },
});
