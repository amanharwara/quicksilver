export function isHTMLElement(x: unknown): x is HTMLElement {
  return x instanceof HTMLElement;
}

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

/**
 * like the normal querySelectorAll, but can also recursively query inside
 * any open shadow roots
 *
 * unfortunately this is relatively quite a bit slower than a regular
 * document.querySelectorAll but is necessary since there is no native way
 * in the browser to do this.
 *
 * adapted from https://gist.github.com/Haprog/848fc451c25da00b540e6d34c301e96a
 * changes:
 * . uses regular for-loop instead of forEach
 * . uses tree walker instead of * selector
 */
export function deepQuerySelectorAll(selector: string, root: any = document) {
  const results: HTMLElement[] = Array.from(root.querySelectorAll(selector));
  function pushNestedResults(root: any) {
    const nestedResults = deepQuerySelectorAll(selector, root);
    for (let i = 0; i < nestedResults.length; i++) {
      const elem = nestedResults[i];
      results.push(elem);
    }
  }
  if (root.shadowRoot) {
    pushNestedResults(root.shadowRoot);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  let elem: any = walker.nextNode();
  while (elem) {
    if (elem.shadowRoot) {
      pushNestedResults(elem.shadowRoot);
    }
    elem = walker.nextNode();
  }
  return results;
}

export function getTopLevelParent(el: Element) {
  let parent: HTMLElement | null | undefined = el.parentElement;
  if (!parent) return;
  let level = 0;
  while (parent?.parentElement != document.body) {
    if (level > 5) break;
    level += 1;
    parent = parent?.parentElement;
  }
  return parent;
}
