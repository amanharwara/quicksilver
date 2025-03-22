export const disabledGlobally = storage.defineItem<boolean>(
  "local:disabledGlobally",
  { fallback: false, version: 1 }
);
