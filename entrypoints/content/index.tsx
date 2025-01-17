import "./styles.scss";

const letters = Array(26)
  .fill(0)
  .map((_, index) => {
    let i = index + 97;
    return String.fromCharCode(i);
  });

function rem(n: number) {
  return `${n * 16}px`;
}

export function* twoCharIDGenerator() {
  for (const letter of letters) {
    const lettersWithoutCurrent = letters.filter((l) => l !== letter);
    let index = 0;
    while (lettersWithoutCurrent.length > 0) {
      const l2 = lettersWithoutCurrent.shift() || index++;
      yield `${letter}${l2}`;
    }
  }
}

function log(...args: any[]) {
  if (!import.meta.env.DEV) {
    return;
  }
  console.group("quicksilver");
  console.log(...args);
  console.groupEnd();
}

function isElementOverflowing(element: HTMLElement) {
  return element.scrollHeight > element.offsetHeight;
}

function findOverflowingParent(element: Element) {
  let parent = element.parentElement;
  while (parent && parent.scrollHeight === parent.offsetHeight) {
    parent = parent.parentElement;
  }
  return parent;
}

function createElement(
  tag: keyof HTMLElementTagNameMap,
  options: {
    className?: string;
    styles?: {
      [key in keyof Partial<CSSStyleDeclaration>]: string;
    };
    children?: HTMLElement[];
    text?: string;
  } = {}
) {
  const element = document.createElement(tag);
  const { className, styles, children, text } = options;
  if (className) {
    element.className = className;
  }
  if (styles) {
    Object.assign(element.style, styles);
  }
  if (children) {
    for (const child of children) {
      element.append(child);
    }
  } else if (text) {
    element.innerText = text;
  }
  return element;
}

enum HighlightState {
  None = 0,
  Highlighted = 1,
}

enum ElementInteractionMode {
  Click = 0,
  Focus = 1,
  OpenInNewTab = 2,
}

type Actions = Record<
  string,
  { desc: string; fn: (event: KeyboardEvent) => void }
>;

const mainContext = createContext<{
  hideAllPopups: () => void;
  resetState: (hidePopups: boolean) => void;
  interact: (element: HTMLElement, mode: ElementInteractionMode) => void;
}>();

function ActionsHelp(props: {
  keyInput: string;
  actionKeys: string[];
  actions: Actions;
}) {
  return (
    <div
      class="qs-popup"
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: rem(0.75),
        padding: rem(1),
        "font-family": "sans-serif",
        width: "50vw",
        "max-height": "50vh",
        "overflow-y": "auto",
      }}
    >
      <For each={props.actionKeys}>
        {(key) => {
          const keyInputLength = () => props.keyInput.length;
          const noKeyInput = () => keyInputLength() === 0;
          const startsWithKeyInput = () => key.startsWith(props.keyInput);
          return (
            <Show when={noKeyInput() || startsWithKeyInput()}>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: rem(0.75),
                }}
              >
                <div
                  style={{
                    "font-family": `"SF Mono", monospace`,
                    background: "#fff",
                    color: "#000",
                    padding: rem(0.25),
                  }}
                >
                  <Show
                    when={startsWithKeyInput}
                    fallback={key.replace(/\s/g, "")}
                  >
                    <span style="opacity: 0.5">
                      {key.slice(0, keyInputLength()).replace(/\s/g, "")}
                    </span>
                    <span>
                      {key.slice(keyInputLength()).replace(/\s/g, "")}
                    </span>
                  </Show>
                </div>
                {props.actions[key].desc}
              </div>
            </Show>
          );
        }}
      </For>
    </div>
  );
}

type ClickableItem = {
  text: string;
  element: HTMLElement;
  href?: string;
};

