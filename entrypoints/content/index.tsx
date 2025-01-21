import { ComponentProps, JSX, ParentProps } from "solid-js";
import { Tabs } from "wxt/browser";
import { Message } from "../../Message";

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

type ElementStyles = {
  [key in keyof Partial<CSSStyleDeclaration>]: string;
};

function createElement(
  tag: keyof HTMLElementTagNameMap,
  options: {
    className?: string;
    styles?: ElementStyles;
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
  { desc: string; fn: (event: KeyboardEvent | MouseEvent) => void }
>;

const Colors = {
  "cb-dark-80": "color-mix(in oklab, cornflowerblue, black 80%)",
  "cb-dark-70": "color-mix(in oklab, cornflowerblue, black 70%)",
  "cb-dark-60": "color-mix(in oklab, cornflowerblue, black 60%)",
  "cb-dark-50": "color-mix(in oklab, cornflowerblue, black 50%)",
  "cb-dark-40": "color-mix(in oklab, cornflowerblue, black 40%)",
  "cb-dark-30": "color-mix(in oklab, cornflowerblue, black 30%)",
  "cb-dark-20": "color-mix(in oklab, cornflowerblue, black 20%)",
  cb: "cornflowerblue",
  "cb-light-90": "color-mix(in oklab, cornflowerblue, white 90%)",
};

const HighlightStyles: ElementStyles = {
  position: "absolute",
  top: "0",
  left: "0",
  zIndex: "69420",
  background: Colors["cb-dark-50"],
  color: Colors["cb-light-90"],
  padding: rem(0.25),
  fontSize: rem(0.85),
  lineHeight: "1",
  fontFamily: "monospace",
  boxShadow: `inset 0 -2px 0 0 ${Colors["cb-dark-20"]}`,
  borderRadius: rem(0.25),
};

const ButtonDefaultStyles: JSX.CSSProperties = {
  margin: "0",
  padding: "0",
  "border-color": "transparent",
  "font-family": "inherit",
  "font-size": "inherit",
  "text-align": "left",
};

const PopupStyles: JSX.CSSProperties = {
  position: "fixed",
  bottom: rem(0.5),
  left: "50%",
  translate: "-50% 0",
  display: "flex",
  "flex-direction": "column",
  background: Colors["cb-dark-70"],
  color: Colors["cb-light-90"],
  width: `min(95vw, ${rem(40)})`,
  "min-height": "0",
  "max-height": "50vh",
  "font-family": "sans-serif",
  "font-size": rem(1),
  "border-radius": rem(0.25),
  "z-index": 69420,
};
function Popup(props: ParentProps) {
  let popup: HTMLDivElement | undefined;

  const context = useContext(mainContext);

  const clickListener = (event: MouseEvent) => {
    if (!popup || !(event.target instanceof Element)) {
      return;
    }
    if (popup.contains(event.target)) {
      return;
    }
    context?.hideAllPopups();
  };

  onMount(() => {
    document.addEventListener("click", clickListener);
  });
  onCleanup(() => {
    document.removeEventListener("click", clickListener);
  });

  return (
    <div ref={popup} class="qs-popup" style={PopupStyles}>
      {props.children}
    </div>
  );
}

const KbdStyles: JSX.CSSProperties = {
  "box-shadow": `inset 0 -2px 0 0 ${Colors["cb-dark-20"]}`,
  "border-radius": rem(0.25),
  background: Colors["cb-dark-50"],
  padding: `${rem(0.125)} ${rem(0.325)}`,
  border: "1px solid transparent",
};
function Kbd(props: ParentProps) {
  return <kbd style={KbdStyles}>{props.children}</kbd>;
}

const mainContext = createContext<{
  hideAllPopups: () => void;
  resetState: (hidePopups: boolean) => void;
}>();

function handleElementInteraction(
  element: HTMLElement,
  mode: ElementInteractionMode
) {
  switch (mode) {
    case ElementInteractionMode.Click:
      element.click();
      break;
    case ElementInteractionMode.Focus:
      setTimeout(() => element.focus());
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

function ActionsHelp(props: {
  keyInput: string;
  actionKeys: string[];
  actions: Actions;
}) {
  return (
    <Popup>
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: rem(0.75),
          padding: rem(1),
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
                  <Kbd>
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
                  </Kbd>
                  {props.actions[key].desc}
                </div>
              </Show>
            );
          }}
        </For>
      </div>
    </Popup>
  );
}

type ClickableItem = {
  text: string;
  element: HTMLElement;
  href?: string;
};

function ClickableItemComp(
  allProps: {
    index: number;
    selectedIndex: number;
    children: JSX.Element;
  } & ComponentProps<"button">
) {
  const [props, rest] = splitProps(allProps, [
    "index",
    "selectedIndex",
    "children",
    "style",
  ]);

  let itemElement: HTMLButtonElement | undefined;

  const [isHovered, setIsHovered] = createSignal(false);

  createEffect(() => {
    if (props.index === props.selectedIndex && itemElement) {
      itemElement.scrollIntoView({
        block: "nearest",
      });
    }
  });

  return (
    <button
      ref={itemElement}
      tabIndex={props.index !== 0 ? "-1" : undefined}
      style={{
        ...ButtonDefaultStyles,
        display: "grid",
        "grid-template-columns": "2fr auto",
        "grid-template-rows": "repeat(2,1fr)",
        "align-items": "center",
        gap: rem(0.125),
        "padding-block": rem(0.75),
        "padding-inline": rem(1.25),
        background:
          props.index === props.selectedIndex || isHovered()
            ? Colors["cb-dark-60"]
            : "transparent",
        color: "inherit",
        "user-select": "none",
        "overflow-x": "clip",
        "--is-hovered": Number(isHovered()),
        ...(typeof props.style !== "string" ? props.style || {} : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...rest}
    >
      {props.children}
    </button>
  );
}

function ListSearch<Item extends unknown>(props: {
  items: Item[];
  filter: (item: Item, lowercaseQuery: string) => boolean;
  itemRenderFn: (item: Item, isFocused: boolean, index: number) => JSX.Element;
  handleSelect: (item: Item, event: KeyboardEvent | MouseEvent) => void;
}) {
  let input: HTMLInputElement | undefined;

  onMount(() => {
    input?.focus();
  });

  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const [query, setQuery] = createSignal("");

  createEffect(() => {
    const _ = query();
    setFocusedIndex(0);
  });

  const filtered = createMemo(() => {
    const q = query();
    if (q.length === 0) return props.items;
    const lowercaseQuery = q.toLowerCase();
    return props.items.filter((item) => props.filter(item, lowercaseQuery));
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
      }}
      onKeyDown={(event) => {
        const { key } = event;
        if (key !== "Escape") {
          event.stopImmediatePropagation();
        }
        switch (key) {
          case "ArrowDown":
            setFocusedIndex((index) => {
              const next = index + 1;
              const last = filtered().length - 1;
              if (next > last) {
                return 0;
              }
              return next;
            });
            break;
          case "ArrowUp":
            setFocusedIndex((index) => {
              const prev = index - 1;
              if (prev < 0) {
                return filtered().length - 1;
              }
              return prev;
            });
            break;
          case "Enter": {
            const item = filtered()[focusedIndex()];
            if (item) {
              props.handleSelect(item, event);
            }
            break;
          }
          default:
            break;
        }
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
              index={index()}
              selectedIndex={focusedIndex()}
              onClick={(event) => props.handleSelect(item, event)}
            >
              {props.itemRenderFn(item, index() === focusedIndex(), index())}
            </ClickableItemComp>
          )}
        </For>
      </div>
      <input
        ref={input}
        class="qs-input"
        style={{
          background: "inherit",
          color: "inherit",
          "padding-block": rem(0.5),
          "padding-inline": rem(1),
          border: "1px solid transparent",
          "border-radius": "0",
          "border-bottom-left-radius": rem(0.25),
          "border-bottom-right-radius": rem(0.25),
        }}
        value={query()}
        onInput={(event) => {
          event.stopImmediatePropagation();
          setQuery(event.target.value);
        }}
      />
    </div>
  );
}

function SearchLinksAndButtons() {
  const context = useContext(mainContext);

  const items: ClickableItem[] = [];
  for (const element of document.querySelectorAll("a,button")) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }
    let text: string | null = "";
    const labelledby = element.getAttribute("aria-labelledby");
    const ariaLabel = element.ariaLabel;
    const textContent = element.textContent;
    if (labelledby) {
      const ids = labelledby.split(" ");
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const textContent = el.textContent;
        if (textContent) text += textContent;
      }
    }
    if (text.length === 0) {
      text = ariaLabel || textContent || element.title;
    }
    if (!text) continue;
    let href: string | undefined;
    if (element instanceof HTMLAnchorElement) {
      href = element.href;
    }
    const item: ClickableItem = { text, element, href };
    items.push(item);
  }

  function handleSelect(
    item: ClickableItem,
    event: KeyboardEvent | MouseEvent
  ) {
    context?.resetState(true);
    const element = item.element;
    if (item.href && event.ctrlKey) {
      handleElementInteraction(element, ElementInteractionMode.OpenInNewTab);
    } else if (event.shiftKey) {
      handleElementInteraction(element, ElementInteractionMode.Focus);
    } else {
      handleElementInteraction(element, ElementInteractionMode.Click);
    }
  }

  return (
    <Popup>
      <ListSearch
        items={items}
        filter={(a, lowercaseQuery) => {
          return (
            a.text.toLowerCase().includes(lowercaseQuery) ||
            a.href?.toLowerCase().includes(lowercaseQuery) ||
            false
          );
        }}
        itemRenderFn={(item, isFocused) => (
          <>
            <div
              style={{
                "grid-column-end": "2",
                "font-weight": "bold",
              }}
            >
              {item.text}
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
              <Show when={item.href} fallback={"<button>"}>
                {item.href}
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
                opacity: isFocused ? "1" : "var(--is-hovered)",
              }}
            >
              <div style={{ display: "flex", "align-items": "center" }}>
                <Kbd>Enter</Kbd>{" "}
                <span style={{ "margin-left": "4px" }}>
                  {item.href ? "open" : "click"}
                </span>
              </div>
              <div style={{ display: "flex", "align-items": "center" }}>
                <Kbd>Shift</Kbd>
                <span style={{ margin: "2px" }}>+</span>
                <Kbd>Enter</Kbd>
                <span style={{ "margin-left": "4px" }}>focus</span>
              </div>
              <Show when={item.href}>
                <div style={{ display: "flex", "align-items": "center" }}>
                  <Kbd>Ctrl</Kbd>
                  <span style={{ margin: "2px" }}>+</span>
                  <Kbd>Enter</Kbd>
                  <span style={{ "margin-left": "4px" }}>new tab</span>
                </div>
              </Show>
            </div>
          </>
        )}
        handleSelect={handleSelect}
      />
    </Popup>
  );
}

