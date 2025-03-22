let loggingEnabled = !import.meta.env.PROD;

export function info(...args: any[]) {
  if (!loggingEnabled) {
    return;
  }
  console.log(
    "%cquicksilver:",
    "background:cornflowerblue;color:black;font-weight:600;padding:2px;",
    ...args
  );
}

export function warn(...args: any[]) {
  if (!loggingEnabled) {
    return;
  }
  console.log(
    "%cquicksilver:",
    "background:yellow;color:black;font-weight:600;padding:2px;",
    ...args
  );
}

export function error(...args: any[]) {
  if (!loggingEnabled) {
    return;
  }
  console.log(
    "%cquicksilver:",
    "background:red;color:black;font-weight:600;padding:2px;",
    ...args
  );
}

export function enableLogging() {
  loggingEnabled = true;
}

export function disableLogging() {
  loggingEnabled = false;
}