function ClickableItemComp(props: {
  item: ClickableItem;
  index: number;
  selectedIndex: number;
  query: string;
}) {
  let itemElement: HTMLButtonElement | undefined;

  const [isHovered, setIsHovered] = createSignal(false);
  const context = useContext(mainContext);

  createEffect(() => {
    if (props.index === props.selectedIndex && itemElement) {
      itemElement.scrollIntoView({
        block: "nearest",
      });
    }
  });

  const indexOfQueryInText = createMemo(() => {
    if (props.query.length === 0) return -1;
    if (props.item.text.length === 0) return -1;
    return props.item.text.toLowerCase().indexOf(props.query.toLowerCase());
  });

  const indexOfQueryInHref = createMemo(() => {
    if (props.query.length === 0) return -1;
    if (!props.item.href || props.item.href.length === 0) return -1;
    return props.item.href.toLowerCase().indexOf(props.query.toLowerCase());
  });

  return (
    <button
      ref={itemElement}
      style={{
        display: "grid",
        "grid-template-columns": "2fr auto",
        "grid-template-rows": "repeat(2,1fr)",
        "align-items": "center",
        gap: rem(0.125),
        "padding-block": rem(0.75),
        "padding-inline": rem(1.25),
        background:
          props.index === props.selectedIndex || isHovered()
            ? "var(--bg-700)"
            : "transparent",
        color: "inherit",
        "user-select": "none",
        "overflow-x": "clip",
      }}
      onClick={(event) => {
        const element = props.item.element;
        if (event.ctrlKey) {
          context?.interact(element, ElementInteractionMode.OpenInNewTab);
        } else {
          context?.interact(element, ElementInteractionMode.Click);
        }
        context?.resetState(true);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          "grid-column-end": "2",
          "font-weight": "bold",
        }}
      >
        <Show when={indexOfQueryInText() > -1} fallback={props.item.text}>
          <span>{props.item.text.slice(0, indexOfQueryInText())}</span>
          <span
            style={{
              background: "var(--bg-600)",
              padding: "1px",
            }}
          >
            {props.item.text.slice(
              indexOfQueryInText(),
              indexOfQueryInText() + props.query.length
            )}
          </span>
          <span>
            {props.item.text.slice(indexOfQueryInText() + props.query.length)}
          </span>
        </Show>
      </div>
      <div
        style={{
          "grid-column-end": "2",
          "font-size": "smaller",
          "white-space": "nowrap",
          "text-overflow": "ellipsis",
          overflow: "hidden",
        }}
      >
        <Show when={props.item.href} fallback={"<button>"}>
          {(href) => (
            <Show when={indexOfQueryInHref() > -1} fallback={href()}>
              <span>{href().slice(0, indexOfQueryInHref())}</span>
              <span
                style={{
                  background: "var(--bg-600)",
                  padding: "1px",
                }}
              >
                {href().slice(
                  indexOfQueryInHref(),
                  indexOfQueryInHref() + props.query.length
                )}
              </span>
              <span>
                {href().slice(indexOfQueryInHref() + props.query.length)}
              </span>
            </Show>
          )}
        </Show>
      </div>
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          "align-items": "end",
          "grid-column-start": "2",
          "grid-row": "1 / 3",
          gap: rem(0.25),
          "font-size": "small",
          "pointer-events": "none",
          opacity:
            props.index === props.selectedIndex || isHovered() ? "1" : "0",
        }}
      >
        <div style={{ display: "flex", "align-items": "center" }}>
          <kbd>Enter</kbd>{" "}
          <span style={{ "margin-left": "4px" }}>
            {props.item.href ? "open" : "click"}
          </span>
        </div>
        <Show when={props.item.href}>
          <div style={{ display: "flex", "align-items": "center" }}>
            <kbd>Ctrl</kbd>
            <span style={{ margin: "2px" }}>+</span>
            <kbd>Enter</kbd>
            <span style={{ "margin-left": "4px" }}>new tab</span>
          </div>
        </Show>
      </div>
    </button>
  );
}

