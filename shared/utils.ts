export function isAnchorElement(x: unknown): x is HTMLAnchorElement {
  return x instanceof HTMLAnchorElement;
}

export function isModifierKey(key: string) {
  return (
    key === "Control" || key === "Shift" || key === "Alt" || key === "Meta"
  );
}

export function isEscapeKey(key: string) {
  return key === "Escape";
}

export function rem(n: number) {
  return `${n * 16}px`;
}
