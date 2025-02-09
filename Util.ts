export function log(type: "info" | "error", ...args: any[]) {
  if (!import.meta.env.DEV) {
    return;
  }
  console.group("quicksilver");
  const logFn = type === "info" ? console.log : console.error;
  logFn(...args);
  console.groupEnd();
}