function LinkAndButtonList() {
  let container: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;

  const context = useContext(mainContext);

  const items: ClickableItem[] = [];
  for (const element of document.querySelectorAll("a,button")) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }
    const text = element.textContent;
    if (!text) continue;
    let href: string | undefined;
    if (element instanceof HTMLAnchorElement) {
      href = element.href;
    }
    const item: ClickableItem = { text, element, href };
    items.push(item);
  }

  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [query, setQuery] = createSignal("");

  createEffect(() => {
    const _ = query();
    setSelectedIndex(0);
  });

  const filtered = createMemo(() => {
    const q = query();
    if (q.length === 0) return items;
    return items.filter((a) => {
      const lowercaseQuery = q.toLowerCase();
      return (
        a.text.toLowerCase().includes(lowercaseQuery) ||
        a.href?.toLowerCase().includes(lowercaseQuery)
      );
    });
  });

  const clickListener = (event: MouseEvent) => {
    if (!container || !(event.target instanceof Element)) {
      return;
    }
    if (container.contains(event.target)) {
      return;
    }
    context?.hideAllPopups();
  };

  onMount(() => {
    if (input) {
      input.focus();
    }

    document.addEventListener("click", clickListener);
  });

  onCleanup(() => {
    document.removeEventListener("click", clickListener);
  });

  return (
    <div
      ref={container}
      class="qs-popup"
      style={{
        display: "flex",
        "flex-direction": "column",
        "font-family": "sans-serif",
        width: "65vw",
        "max-height": "50vh",
        "z-index": "69420",
      }}
    >
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          "overflow-y": "scroll",
          "padding-block": rem(0.5),
          "padding-inline": "0",
        }}
      >
        <For each={filtered()}>
          {(item, index) => (
            <ClickableItemComp
              item={item}
              index={index()}
              selectedIndex={selectedIndex()}
              query={query()}
            />
          )}
        </For>
      </div>
      <input
        ref={input}
        style={{
          background: "inherit",
          color: "inherit",
          "padding-block": rem(0.5),
          "padding-inline": rem(1),
          border: "1px solid transparent",
          "border-radius": "0",
        }}
        value={query()}
        onKeyDown={(event) => {
          const { key } = event;
          if (key !== "Escape") {
            event.stopImmediatePropagation();
          }
          switch (key) {
            case "ArrowDown":
              setSelectedIndex((index) =>
                Math.min(index + 1, filtered().length)
              );
              break;
            case "ArrowUp":
              setSelectedIndex((index) => Math.max(index - 1, 0));
              break;
            case "Enter": {
              const item = filtered()[selectedIndex()];
              if (item) {
                context?.interact(
                  item.element,
                  event.ctrlKey
                    ? ElementInteractionMode.OpenInNewTab
                    : ElementInteractionMode.Click
                );
              }
              context?.resetState(true);
              break;
            }
            default:
              break;
          }
        }}
        onInput={(event) => {
          event.stopImmediatePropagation();
          setQuery(event.target.value);
        }}
      />
    </div>
  );
}