function VideoList() {
  const context = useContext(mainContext);

  const videos: HTMLVideoElement[] = [];
  for (const video of document.querySelectorAll("video")) {
    videos.push(video);
  }

  function handleSelect(
    item: HTMLVideoElement,
    event: KeyboardEvent | MouseEvent
  ) {
    context?.resetState(true);
  }

  return (
    <Popup>
      <ListSearch
        items={videos}
        itemRenderFn={(item) => <>{item.src}</>}
        filter={() => true}
        handleSelect={handleSelect}
      />
    </Popup>
  );
}

function TabList() {
  const [tabs] = createResource(async function getAllTabs() {
    const response = (await browser.runtime.sendMessage({
      type: "get-all-tabs",
    } satisfies Message)) as Message;
    if (!Array.isArray(response)) {
      throw new Error("Did not receive correct response");
    }
    return response as Tabs.Tab[];
  });

  const context = useContext(mainContext);

  return (
    <Show when={tabs()}>
      <Popup>
        <ListSearch
          items={tabs()!}
          itemRenderFn={(tab) => (
            <>
              <div style={{ "font-weight": "bold" }}>{tab.title}</div>
              <div style={{ "font-size": "smaller", "grid-row": "2" }}>
                {tab.url}
              </div>
            </>
          )}
          filter={(item, lowercaseQuery) =>
            Boolean(
              item.title?.toLowerCase().includes(lowercaseQuery) ||
                item.url?.toLowerCase().includes(lowercaseQuery)
            )
          }
          handleSelect={function selectTab(item) {
            context?.resetState(true);
            browser.runtime.sendMessage({
              type: "activate-tab",
              tabId: item.id,
            } satisfies Message);
          }}
        />
      </Popup>
    </Show>
  );
}