function Root() {
  let highlightsContainer: HTMLDivElement | undefined;

  const state: {
    activeElement: HTMLElement | null;
    keyInput: string;
    highlightState: HighlightState;
    highlightInput: string;
    highlightInteractionMode: ElementInteractionMode;
  } = {
    activeElement: null,
    keyInput: "",
    highlightState: HighlightState.None,
    highlightInput: "",
    highlightInteractionMode: ElementInteractionMode.Click,
  };

  const [showActionHelp, setShowActionHelp] = createSignal(false);

  const [showLinkAndButtonList, setShowListAndButtonList] = createSignal(false);

  function hideAllPopups() {
    setShowActionHelp(false);
    setShowListAndButtonList(false);
  }

  const idToHighlightMap = new Map<string, HTMLElement>();
  const highlightToElementMap = new WeakMap<HTMLElement, HTMLElement>();

  function removeHighlight(id: string, highlight: HTMLElement) {
    highlight.remove();
    idToHighlightMap.delete(id);
    highlightToElementMap.delete(highlight);
  }

  function clearAllHighlights() {
    for (const [id, highlight] of idToHighlightMap) {
      removeHighlight(id, highlight);
    }
    if (!highlightsContainer) {
      return;
    }
    for (const child of Array.from(highlightsContainer.children)) {
      child.remove();
    }
  }

  function highlightElementsBySelector(selector: string) {
    clearAllHighlights();
    const elements = document.querySelectorAll<HTMLElement>(selector);
    if (!elements) {
      return;
    }
    const elementRects = Array.from(
      elements.values().map((linkEl) => linkEl.getBoundingClientRect())
    );
    const highlightIDs = twoCharIDGenerator();
    const windowHeight = window.innerHeight;
    let createdHighlights = 0;
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const elementRect = elementRects[index];
      const isInViewport =
        elementRect.top >= 0 &&
        elementRect.bottom <= windowHeight &&
        elementRect.width > 0 &&
        elementRect.height > 0;
      const isVisible = element.checkVisibility({
        checkOpacity: true,
      });
      if (!isInViewport || !isVisible) {
        continue;
      }
      const id = highlightIDs.next().value;
      const highlight = createElement("div", {
        className: "absolute top-0 left-0 z-69420",
        styles: {
          translate: `${elementRect.x}px ${elementRect.y}px`,
          background: `hsl(50deg 80% 80%)`,
          color: "black",
          padding: "1px 2px",
        },
        text: id as string,
      });
      highlightsContainer?.append(highlight);
      idToHighlightMap.set(id as string, highlight);
      highlightToElementMap.set(highlight, element);
      createdHighlights++;
    }
    if (createdHighlights === 0) {
      return;
    }
    state.highlightState = HighlightState.Highlighted;
  }

  function handleElementInteraction(
    element: HTMLElement,
    mode: ElementInteractionMode
  ) {
    switch (mode) {
      case ElementInteractionMode.Click:
        element.click();
        break;
      case ElementInteractionMode.Focus:
        element.focus();
        break;
      case ElementInteractionMode.OpenInNewTab: {
        if (!(element instanceof HTMLAnchorElement)) {
          return;
        }
        const href = element.href;
        window.open(href, "_blank");
        break;
      }
    }
  }

  function handleHighlightInteraction(id: string) {
    const highlight = idToHighlightMap.get(id);
    if (!highlight) {
      return;
    }
    const element = highlightToElementMap.get(highlight);
    if (element) {
      handleElementInteraction(element, state.highlightInteractionMode);
    }
  }

  function updateHighlightInput(key: string, event: KeyboardEvent) {
    state.highlightInput += key;
    const ids = Array.from(idToHighlightMap.keys());
    const highlightInput = state.highlightInput;
    const filtered = ids.filter((id) => id.startsWith(highlightInput));
    for (const [id, highlight] of idToHighlightMap) {
      if (!filtered.includes(id)) {
        removeHighlight(id, highlight);
      } else {
        const text = highlight.innerText;
        const s1 = text.slice(0, highlightInput.length);
        const s2 = text.slice(highlightInput.length);
        highlight.innerHTML = `<span style="opacity:0.5">${s1}</span>${s2}`;
      }
    }
    const firstResult = filtered[0];
    if (filtered.length === 1 && firstResult === highlightInput) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleHighlightInteraction(firstResult);
      state.highlightState = HighlightState.None;
      state.highlightInput = "";
      clearAllHighlights();
    } else if (filtered.length === 0) {
      state.highlightState = HighlightState.None;
      state.highlightInput = "";
      clearAllHighlights();
    }
  }

  function getElementToScroll(element: HTMLElement) {
    let elementToScroll: HTMLElement | null = null;
    elementToScroll = isElementOverflowing(element)
      ? element
      : findOverflowingParent(element);
    if (!elementToScroll) {
      elementToScroll = document.documentElement;
    }
    return elementToScroll;
  }

  function getCurrentElement() {
    let element = state.activeElement;
    if (!element || !element.isConnected) {
      element = document.activeElement as HTMLElement | null;
    }
    if (!(element instanceof HTMLElement)) {
      return null;
    }
    return element;
  }

  function scrollUp() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: -70,
    });
  }

  function scrollHalfPageUp() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: -(window.innerHeight / 2),
    });
  }

  function scrollDown() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: 70,
    });
  }

  function scrollHalfPageDown() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollBy({
      top: window.innerHeight / 2,
    });
  }

  function scrollToTop() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollTop = 0;
  }

  function scrollToBottom() {
    const element = getCurrentElement();
    if (!element) {
      return;
    }
    const elementToScroll = getElementToScroll(element);
    elementToScroll.scrollTop = elementToScroll.scrollHeight;
  }

  function highlightLinksAndButtons() {
    if (state.highlightState === HighlightState.None) {
      state.highlightInteractionMode = ElementInteractionMode.Click;
      highlightElementsBySelector("a,button");
    }
  }

  function highlightLinksToOpenInNewTab() {
    if (state.highlightState === HighlightState.None) {
      state.highlightInteractionMode = ElementInteractionMode.OpenInNewTab;
      highlightElementsBySelector("a");
    }
  }

  function highlightAllInputs() {
    if (state.highlightState === HighlightState.None) {
      state.highlightInteractionMode = ElementInteractionMode.Focus;
      highlightElementsBySelector("input,textarea,[contenteditable]");
    }
  }

  const actions: Actions = {
    k: { desc: "Scroll up", fn: scrollUp },
    j: { desc: "Scroll down", fn: scrollDown },
    e: { desc: "Scroll half-page up", fn: scrollHalfPageUp },
    d: { desc: "Scroll half-page down", fn: scrollHalfPageDown },
    "g g": { desc: "Scroll to top", fn: scrollToTop },
    "S-g": { desc: "Scroll to bottom", fn: scrollToBottom },
    i: { desc: "Highlight inputs", fn: highlightAllInputs },
    "l f": {
      desc: "List links & buttons",
      fn: () => setShowListAndButtonList((show) => !show),
    },
    f: { desc: "Highlight links & buttons", fn: highlightLinksAndButtons },
    "g f": {
      desc: "Highlight links to open in new tab",
      fn: highlightLinksToOpenInNewTab,
    },
    "S-?": { desc: "Show help", fn: () => setShowActionHelp((show) => !show) },
  };

  const actionKeys = Object.keys(actions);

  const clickListener = (event: MouseEvent) => {
    if (event.target instanceof HTMLElement) {
      state.activeElement = event.target;
    }
  };

  const focusListener = (event: FocusEvent) => {
    if (event.target instanceof HTMLElement) {
      state.activeElement = event.target;
    }
  };

  const [keyInput, setKeyInput] = createSignal("");

  function resetState(hidePopups: boolean) {
    if (hidePopups) {
      hideAllPopups();
    }
    clearAllHighlights();
    setKeyInput("");
    state.highlightState = HighlightState.None;
    state.highlightInput = "";
  }

  const keydownListener = (event: KeyboardEvent) => {
    const { key, ctrlKey, shiftKey, altKey } = event;

    if (key === "Control" || key === "Shift" || key === "Alt") {
      return;
    }

    const element = getCurrentElement();
    const isInputElement =
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element?.closest('[contenteditable="true"]');
    if (key === "Escape" || isInputElement) {
      if (key === "Escape") {
        event.preventDefault();
        resetState(true);
      }

      resetState(false);
      return;
    }

    if (
      !ctrlKey &&
      !shiftKey &&
      !altKey &&
      state.highlightState === HighlightState.Highlighted &&
      key !== "Escape"
    ) {
      updateHighlightInput(key, event);
      return;
    }

    if (keyInput().length > 0) {
      setKeyInput((ki) => ki + " ");
    }

    setKeyInput(
      (ki) =>
        ki +
        `${ctrlKey ? "C-" : ""}${shiftKey ? "S-" : ""}${
          altKey ? "A-" : ""
        }${key.toLowerCase()}`
    );

    event.stopImmediatePropagation();
    event.stopPropagation();

    const input = keyInput();
    const filtered = actionKeys.filter((key) => key.startsWith(input));
    const firstResult = filtered[0];
    if (filtered.length === 1 && firstResult === input) {
      event.preventDefault();
      actions[firstResult].fn(event);
      setKeyInput("");
    } else if (filtered.length === 0) {
      setKeyInput("");
    }
  };

  onMount(() => {
    document.documentElement.addEventListener("click", clickListener);
    document.body.addEventListener("focusin", focusListener);
    window.addEventListener("keydown", keydownListener);
  });

  onCleanup(() => {
    document.documentElement.removeEventListener("click", clickListener);
    document.body.removeEventListener("focusin", focusListener);
    window.removeEventListener("keydown", keydownListener);
  });

  return (
    <mainContext.Provider
      value={{
        hideAllPopups,
        resetState,
        interact: handleElementInteraction,
      }}
    >
      <div
        ref={highlightsContainer}
        class="fixed top-0 left-0 w-full h-full z-69420 pointer-events-none"
      />
      <Show when={keyInput().length > 0 || showActionHelp()}>
        <ActionsHelp
          keyInput={keyInput()}
          actions={actions}
          actionKeys={actionKeys}
        />
      </Show>
      <Show when={showLinkAndButtonList()}>
        <LinkAndButtonList />
      </Show>
    </mainContext.Provider>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  cssInjectionMode: "ui",
  async main(ctx) {
    log("Loaded content script");

    const ui = await createShadowRootUi(ctx, {
      name: "quicksilver-ui",
      position: "inline",
      anchor: "body",
      onMount(uiContainer) {
        render(() => <Root />, uiContainer);
      },
    });
    ui.mount();
  },
});