function CommandPalette(props: { actions: Actions }) {
  const actionsList = Object.entries(props.actions);

  const context = useContext(mainContext);

  function handleSelect(
    item: (typeof actionsList)[number],
    event: KeyboardEvent | MouseEvent
  ) {
    context?.resetState(true);
    item[1].fn(event);
  }

  return (
    <Popup>
      <ListSearch
        items={actionsList}
        itemRenderFn={(item) => (
          <>
            <div>
              <Kbd>{item[0]}</Kbd>
            </div>
            <div>{item[1].desc}</div>
          </>
        )}
        filter={([key, { desc }], lowercaseQuery) => {
          return (
            key.toLowerCase().includes(lowercaseQuery) ||
            desc.toLowerCase().includes(lowercaseQuery)
          );
        }}
        handleSelect={handleSelect}
      />
    </Popup>
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

  const [isPassthrough, setIsPassthrough] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal("");

  const [showActionHelp, setShowActionHelp] = createSignal(false);
  const [showLinkAndButtonList, setShowListAndButtonList] = createSignal(false);
  const [showVideoList, setShowVideoList] = createSignal(false);
  const [showTabList, setShowTabList] = createSignal(false);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);

  function hideAllPopups() {
    setShowActionHelp(false);
    setShowListAndButtonList(false);
    setShowVideoList(false);
    setShowTabList(false);
    setShowCommandPalette(false);
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

  function highlightElementsBySelector(selector: string, checkOpacity = true) {
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
        checkOpacity,
      });
      if (!isInViewport || !isVisible) {
        continue;
      }
      const id = highlightIDs.next().value;
      const highlight = createElement("div", {
        styles: {
          ...HighlightStyles,
          translate: `${elementRect.x}px ${elementRect.y}px`,
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
      highlightElementsBySelector("input,textarea,[contenteditable]", false);
    }
  }

  function togglePassthrough() {
    setIsPassthrough((is) => !is);
  }

  function toggleCommandPalette() {
    setShowCommandPalette(true);
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
      desc: "List all links & buttons",
      fn: () => setShowListAndButtonList((show) => !show),
    },
    "l v": {
      desc: "List all videos",
      fn: () => setShowVideoList((show) => !show),
    },
    "l t": {
      desc: "List all tabs",
      fn: () => setShowTabList((show) => !show),
    },
    f: { desc: "Highlight links & buttons", fn: highlightLinksAndButtons },
    "g f": {
      desc: "Highlight links to open in new tab",
      fn: highlightLinksToOpenInNewTab,
    },
    "S-?": { desc: "Show help", fn: () => setShowActionHelp((show) => !show) },
    p: { desc: "Toggle passthrough", fn: togglePassthrough },
    "C-p": { desc: "Show command palette", fn: toggleCommandPalette },
  };

  const actionKeyCombinations = Object.keys(actions);

  const actionUniqueKeys = new Set(
    actionKeyCombinations
      .map((kc) => kc.replace(/[CSA]-/g, "").split(" "))
      .flat()
  );

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

  function resetState(hidePopups: boolean) {
    if (hidePopups) {
      hideAllPopups();
    }
    clearAllHighlights();
    setKeyInput("");
    setIsPassthrough(false);
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
      event.stopImmediatePropagation();
      event.stopPropagation();
      updateHighlightInput(key, event);
      return;
    }

    const keyRepresentation = `${ctrlKey ? "C-" : ""}${shiftKey ? "S-" : ""}${
      altKey ? "A-" : ""
    }${key.toLowerCase()}`;

    if (isPassthrough() && keyRepresentation !== "p") {
      return;
    }

    if (!actionUniqueKeys.has(key.toLowerCase())) {
      return;
    }

    if (keyInput().length > 0) {
      setKeyInput((ki) => ki + " ");
    }

    setKeyInput((ki) => ki + keyRepresentation);

    event.stopImmediatePropagation();
    event.stopPropagation();

    const input = keyInput();
    const filtered = actionKeyCombinations.filter((key) =>
      key.startsWith(input)
    );
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
    document.body.addEventListener("keydown", keydownListener, {
      capture: true,
    });
  });

  onCleanup(() => {
    document.documentElement.removeEventListener("click", clickListener);
    document.body.removeEventListener("focusin", focusListener);
    document.body.removeEventListener("keydown", keydownListener, {
      capture: true,
    });
  });

  return (
    <mainContext.Provider
      value={{
        hideAllPopups,
        resetState,
      }}
    >
      <div
        ref={highlightsContainer}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          "z-index": 69420,
          "pointer-events": "none",
        }}
      />
      <Show when={keyInput().length > 0 || showActionHelp()}>
        <ActionsHelp
          keyInput={keyInput()}
          actions={actions}
          actionKeys={actionKeyCombinations}
        />
      </Show>
      <Show when={showLinkAndButtonList()}>
        <SearchLinksAndButtons />
      </Show>
      <Show when={showVideoList()}>
        <VideoList />
      </Show>
      <Show when={showTabList()}>
        <TabList />
      </Show>
      <Show when={isPassthrough()}>
        <div
          style={{
            ...PopupStyles,
            width: "auto",
            padding: rem(0.5),
          }}
        >
          Passthrough
        </div>
      </Show>
      <Show when={showCommandPalette()}>
        <CommandPalette actions={actions} />
      </Show>
      <style>{`
.qs-input { outline: 0; }
.qs-input:focus-visible { outline: 2px solid cornflowerblue; }
.qs-popup > * { min-height: 0; }
.qs-popup ::-webkit-scrollbar { width: 16px; }
.qs-popup ::-webkit-scrollbar-thumb {
  background: ${Colors["cb"]};
  border-radius: ${rem(0.5)};
  border: 4px solid rgba(0,0,0,0);
  background-clip: padding-box;
}
`}</style>
    </mainContext.Provider>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  cssInjectionMode: "ui",
  main(ctx) {
    log("Loaded content script");

    const ui = createIntegratedUi(ctx, {
      position: "inline",
      onMount(uiContainer) {
        render(() => <Root />, uiContainer);
      },
    });
    ui.mount();
  },
});
