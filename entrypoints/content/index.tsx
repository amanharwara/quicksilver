import { Accessor, Component, ComponentProps, JSX } from "solid-js";
import { Container, sendMessage } from "../../shared/messaging";
import {
  ArrowUpTrayIcon,
  ChevronDownIcon,
  XMarkIcon,
  LoopIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  AdjustmentsHorizontalIcon,
  VolumeIcon,
} from "../../shared/icons";
import { disableLogging, enableLogging, error, info } from "../../shared/log";
import {
  collapseSelectionToEnd,
  extendSelectionByCharToLeft,
  extendSelectionByCharToRight,
  extendSelectionByWordToLeft,
  extendSelectionByWordToRight,
  extendSelectionToLeftBySentence,
  extendSelectionToLineAbove,
  extendSelectionToLineBelow,
  extendSelectionToRightBySentence,
  moveSelectionByCharToLeft,
  moveSelectionByCharToRight,
  moveSelectionByWordToLeft,
  moveSelectionByWordToRight,
  moveSelectionToLeftBySentence,
  moveSelectionToLineAbove,
  moveSelectionToLineBelow,
  moveSelectionToRightBySentence,
  selectCurrentParagraph,
  selectCurrentWord,
} from "./selection";
import {
  Blocklist,
  ConfigV1,
  DefaultInteractiveElementsSelector,
  disabledGlobally,
  storedBlocklist,
  storedConfig,
} from "../../shared/storage";
import {
  deepQuerySelectorAll,
  isAnchorElement,
  isEscapeKey,
  isHTMLElement,
  isModifierKey,
  rem,
} from "../../shared/utils";

enum ElementInteractionMode {
  Click = 0,
  Focus = 1,
  OpenInNewTab = 2,
  Hover = 3,
  DoubleClick = 4,
}
type ElementInteraction =
  | {
      type: ElementInteractionMode.Click;
    }
  | {
      type: ElementInteractionMode.DoubleClick;
    }
  | {
      type: ElementInteractionMode.Focus;
    }
  | {
      type: ElementInteractionMode.OpenInNewTab;
      window?: "current" | "new" | "private";
      cookieStoreId?: string;
    }
  | {
      type: ElementInteractionMode.Hover;
    };

type HighlightElementsOptions = {
  interaction: ElementInteraction | undefined;
  checkOpacity?: boolean;
  handleInstantlyIfOnlyOne?: boolean;
};

type Context = {
  shouldShowDebugInfo: Accessor<boolean>;
  toggleDebugInfo: () => void;
  hideAllPopups: () => void;
  resetState: (hidePopups: boolean) => void;
  registerKeydownListener: (
    listener: KeyEventListener
  ) => KeyEventListenerCleanup;
  registerKeyupListener: (
    listener: KeyEventListener
  ) => KeyEventListenerCleanup;
  highlightElementsBySelector: (
    selector: string,
    options: HighlightElementsOptions
  ) => void;
  popupRoot: () => HTMLElement | undefined;
};

const letters = Array(26)
  .fill(0)
  .map((_, index) => {
    let i = index + 97;
    return String.fromCharCode(i);
  });

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

const OverflowValuesThatShowScrollbar = ["auto", "scroll"];
function isElementOverflowing(element: HTMLElement) {
  const isOverflowing = element.scrollHeight > element.offsetHeight;
  if (!isOverflowing) {
    return false;
  }
  const style = getComputedStyle(element);
  return (
    OverflowValuesThatShowScrollbar.includes(style.overflow) ||
    OverflowValuesThatShowScrollbar.includes(style.overflowY)
  );
}

function findOverflowingParent(element: Element) {
  let parent = element.parentElement;
  while (parent && !isElementOverflowing(parent)) {
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

const LEADER_KEY = " ";

function getKeyRepresentation(event: KeyboardEvent) {
  const { ctrlKey, shiftKey, altKey, metaKey, key: eventKey } = event;
  let key = eventKey.toLowerCase();
  if (key === LEADER_KEY) {
    key = "<leader>";
  }
  return `${ctrlKey ? "C-" : ""}${shiftKey ? "S-" : ""}${altKey ? "A-" : ""}${
    metaKey ? "M-" : ""
  }${key}`;
}

type WordInNode = {
  node: Node;
  start: number;
  end: number;
};

type Highlight =
  | {
      type: "element";
      element: HTMLElement;
    }
  | {
      type: "word";
      word: WordInNode;
    };

enum Mode {
  Normal = "Normal",
  Highlight = "Highlight",
  VisualCaret = "Visual caret",
  VisualRange = "Visual range",
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

const PopupStyles: JSX.CSSProperties = {
  position: "fixed",
  bottom: rem(0.5),
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
  overflow: "hidden",
  padding: 0,
  border: 0,
};
interface PopupProps extends ComponentProps<"dialog"> {
  context: Context;
}
function Popup(props: PopupProps) {
  let popup: HTMLDialogElement | undefined;

  const clickListener = (event: MouseEvent) => {
    if (!popup || !(event.target instanceof Element)) {
      return;
    }
    if (popup.contains(event.target)) {
      return;
    }
    props.context.hideAllPopups();
  };

  onMount(() => {
    document.addEventListener("click", clickListener);
  });
  onCleanup(() => {
    document.removeEventListener("click", clickListener);
  });

  return (
    <dialog
      {...props}
      ref={popup}
      class="qs-popup"
      style={{
        ...PopupStyles,
        ...(typeof props.style === "object" ? props.style : {}),
      }}
    >
      {props.children}
    </dialog>
  );
}

const WhiteSpaceRegEx = /\s/g;
const ArrowLeftRegEx = /arrowleft/g;
const ArrowRightRegEx = /arrowright/g;
const ArrowUpRegEx = /arrowup/g;
const ArrowDownRegEx = /arrowdown/g;
const EscapeRegEx = /escape/g;
const ShiftRegEx = /S-/g;
const CtrlRegEx = /C-/g;
const KbdStyles: JSX.CSSProperties = {
  "box-shadow": `inset 0 -2px 0 0 ${Colors["cb-dark-20"]}`,
  "border-radius": rem(0.25),
  background: Colors["cb-dark-50"],
  color: Colors["cb-light-90"],
  padding: `${rem(0.125)} ${rem(0.325)}`,
  border: "1px solid transparent",
  "font-family":
    "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
  "font-size": rem(1),
  "line-height": "1.25",
};
function replaceKeyChars(key: string) {
  return key
    .replaceAll(WhiteSpaceRegEx, "")
    .replaceAll(EscapeRegEx, "⎋")
    .replaceAll(ArrowLeftRegEx, "←")
    .replaceAll(ArrowRightRegEx, "→")
    .replaceAll(ArrowUpRegEx, "↑")
    .replaceAll(ArrowDownRegEx, "↓")
    .replaceAll(ShiftRegEx, "⇧")
    .replaceAll(CtrlRegEx, "⎈");
}
function getAllKeysFromCombo(combo: string) {
  return replaceKeyChars(combo).split("");
}
function Key(props: { key: string; style?: JSX.CSSProperties }) {
  return (
    <kbd
      style={{
        ...KbdStyles,
        padding:
          props.key === "⇧"
            ? `${rem(0.125)} ${rem(0.15)}`
            : KbdStyles["padding"],
        ...props.style,
      }}
    >
      <Switch fallback={props.key}>
        <Match when={props.key === "⇧"}>
          <ArrowUpTrayIcon
            style={{
              width: rem(1),
              height: rem(1),
              "vertical-align": "middle",
            }}
          />
        </Match>
        <Match when={props.key === "⎈"}>Ctrl</Match>
        <Match when={props.key === "⎋"}>Esc</Match>
      </Switch>
    </kbd>
  );
}
function KeyCombo(props: { combo: string }) {
  const keys = createMemo(() => getAllKeysFromCombo(props.combo));
  return (
    <Show when={keys().length > 0}>
      <div
        style={{
          display: "flex",
          gap: rem(0.35),
        }}
      >
        <For each={keys()}>{(key) => <Key key={key} />}</For>
      </div>
    </Show>
  );
}

type KeyEventListener = (event: KeyboardEvent) => boolean;
type KeyEventListenerCleanup = () => void;

function handleElementInteraction(
  element: HTMLElement,
  mode: ElementInteraction
) {
  switch (mode.type) {
    case ElementInteractionMode.Click:
      element.click();
      break;
    case ElementInteractionMode.DoubleClick:
      element.click();
      element.click();
      break;
    case ElementInteractionMode.Focus:
      setTimeout(() => element.focus());
      break;
    case ElementInteractionMode.OpenInNewTab: {
      if (!isAnchorElement(element)) {
        return;
      }
      const href = element.href;
      sendMessage("openNewTab", {
        url: href,
        background: true,
        cookieStoreId: mode.cookieStoreId,
        window: mode.window,
      });
      break;
    }
    case ElementInteractionMode.Hover: {
      element.dispatchEvent(new PointerEvent("pointerover"));
      element.dispatchEvent(new MouseEvent("mouseover"));
    }
  }
}

function ActionsHelp(props: {
  context: Context;
  mode: Accessor<Mode>;
  keyInput: string;
  actionsHelpByMode: {
    mode: string;
    actions: {
      key: string;
      desc: string;
    }[];
  }[];
}) {
  return (
    <Popup
      context={props.context}
      style={{
        "--gap": rem(1.65),
        "--padding": rem(1),
        "--col-width": "325px",
        width:
          "calc(var(--col-width) * 3 + calc(var(--padding) * 2) + var(--scrollbar-width) + calc(var(--gap) * 2))",
        "max-width": "95%",
      }}
    >
      <div
        style={{
          display: "grid",
          "grid-template-columns":
            "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
          padding: "var(--padding)",
          "overflow-y": "auto",
          gap: "var(--gap)",
        }}
        ref={(el) => {
          setTimeout(() => el.focus());
        }}
      >
        <For each={props.actionsHelpByMode}>
          {({ mode, actions }) => {
            return (
              <Show when={actions.length > 1}>
                <div
                  style={{
                    display: "flex",
                    "flex-direction": "column",
                    gap: rem(0.5),
                  }}
                >
                  <div
                    style={{
                      "font-weight": "600",
                      "font-size": "large",
                    }}
                  >
                    {mode}:
                  </div>
                  <For each={actions}>
                    {({ key, desc }) => {
                      return (
                        <Show when={true}>
                          <div
                            style={{
                              display: "flex",
                              "align-items": "center",
                              gap: rem(0.75),
                            }}
                          >
                            <KeyCombo combo={key} />
                            {desc}
                          </div>
                        </Show>
                      );
                    }}
                  </For>
                </div>
              </Show>
            );
          }}
        </For>
      </div>
    </Popup>
  );
}

function ActionSuggestion(props: {
  context: Context;
  keyInput: string;
  actionKeys: string[];
  actions: Actions;
}) {
  return (
    <Popup context={props.context}>
      <div
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: rem(0.75),
          padding: rem(1),
          "overflow-y": "auto",
        }}
        ref={(el) => {
          setTimeout(() => el.focus());
        }}
      >
        <For each={props.actionKeys}>
          {(key) => {
            const keys = () => getAllKeysFromCombo(key);
            const keysFromKeyInput = () => getAllKeysFromCombo(props.keyInput);
            const keyInputLength = () => keysFromKeyInput().length;
            const startsWithKeyInput = () => key.startsWith(props.keyInput);
            return (
              <Show when={startsWithKeyInput()}>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: rem(0.75),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: rem(0.25),
                    }}
                  >
                    <For each={keys()}>
                      {(key, index) => (
                        <Key
                          key={key}
                          style={{
                            opacity:
                              index() < keyInputLength() ? "0.5" : undefined,
                          }}
                        />
                      )}
                    </For>
                  </div>
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
    focusedIndex: number;
    children: JSX.Element;
  } & ComponentProps<"button">
) {
  const [props, rest] = splitProps(allProps, [
    "index",
    "focusedIndex",
    "children",
    "style",
    "class",
  ]);

  let itemElement: HTMLButtonElement | undefined;

  const isFocused = () => props.index === props.focusedIndex;

  createEffect(() => {
    if (isFocused() && itemElement) {
      itemElement.scrollIntoView({
        block: "nearest",
      });
    }
  });

  return (
    <button
      ref={itemElement}
      tabIndex={props.index !== 0 ? "-1" : undefined}
      classList={{
        "qs-btn": true,
        "qs-list-item": true,
        active: isFocused(),
      }}
      style={{
        display: "grid",
        "align-items": "center",
        gap: rem(0.125),
        "padding-block": rem(0.75),
        "padding-inline": rem(1.25),
        color: "inherit",
        "user-select": "none",
        "overflow-x": "clip",
        width: "100%",
        ...(typeof props.style !== "string" ? props.style || {} : {}),
      }}
      {...rest}
    >
      {props.children}
    </button>
  );
}

function VirtualizedList<Item extends unknown>(props: {
  items: Item[];
  focusedIndex: Accessor<number>;
  itemRenderFn: (item: Item, index: Accessor<number>) => JSX.Element;
  style?: JSX.CSSProperties;
  context: Context;
}) {
  const [itemSize, setItemSize] = createSignal(100);
  const [scrollOffset, setScrollOffset] = createSignal(0);
  const [containerClientHeight, setContainerClientHeight] = createSignal(0);

  function isVisible(index: number) {
    const containerHeight = containerClientHeight();
    const scroll = scrollOffset();
    const size = itemSize();
    const halfSize = size / 2;
    const itemTop = index * size;
    const itemBottom = itemTop + size;
    return (
      itemTop >= scroll - halfSize &&
      itemBottom <= containerHeight + scroll + size
    );
  }

  const length = createMemo(() => props.items.length);

  let container: HTMLDivElement | undefined;

  const context = props.context;

  return (
    <div
      ref={container}
      style={{
        ...(props.style ?? {}),
        position: "relative",
        "overflow-y": "scroll",
      }}
      onScroll={(event) => setScrollOffset(event.currentTarget.scrollTop)}
    >
      <div
        style={{
          "min-height": `${length() * itemSize()}px`,
        }}
      ></div>
      <For each={props.items}>
        {(item, i) => (
          <Show
            when={
              i() === 0 ||
              i() === length() - 1 ||
              i() === props.focusedIndex() ||
              isVisible(i())
            }
          >
            <div
              style={{
                position: "absolute",
                top: `${itemSize() * i()}px`,
                left: 0,
                width: "100%",
              }}
              ref={(el) => {
                if (i() !== 0) return;
                const resizeObserver = new ResizeObserver((entries) => {
                  if (entries.length !== 1) return;
                  const entry = entries[0];
                  const { contentBoxSize } = entry;
                  const size = contentBoxSize[0];
                  setItemSize(size.blockSize);
                  setContainerClientHeight(container!.clientHeight);
                  resizeObserver.disconnect();
                });
                resizeObserver.observe(el);
              }}
            >
              {props.itemRenderFn(item, i)}
            </div>
          </Show>
        )}
      </For>
      <Show when={context.shouldShowDebugInfo()}>
        <div style={{ position: "fixed", top: 0, right: rem(1) }}>
          {length()}; {scrollOffset()}
        </div>
      </Show>
    </div>
  );
}

function ListSearch<Item extends unknown>(props: {
  context: Context;
  items: Item[] | Accessor<Item[]>;
  filter: (item: Item, lowercaseQuery: string) => boolean;
  itemContent: (item: Item, isFocused: boolean, index: number) => JSX.Element;
  handleSelect: (item: Item, event: KeyboardEvent | MouseEvent) => void;
  onSelectionChange?: (item: Item) => void;
  itemProps?: ComponentProps<"button">;
  onClose?: () => void;
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
    const items =
      typeof props.items === "function" ? props.items() : props.items;
    if (q.length === 0) return items;
    const lowercaseQuery = q.toLowerCase();
    return items.filter((item) => props.filter(item, lowercaseQuery));
  });

  const focusedItem = createMemo(() => filtered()[focusedIndex()]);

  createEffect(() => {
    if (props.onSelectionChange) {
      props.onSelectionChange(focusedItem());
    }
  });

  const context = props.context;

  onMount(() => {
    const cleanupKeydownListener = context.registerKeydownListener((event) => {
      switch (getKeyRepresentation(event)) {
        case "escape":
          event.preventDefault();
          context.resetState(true);
          props.onClose?.();
          return true;
        case "pageup":
        case "pagedown":
          event.preventDefault();
          return true;
        case "home":
          setFocusedIndex(0);
          return true;
        case "end":
          setFocusedIndex(filtered().length - 1);
          return true;
        case "arrowdown":
          setFocusedIndex((index) => {
            const next = index + 1;
            const last = filtered().length - 1;
            if (next > last) {
              return 0;
            }
            return next;
          });
          return true;
        case "arrowup":
          setFocusedIndex((index) => {
            const prev = index - 1;
            if (prev < 0) {
              return filtered().length - 1;
            }
            return prev;
          });
          return true;
        default:
          return false;
      }
    });

    const cleanupKeyupListener = context.registerKeyupListener((event) => {
      switch (event.key) {
        case "Enter": {
          const item = focusedItem();
          if (item) {
            props.handleSelect(item, event);
          }
          return true;
        }
        default:
          return false;
      }
    });

    onCleanup(() => {
      cleanupKeydownListener();
      cleanupKeyupListener();
    });
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
      }}
    >
      <VirtualizedList
        context={context}
        items={filtered()}
        focusedIndex={focusedIndex}
        itemRenderFn={(item, index) => (
          <ClickableItemComp
            {...(props.itemProps ? props.itemProps : {})}
            index={index()}
            focusedIndex={focusedIndex()}
            onClick={(event) => props.handleSelect(item, event)}
          >
            {props.itemContent(item, index() === focusedIndex(), index())}
          </ClickableItemComp>
        )}
        style={{
          display: "flex",
          "flex-direction": "column",
          "padding-inline": 0,
        }}
      />
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
          "z-index": 1,
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

function SearchLinksAndButtons(props: { context: Context }) {
  let linkSearchContainer: HTMLDivElement | undefined;

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

  const [selectedItem, setSelectedItem] = createSignal<ClickableItem>();
  const openAction = {
    desc: "Open",
    fn: (item: ClickableItem) => {
      const element = item.element;
      handleElementInteraction(element, { type: ElementInteractionMode.Click });
    },
  };
  const focusAction = {
    desc: "Focus",
    fn: (item: ClickableItem) => {
      const element = item.element;
      handleElementInteraction(element, { type: ElementInteractionMode.Focus });
    },
  };
  const selectedItemActions = createMemo(() => {
    const actions = [openAction, focusAction];
    if (selectedItem()?.href) {
      actions.push(
        {
          desc: "Open in new tab",
          fn: (item: ClickableItem) => {
            const element = item.element;
            handleElementInteraction(element, {
              type: ElementInteractionMode.OpenInNewTab,
            });
          },
        },
        {
          desc: "Open in new window",
          fn: (item: ClickableItem) => {
            const element = item.element;
            handleElementInteraction(element, {
              type: ElementInteractionMode.OpenInNewTab,
              window: "new",
            });
          },
        },
        {
          desc: "Open in private window",
          fn: (item: ClickableItem) => {
            const element = item.element;
            handleElementInteraction(element, {
              type: ElementInteractionMode.OpenInNewTab,
              window: "private",
            });
          },
        }
      );
      if (import.meta.env.BROWSER === "firefox") {
        actions.push({
          desc: "Open in container",
          fn: (item: ClickableItem) => {
            const element = item.element;
            if (!linkSearchContainer) return;
            const _el = createElement("div");
            linkSearchContainer.parentElement!.appendChild(_el);
            const dispose = render(
              () => (
                <ContainerList
                  context={props.context}
                  handleSelect={(container) => {
                    handleElementInteraction(element, {
                      type: ElementInteractionMode.OpenInNewTab,
                      cookieStoreId: container.cookieStoreId,
                    });
                    dispose();
                  }}
                />
              ),
              _el
            );
          },
        });
      }
      actions.push({
        desc: "Copy link",
        fn: (item: ClickableItem) => {
          navigator.clipboard.writeText(item.href!);
        },
      });
    }
    return actions;
  });

  function handleSelect(item: ClickableItem) {
    setSelectedItem(item);
  }

  return (
    <div ref={linkSearchContainer}>
      <Popup
        context={props.context}
        style={{
          visibility: !!selectedItem() ? "hidden" : undefined,
        }}
      >
        <ListSearch
          context={props.context}
          items={items}
          filter={(a, lowercaseQuery) => {
            return (
              a.text.toLowerCase().includes(lowercaseQuery) ||
              a.href?.toLowerCase().includes(lowercaseQuery) ||
              false
            );
          }}
          itemContent={(item) => (
            <>
              <div
                class="qs-text-ellipsis"
                style={{
                  "font-weight": "bold",
                }}
                title={
                  item.text.trim().length > 0 ? item.text.trim() : "No title"
                }
              >
                {item.text.trim().length > 0 ? item.text.trim() : "No title"}
              </div>
              <div
                class="qs-text-ellipsis"
                style={{
                  "font-size": "smaller",
                }}
                title={item.href ?? "<button>"}
              >
                <Show when={item.href} fallback={"<button>"}>
                  {item.href}
                </Show>
              </div>
            </>
          )}
          handleSelect={handleSelect}
        />
      </Popup>
      <Show when={selectedItem()}>
        <Popup context={props.context}>
          <ListSearch
            context={props.context}
            items={selectedItemActions()}
            itemContent={({ desc }) => (
              <span
                class="qs-text-ellipsis"
                style={{ "font-weight": "bold" }}
                title={desc}
              >
                {desc}
              </span>
            )}
            filter={({ desc }, lq) => desc.toLowerCase().includes(lq)}
            handleSelect={({ fn }) => {
              const item = selectedItem();
              if (!item) return;
              fn(item);
              props.context.resetState(true);
            }}
          />
        </Popup>
      </Show>
    </div>
  );
}

function Toggle(props: {
  active: boolean;
  onChange: (active: boolean) => void;
  label: string;
  icon: JSX.Element;
  class?: string;
  style?: JSX.CSSProperties;
}) {
  return (
    <label
      title={props.label}
      class={"qs-focus-within " + props.class}
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        ...props.style,
      }}
    >
      <input
        class="qs-sr-only"
        type="checkbox"
        checked={props.active}
        onChange={(event) => {
          props.onChange(event.target.checked);
        }}
      />
      {props.icon}
      <span class="qs-sr-only">{props.label}</span>
    </label>
  );
}

const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function PlaybackRateMenu(props: {
  context: Context;
  media: HTMLMediaElement;
  closeMenu: () => void;
}) {
  const [focusedIndex, setFocusedIndex] = createSignal(
    playbackRates.findIndex((r) => r === props.media.playbackRate)
  );

  function selectRate(rate: number) {
    props.closeMenu();
    props.media.playbackRate = rate;
  }

  onMount(() => {
    const cleanup = props.context.registerKeydownListener((event) => {
      const key = getKeyRepresentation(event);
      switch (key) {
        case "arrowdown":
          event.preventDefault();
          setFocusedIndex((index) => {
            const next = index + 1;
            const last = playbackRates.length - 1;
            if (next > last) {
              return 0;
            }
            return next;
          });
          return true;
        case "arrowup":
          event.preventDefault();
          setFocusedIndex((index) => {
            const prev = index - 1;
            if (prev < 0) {
              return playbackRates.length - 1;
            }
            return prev;
          });
          return true;
        case "enter":
          event.preventDefault();
          const rate = playbackRates[focusedIndex()];
          selectRate(rate);
          return true;
        case "escape":
          return true;
        default:
          break;
      }
      return false;
    });
    onCleanup(() => cleanup());
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
      }}
    >
      <For each={playbackRates}>
        {(rate, index) => (
          <button
            classList={{
              "qs-btn": true,
              "qs-list-item": true,
              active: focusedIndex() === index(),
            }}
            style={{
              color: Colors["cb-light-90"],
              "font-size": rem(1),
              padding: `${rem(0.325)} ${rem(1.25)}`,
            }}
            onClick={() => selectRate(rate)}
          >
            {rate}x
          </button>
        )}
      </For>
    </div>
  );
}

function increaseMediaPlaybackRate(
  media: HTMLMediaElement,
  by = 0.25,
  max = 2.5
) {
  const currentRate = media.playbackRate;
  media.playbackRate = Math.min(currentRate + by, max);
}

function decreaseMediaPlaybackRate(media: HTMLMediaElement, by = 0.25) {
  const currentRate = media.playbackRate;
  media.playbackRate = Math.max(currentRate - by, 0);
}

function msFromSeconds(seconds: number) {
  return seconds * 1000;
}

function secondsFromMs(ms: number) {
  return ms / 1000;
}
function secondsFromMin(min: number) {
  return min * 60;
}
function secondsFromHrs(hrs: number) {
  return hrs * 60 * 60;
}

// adapted from: https://stackoverflow.com/a/19700358
function msToTime(duration: number) {
  let seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  return `${hours < 10 ? "0" + hours : hours}:${
    minutes < 10 ? "0" + minutes : minutes
  }:${seconds < 10 ? "0" + seconds : seconds}`;
}

// TODO: make it much thinner
// and add vim style keybinds
function MediaControls(props: {
  context: Context;
  media: HTMLMediaElement;
  close: () => void;
}) {
  const [isCommandMode, setIsCommandMode] = createSignal(false);
  const [command, setCommand] = createSignal("");

  const [isPlaying, setIsPlaying] = createSignal(!props.media.paused);
  const [currentTime, setCurrentTime] = createSignal(props.media.currentTime);
  const [duration, setDuration] = createSignal(props.media.duration);
  const [playbackRate, setPlaybackRate] = createSignal(
    props.media.playbackRate
  );
  const [volume, setVolume] = createSignal(props.media.volume);
  const [muted, setMuted] = createSignal(props.media.muted);
  const [loop, setLoop] = createSignal(props.media.loop);
  const [showNativeControls, setShowNativeControls] = createSignal(
    props.media.controls
  );

  const [isPlaybackRateMenuOpen, setIsPlaybackRateMenuOpen] =
    createSignal(false);

  let popup: HTMLDivElement | undefined;
  let commandInput: HTMLInputElement | undefined;
  let playbackRateButton: HTMLButtonElement | undefined;
  const [playbackRateMenuPos, setPlaybackRateMenuPos] = createSignal<
    { minWidth: number; bottom: number; right: number } | undefined
  >();

  function toggleMuted() {
    props.media.muted = !props.media.muted;
  }
  function togglePlay() {
    const media = props.media;
    if (isPlaying()) {
      media.pause();
    } else {
      media.play();
    }
  }
  function toggleLoop() {
    setLoop((props.media.loop = !props.media.loop));
  }
  function toggleNativeControls() {
    setShowNativeControls((props.media.controls = !props.media.controls));
  }

  function getSecondsFromArg(arg: string): number {
    if (!arg) return NaN;
    let by = parseFloat(arg);
    if (!Number.isNaN(by)) {
      if (arg.endsWith("ms")) {
        by = secondsFromMs(by);
      } else if (arg.endsWith("m") || arg.endsWith("min")) {
        by = secondsFromMin(by);
      } else if (arg.endsWith("h") || arg.endsWith("hr")) {
        by = secondsFromHrs(by);
      }
    }
    return by;
  }

  function handleCommand(commandStr: string) {
    try {
      commandStr = commandStr.slice(1); // remove ':' from start
      let [command, arg] = commandStr.split(" ");
      if (!command) {
        return;
      }
      command = command.toLowerCase();
      switch (command) {
        case "rate":
        case "r": {
          if (!arg) return;
          const rate = parseFloat(arg);
          if (Number.isNaN(rate)) return;
          props.media.playbackRate = Math.max(rate, 0.1);
          return;
        }
        case "m":
        case "muted":
          toggleMuted();
          return;
        case "v":
        case "volume": {
          if (!arg) return;
          let volume = parseFloat(arg);
          if (Number.isNaN(volume)) return;
          if (volume > 1) {
            volume = volume / 100; // normalize
          }
          props.media.volume = volume;
          return;
        }
        case "l":
        case "loop":
          toggleLoop();
          return;
        case "p":
        case "play":
        case "pause":
          togglePlay();
          return;
        case "f":
        case "fwd": {
          const by = getSecondsFromArg(arg);
          if (Number.isNaN(by)) return;
          props.media.currentTime = Math.min(
            props.media.currentTime + by,
            props.media.duration
          );
          return;
        }
        case "b":
        case "bwd": {
          const by = getSecondsFromArg(arg);
          if (Number.isNaN(by)) return;
          props.media.currentTime = Math.max(props.media.currentTime - by, 0);
          return;
        }
        case "ctl":
          toggleNativeControls();
          return;
      }
    } finally {
      setCommand("");
      setIsCommandMode(false);
    }
  }

  onMount(() => {
    const controller = new AbortController();

    if (props.media.volume > 0.15) {
      props.media.volume = 0.15;
    }

    if (popup) {
      popup.focus();

      if (playbackRateButton) {
        const rateBtnRect = playbackRateButton.getBoundingClientRect();
        setPlaybackRateMenuPos({
          minWidth: rateBtnRect.width,
          // bottom: popupRect.bottom - rateBtnRect.bottom + rateBtnRect.height,
          bottom: window.innerHeight - rateBtnRect.top,
          // right: popupRect.right - rateBtnRect.right,
          right: document.documentElement.clientWidth - rateBtnRect.right,
        });
      }

      document.addEventListener(
        "focusout",
        (e) => {
          const el = e.relatedTarget as HTMLElement;
          const contains = popup.contains(el);
          if (!contains) {
            popup.querySelector("input")?.focus();
          }
        },
        {
          signal: controller.signal,
        }
      );
    }

    createEffect(() => {
      if (isCommandMode()) {
        commandInput?.focus();
      }
    });

    createEffect(() => {
      const _command = command();
      if (!_command.startsWith(":")) {
        setCommand(":" + _command);
      }
    });

    props.media.addEventListener(
      "play",
      () => {
        setIsPlaying(true);
        setLoop(props.media.loop);
      },
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "pause",
      () => {
        setIsPlaying(false);
        setLoop(props.media.loop);
      },
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "durationchange",
      () => setDuration(props.media.duration),
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "ratechange",
      () => setPlaybackRate(props.media.playbackRate),
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "timeupdate",
      () => setCurrentTime(props.media.currentTime),
      {
        signal: controller.signal,
      }
    );

    props.media.addEventListener(
      "volumechange",
      () => {
        setVolume(props.media.volume);
        setMuted(props.media.muted);
      },
      {
        signal: controller.signal,
      }
    );

    //
    // maybe allow registering actions instead of having to handle keydown directly?
    //
    const cleanupKeydownListener = props.context.registerKeydownListener(
      (event) => {
        const key = getKeyRepresentation(event);
        if (isCommandMode()) {
          switch (key) {
            case "escape":
              event.preventDefault();
              event.stopImmediatePropagation();
              setIsCommandMode(false);
            case "enter":
              event.preventDefault();
              event.stopImmediatePropagation();
              handleCommand(command());
          }
          return true;
        }
        switch (key) {
          case "S-:": {
            event.preventDefault();
            event.stopImmediatePropagation();
            setIsCommandMode(true);
            return true;
          }
          case "<leader>": {
            const input = (event.target as HTMLElement).closest("input");
            if (input && input.type !== "range") {
              return false;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            togglePlay();
            return true;
          }
          case "S-<": {
            event.preventDefault();
            event.stopImmediatePropagation();
            decreaseMediaPlaybackRate(props.media);
            return true;
          }
          case "S->": {
            event.preventDefault();
            event.stopImmediatePropagation();
            increaseMediaPlaybackRate(props.media);
            return true;
          }
          case "m": {
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleMuted();
            return true;
          }
          case "j":
          case "arrowdown": {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (document.activeElement === playbackRateButton) {
              const currentRateIndex = playbackRates.findIndex(
                (v) => v === playbackRate()
              );
              const nextRate = playbackRates[currentRateIndex + 1];
              if (nextRate !== undefined) {
                props.media.playbackRate = nextRate;
              }
            } else {
              props.media.volume = Math.max(props.media.volume - 0.05, 0);
            }
            return true;
          }
          case "k":
          case "arrowup": {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (document.activeElement === playbackRateButton) {
              const currentRateIndex = playbackRates.findIndex(
                (v) => v === playbackRate()
              );
              const prevRate = playbackRates[currentRateIndex - 1];
              if (prevRate !== undefined) {
                props.media.playbackRate = prevRate;
              }
            } else {
              props.media.volume = Math.min(props.media.volume + 0.05, 1);
            }
            return true;
          }
          case "h":
          case "arrowleft": {
            event.preventDefault();
            event.stopImmediatePropagation();
            props.media.currentTime = Math.max(props.media.currentTime - 5, 0);
            return true;
          }
          case "l":
          case "arrowright": {
            event.preventDefault();
            event.stopImmediatePropagation();
            props.media.currentTime = Math.min(
              props.media.currentTime + 5,
              props.media.duration
            );
            return true;
          }
          case ",": {
            event.preventDefault();
            event.stopImmediatePropagation();
            props.media.currentTime = Math.max(
              props.media.currentTime - 0.1,
              0
            );
            return true;
          }
          case ".": {
            event.preventDefault();
            event.stopImmediatePropagation();
            props.media.currentTime = Math.min(
              props.media.currentTime + 0.1,
              props.media.duration
            );
            return true;
          }
          case "escape": {
            event.preventDefault();
            event.stopImmediatePropagation();
            props.close();
            return true;
          }
          default:
            break;
        }
        return false;
      }
    );

    const cleanupKeyupListener = props.context.registerKeyupListener(
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    );

    onCleanup(() => {
      controller.abort();
      cleanupKeydownListener();
      cleanupKeyupListener();
    });
  });

  const formattedCurrentTime = createMemo(() => {
    return msToTime(msFromSeconds(currentTime()));
  });

  const formattedDurationTime = createMemo(() => {
    return msToTime(msFromSeconds(duration()));
  });

  const IconSize = {
    width: rem(1.15),
    height: rem(1.15),
    "flex-shrink": 0,
  };

  return (
    <div
      tabIndex={-1}
      ref={popup}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        "z-index": 69420,

        background: Colors["cb-dark-70"],
        color: Colors["cb-light-90"],
        "font-family": "sans-serif",
        "font-size": "14px",
      }}
    >
      <input
        ref={commandInput}
        style={{
          display: isCommandMode() ? "" : "none",
          width: "100%",
          appearance: "none",
          background: "transparent",
          color: "inherit",
          padding: rem(0.1),
        }}
        value={command()}
        onInput={(e) => {
          setCommand(e.target.value);
        }}
      />
      <div
        style={{
          display: isCommandMode() ? "none" : "flex",
          "align-items": "center",
          gap: rem(0.5),
          padding: `${rem(0.15)} ${rem(0.25)}`,
        }}
      >
        <Toggle
          active={isPlaying()}
          onChange={togglePlay}
          label={isPlaying() ? "Playing" : "Paused"}
          icon={
            isPlaying() ? (
              <PauseIcon style={IconSize} />
            ) : (
              <PlayIcon style={IconSize} />
            )
          }
        />
        <Toggle
          active={muted()}
          onChange={() => (props.media.muted = !props.media.muted)}
          label={muted() ? "Muted" : "Unmuted"}
          icon={
            muted() ? (
              <MuteIcon style={IconSize} />
            ) : (
              <VolumeIcon style={IconSize} />
            )
          }
        />
        <input
          type="range"
          step={0.01}
          value={volume()}
          max={1}
          style={{ "max-width": rem(5) }}
          onChange={(event) => {
            const target = event.target;
            props.media.volume = parseFloat(target.value);
          }}
        />
        <Toggle
          active={loop()}
          onChange={() => toggleLoop()}
          icon={<LoopIcon style={IconSize} />}
          label={loop() ? "Disable looping" : "Loop"}
          style={{ background: loop() ? Colors["cb-dark-20"] : "" }}
        />
        <div style={{ "margin-left": rem(0.25) }}>
          <span>{formattedCurrentTime()}</span>
          <span style={{ "margin-inline": rem(0.25) }}>/</span>
          <span>{formattedDurationTime()}</span>
        </div>
        <button
          popoverTarget="playback-rate-menu"
          style={{
            appearance: "none",
            background: isPlaybackRateMenuOpen()
              ? Colors["cb-dark-50"]
              : "transparent",
            color: "inherit",
            border: "none",
            padding: rem(0.1),
            "font-size": "inherit",
          }}
          ref={playbackRateButton}
          onClick={() => setIsPlaybackRateMenuOpen((open) => !open)}
        >
          <div class="qs-sr-only">Playback speed:</div>
          {playbackRate()}x
        </button>
        <div class="qs-text-ellipsis" style={{ "max-width": "30%" }}>
          {props.media.src}
        </div>
        <input
          type="range"
          step={0.01}
          value={currentTime()}
          max={duration()}
          style={{ "flex-grow": "1" }}
          onChange={(event) => {
            const target = event.target;
            props.media.currentTime = parseFloat(target.value);
          }}
        />
        <Toggle
          active={showNativeControls()}
          onChange={toggleNativeControls}
          icon={<AdjustmentsHorizontalIcon style={IconSize} />}
          label={
            showNativeControls()
              ? "Hide native controls"
              : "Show native controls"
          }
          style={{
            background: showNativeControls() ? Colors["cb-dark-20"] : "",
          }}
        />
        <Show when={playbackRateMenuPos()}>
          {(pos) => (
            <div
              popover
              id="playback-rate-menu"
              style={{
                position: "fixed",
                inset: "unset",
                right: `${pos().right}px`,
                bottom: `${pos().bottom - 1}px`,
                "min-width": `${pos().minWidth}px`,
                transition: "opacity 50ms",
                opacity: isPlaybackRateMenuOpen() ? 1 : 0,

                border: `2px solid ${Colors["cb-dark-50"]}`,
                "border-bottom": "0px",
                "border-radius": rem(0.25),
                "border-bottom-right-radius": isPlaybackRateMenuOpen()
                  ? "0px"
                  : undefined,
                background: PopupStyles["background"],
                color: Colors["cb-light-90"],
                padding: 0,
              }}
              onToggle={({ newState }) =>
                setIsPlaybackRateMenuOpen(newState === "open")
              }
            >
              <Show when={isPlaybackRateMenuOpen()}>
                <PlaybackRateMenu
                  context={props.context}
                  media={props.media}
                  closeMenu={() =>
                    document.getElementById("playback-rate-menu")?.hidePopover()
                  }
                />
              </Show>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

function MediaList(props: {
  context: Context;
  mediaElements: HTMLMediaElement[];
  onClose: () => void;
}) {
  const [selectedMedia, setSelectedMedia] =
    createSignal<HTMLMediaElement | null>(null);

  return (
    <>
      <Show when={!selectedMedia()}>
        <Popup context={props.context}>
          <ListSearch
            context={props.context}
            items={props.mediaElements}
            itemContent={(item) => (
              <span class="qs-text-ellipsis" title={item.src}>
                {item.src}
              </span>
            )}
            filter={(media, lq) => media.src.toLowerCase().includes(lq)}
            handleSelect={function selectMedia(media) {
              setSelectedMedia(media);
            }}
            onClose={props.onClose}
          />
        </Popup>
      </Show>
      <Show when={selectedMedia()}>
        <MediaControls
          context={props.context}
          media={selectedMedia()!}
          close={() => {
            setSelectedMedia(null);
          }}
        />
      </Show>
    </>
  );
}

function ImageList(props: { context: Context }) {
  const imageElements: HTMLImageElement[] = [];
  for (const image of document.querySelectorAll("img")) {
    if (!(image instanceof HTMLImageElement)) continue;
    imageElements.push(image);
  }

  const [selectedImage, setSelectedImage] =
    createSignal<HTMLImageElement | null>(null);

  const imageActions = [
    {
      name: "Open in new tab",
      fn: function openTab() {
        const image = selectedImage();
        if (!image) return;
        sendMessage("openNewTab", {
          url: image.src,
          background: false,
          position: "after",
        });
      },
    },
    {
      name: "Click",
      fn: function openTab() {
        const image = selectedImage();
        if (!image) return;
        image.click();
      },
    },
    {
      name: "Copy link",
      fn: function openTab() {
        const image = selectedImage();
        if (!image) return;
        navigator.clipboard.writeText(image.src);
      },
    },
  ];

  return (
    <>
      <Show when={!selectedImage()}>
        <Popup
          context={props.context}
          style={{
            visibility: !!selectedImage() ? "hidden" : undefined,
          }}
        >
          <ListSearch
            context={props.context}
            items={imageElements}
            itemContent={(item) => (
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "1rem",
                  overflow: "hidden",
                }}
              >
                <img
                  src={item.src}
                  style={{
                    width: "1.75rem",
                    height: "1.75rem",
                  }}
                />
                <span class="qs-text-ellipsis" title={item.src}>
                  {item.src}
                </span>
              </div>
            )}
            filter={(media, lq) => media.src.toLowerCase().includes(lq)}
            handleSelect={function selectImage(media) {
              setSelectedImage(media);
            }}
          />
        </Popup>
      </Show>
      <Show when={selectedImage()}>
        <Popup context={props.context}>
          <ListSearch
            context={props.context}
            items={imageActions}
            itemContent={(item) => (
              <span
                class="qs-text-ellipsis"
                style={{ "font-weight": "bold" }}
                title={item.name}
              >
                {item.name}
              </span>
            )}
            filter={({ name }, lq) => name.toLowerCase().includes(lq)}
            handleSelect={(action) => {
              props.context.resetState(true);
              action.fn();
            }}
          />
        </Popup>
      </Show>
    </>
  );
}

function TabList(props: { context: Context; cookieStoreId?: string }) {
  const [tabs] = createResource(async function getAllTabs() {
    const cookieStoreId = props.cookieStoreId;
    const response = await sendMessage(
      "getAllTabs",
      cookieStoreId ? { cookieStoreId } : undefined
    );
    if (!Array.isArray(response)) {
      throw new Error("Did not receive correct response");
    }
    return response;
  });
  const [containers] = createResource(async function getAllContainers() {
    if (import.meta.env.BROWSER !== "firefox") {
      return;
    }
    const response = await sendMessage("getAllContainers", undefined);
    if (!Array.isArray(response)) return;
    const containersMap: Record<string, Container> = {};
    for (const container of response) {
      containersMap[container.cookieStoreId] = { ...container };
    }
    return containersMap;
  });

  const [selectedTab, setSelectedTab] = createSignal<Browser.tabs.Tab>();

  const tabActions = [
    {
      name: "Open tab",
      fn: function openTab() {
        const tab = selectedTab();
        if (!tab) return;
        sendMessage("activateTab", tab.id);
      },
    },
    {
      name: "Close tab",
      fn: function closeTab() {
        const tab = selectedTab();
        if (!tab) return;
        sendMessage("closeTab", tab.id);
      },
    },
    {
      name: "Duplicate tab",
      fn: function closeTab() {
        const tab = selectedTab();
        if (!tab) return;
        sendMessage("duplicateTab", tab.id);
      },
    },
    {
      name: "Move next to current tab",
      fn: function moveTabNextToCurrentTab() {
        const tab = selectedTab();
        if (!tab) return;
        sendMessage("moveTabNextToCurrentTab", tab.id);
      },
    },
    {
      name: "Move tab to new window",
      fn: function moveTabToNewWindow() {
        const tab = selectedTab();
        if (!tab) return;
        sendMessage("moveTabToNewWindow", tab.id);
      },
    },
    {
      name: "Re-open in private window",
      fn: function reopenInPrivateWindow() {
        const tab = selectedTab();
        if (!tab) return;
        sendMessage("reopenTabInPrivateWindow", tab.id);
      },
    },
  ];

  return (
    <Show when={tabs()}>
      <Popup
        context={props.context}
        style={{
          visibility: !!selectedTab() ? "hidden" : undefined,
        }}
      >
        <ListSearch
          context={props.context}
          items={tabs()!}
          itemContent={(tab) => (
            <>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "1rem",
                  overflow: "hidden",
                }}
              >
                <div
                  class="qs-text-ellipsis"
                  style={{ "font-weight": "bold", "flex-grow": "1" }}
                  title={tab.title}
                >
                  {tab.title}
                </div>
                <Show when={"cookieStoreId" in tab && !props.cookieStoreId}>
                  <div
                    style={{
                      "font-size": "small",
                      background:
                        //@ts-expect-error firefox-only property
                        containers()?.[tab.cookieStoreId]?.colorCode ||
                        undefined,
                      color: "black",
                      "border-radius": rem(0.5),
                      padding: `${rem(0.15)} ${rem(0.35)}`,
                      "flex-shrink": "0",
                    }}
                  >
                    {
                      //@ts-expect-error firefox-only property
                      containers()?.[tab.cookieStoreId]?.name
                    }
                  </div>
                </Show>
              </div>
              <div
                class="qs-text-ellipsis"
                style={{
                  "font-size": "smaller",
                  "grid-row": "2",
                }}
                title={tab.url}
              >
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
            setSelectedTab(item);
          }}
        />
      </Popup>
      <Show when={selectedTab()}>
        <Popup context={props.context}>
          <ListSearch
            context={props.context}
            items={tabActions}
            itemContent={(item) => (
              <span
                class="qs-text-ellipsis"
                style={{ "font-weight": "bold" }}
                title={item.name}
              >
                {item.name}
              </span>
            )}
            filter={({ name }, lq) => name.toLowerCase().includes(lq)}
            handleSelect={(action) => {
              props.context.resetState(true);
              action.fn();
            }}
          />
        </Popup>
      </Show>
    </Show>
  );
}

function ContainerList(props: {
  context: Context;
  handleSelect?: (item: Container) => void;
}) {
  const [containers] = createResource(async function getAllTabs() {
    const response = await sendMessage("getAllContainers", undefined);
    if (!Array.isArray(response)) {
      throw new Error("Did not receive correct response");
    }
    return response;
  });

  const [selectedContainer, setSelectedContainer] = createSignal<Container>();
  const [shouldShowTabList, toggleTabList] = createSignal(false);

  const containerActions = [
    {
      name: "New tab in container",
      fn: function openNewTabInContainer() {
        const container = selectedContainer();
        if (!container) return;
        sendMessage("openNewTab", {
          background: false,
          cookieStoreId: container.cookieStoreId,
        });
        props.context.resetState(true);
      },
    },
    {
      name: "Highlight links to open in container",
      fn: function highlightLinksToOpenInContainer() {
        const container = selectedContainer();
        if (!container) return;
        props.context.resetState(true);
        props.context.highlightElementsBySelector("a", {
          interaction: {
            type: ElementInteractionMode.OpenInNewTab,
            cookieStoreId: container.cookieStoreId,
          },
        });
      },
    },
    {
      name: "List open tabs",
      fn: function listOpenTabsForContainer() {
        const container = selectedContainer();
        if (!container) return;
        toggleTabList(true);
      },
    },
  ];

  return (
    <Show when={containers()}>
      <Popup
        context={props.context}
        style={{
          visibility: !!selectedContainer() ? "hidden" : undefined,
        }}
      >
        <ListSearch
          context={props.context}
          items={containers()!}
          itemContent={(container) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "1rem",
                overflow: "hidden",
              }}
            >
              <div
                role="presentation"
                style={{
                  width: "1rem",
                  height: "1rem",
                  "border-radius": "100%",
                  "background-color": container.colorCode || "#fff",
                  "flex-shrink": 0,
                }}
              />
              <span
                class="qs-text-ellipsis"
                style={{ "flex-grow": 1 }}
                title={container.name}
              >
                {container.name}
              </span>
              <div style={{ "flex-shrink": 0, opacity: "0.65" }}>
                <div class="qs-sr-only">Open tabs:</div>
                {container.openTabs}
              </div>
            </div>
          )}
          filter={(item, lowercaseQuery) =>
            Boolean(item.name.toLowerCase().includes(lowercaseQuery))
          }
          handleSelect={
            props.handleSelect
              ? props.handleSelect
              : (item) => {
                  setSelectedContainer(item);
                }
          }
        />
      </Popup>
      <Show when={selectedContainer() && !shouldShowTabList()}>
        <Popup context={props.context}>
          <ListSearch
            context={props.context}
            items={containerActions}
            itemContent={(item) => (
              <span
                class="qs-text-ellipsis"
                style={{ "font-weight": "bold" }}
                title={item.name}
              >
                {item.name}
              </span>
            )}
            filter={({ name }, lq) => name.toLowerCase().includes(lq)}
            handleSelect={(action) => {
              action.fn();
            }}
          />
        </Popup>
      </Show>
      <Show when={selectedContainer() && shouldShowTabList()}>
        <TabList
          context={props.context}
          cookieStoreId={selectedContainer()!.cookieStoreId}
        />
      </Show>
    </Show>
  );
}

function noop() {}

function DebugList(props: { context: Context }) {
  const debug: number[] = [];
  for (let i = 0; i < 5000; i++) {
    debug.push(i);
  }
  return (
    <Popup context={props.context}>
      <ListSearch
        context={props.context}
        items={debug}
        filter={(i, lq) => i.toString().includes(lq)}
        itemContent={(i) => (
          <div
            style={{
              background: i % 2 === 0 ? "cornflowerblue" : "blueviolet",
            }}
          >
            {i}
          </div>
        )}
        handleSelect={noop}
      />
    </Popup>
  );
}

function CommandPalette(props: {
  context: Context;
  actions: Actions;
  getCurrentElement: () => HTMLElement | null;
  showDebugList: () => boolean;
  showConfig: () => void;
}) {
  const commands: {
    desc: string;
    fn: (event: KeyboardEvent | MouseEvent) => void;
    key?: string;
  }[] = [];

  for (const [key, action] of Object.entries(props.actions)) {
    commands.push({
      desc: action.desc,
      fn: action.fn,
      key,
    });
  }

  if (!import.meta.env.PROD) {
    commands.push({
      desc: "Show debug list",
      fn: props.showDebugList,
    });
  }

  commands.push({
    desc: "Toggle debug info",
    fn: props.context.toggleDebugInfo,
  });

  commands.push({
    desc: "Configuration",
    fn: props.showConfig,
  });

  commands.push({
    desc: "Interact using custom selector",
    fn: () => {
      const popupRoot = props.context.popupRoot();
      if (!popupRoot) return;
      const dispose = render(
        () => (
          <InteractWithCustomSelector
            context={props.context}
            onClose={() => dispose()}
          />
        ),
        popupRoot
      );
    },
  });

  function handleSelect(
    item: (typeof commands)[number],
    event: KeyboardEvent | MouseEvent
  ) {
    props.context.resetState(true);
    item.fn(event);
  }

  return (
    <Popup context={props.context}>
      <ListSearch
        context={props.context}
        items={commands}
        itemContent={(item) => (
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              gap: rem(1),
            }}
          >
            <div class="qs-text-ellipsis" title={item.desc}>
              {item.desc}
            </div>
            <Show when={item.key}>
              <KeyCombo combo={item.key!} />
            </Show>
          </div>
        )}
        filter={({ key, desc }, lowercaseQuery) => {
          return Boolean(
            key?.toLowerCase().includes(lowercaseQuery) ||
              desc.toLowerCase().includes(lowercaseQuery)
          );
        }}
        handleSelect={handleSelect}
      />
    </Popup>
  );
}

function InteractionMenu(props: {
  element: HTMLElement;
  context: Context;
  onSelect: () => void;
  onClose: () => void;
}) {
  const interactions = [
    {
      desc: "Click",
      fn: () => {
        handleElementInteraction(props.element, {
          type: ElementInteractionMode.Click,
        });
      },
    },
    {
      desc: "Double-click",
      fn: () => {
        handleElementInteraction(props.element, {
          type: ElementInteractionMode.DoubleClick,
        });
      },
    },
    {
      desc: "Focus",
      fn: () => {
        handleElementInteraction(props.element, {
          type: ElementInteractionMode.Focus,
        });
      },
    },
    {
      desc: "Hover",
      fn: () => {
        handleElementInteraction(props.element, {
          type: ElementInteractionMode.Hover,
        });
      },
    },
  ];

  if (isAnchorElement(props.element)) {
    interactions.push(
      {
        desc: "Copy link",
        fn: () => {
          navigator.clipboard.writeText(
            (props.element as HTMLAnchorElement).href
          );
        },
      },
      {
        desc: "Open in new tab",
        fn: () => {
          handleElementInteraction(props.element, {
            type: ElementInteractionMode.OpenInNewTab,
          });
        },
      },
      {
        desc: "Open in new window",
        fn: () => {
          handleElementInteraction(props.element, {
            type: ElementInteractionMode.OpenInNewTab,
            window: "new",
          });
        },
      },
      {
        desc: "Open in private window",
        fn: () => {
          handleElementInteraction(props.element, {
            type: ElementInteractionMode.OpenInNewTab,
            window: "private",
          });
        },
      }
    );
  }

  function handleSelect(item: (typeof interactions)[number]) {
    item.fn();
    props.context.resetState(true);
    props.onSelect();
  }

  return (
    <Popup context={props.context}>
      <ListSearch
        context={props.context}
        items={interactions}
        itemContent={(item) => (
          <div class="qs-text-ellipsis" title={item.desc}>
            {item.desc}
          </div>
        )}
        filter={({ desc }, query) => desc.toLowerCase().includes(query)}
        handleSelect={handleSelect}
        onClose={props.onClose}
      />
    </Popup>
  );
}

function CustomSelectorsMenu(props: {
  context: Context;
  onSelect: (selector: string) => void;
  onClose: () => void;
}) {
  return (
    <Popup context={props.context}>
      <input
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
          "z-index": 1,
        }}
        ref={(el) => setTimeout(() => el.focus())}
        onKeyUp={(event) => {
          const key = event.key;
          if (key === "Enter") {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            const selector = target.value;
            target.value = "";
            if (!selector) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            props.onSelect(selector);
          } else if (isEscapeKey(key)) {
            props.onClose();
          }
        }}
      />
    </Popup>
  );
}

function InteractWithCustomSelector(props: {
  context: Context;
  onClose: () => void;
}) {
  const [elements, setElements] = createSignal<
    {
      name: string;
      element: HTMLElement;
    }[]
  >([]);
  const [selectedElement, setSelectedElement] = createSignal<HTMLElement>();

  let rectVisualizer: HTMLDivElement | undefined;

  function setElementsFromSelector(selector: string) {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selector)
    );
    setElements(
      elements.map((element) => {
        const name = `<${element.tagName.toLowerCase()}> ${element.textContent?.slice(
          0,
          25
        )}`;
        return {
          name,
          element,
        };
      })
    );
  }

  return (
    <Show
      when={selectedElement()}
      fallback={
        <Show
          when={elements().length > 0}
          fallback={
            <CustomSelectorsMenu
              context={props.context}
              onSelect={(selector) => {
                setElementsFromSelector(selector);
              }}
              onClose={props.onClose}
            />
          }
        >
          <Popup context={props.context}>
            <ListSearch
              context={props.context}
              items={elements()}
              itemContent={(item) => (
                <div class="qs-text-ellipsis" title={item.name}>
                  {item.name}
                </div>
              )}
              filter={({ name }, query) => name.toLowerCase().includes(query)}
              handleSelect={({ element }) => {
                setSelectedElement(element);
              }}
              onSelectionChange={({ element }) => {
                if (!rectVisualizer) return;
                element.scrollIntoView();
                const rect = element.getBoundingClientRect();
                rectVisualizer.style.width = `${rect.width || 20}px`;
                rectVisualizer.style.height = `${rect.height || 20}px`;
                rectVisualizer.style.translate = `${rect.x}px ${rect.y}px`;
              }}
              onClose={props.onClose}
            />
          </Popup>
          <div
            ref={rectVisualizer}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              background: "rgba(169, 69, 69, 0.25)",
              translate: "0px 0px",
            }}
          />
        </Show>
      }
    >
      <Popup context={props.context}>
        <InteractionMenu
          context={props.context}
          element={selectedElement()!}
          onSelect={props.onClose}
          onClose={() => setSelectedElement(undefined)}
        />
      </Popup>
    </Show>
  );
}

function Config(props: { context: Context }) {
  const [config, setConfig] = createSignal<ConfigV1>();
  storedConfig.getValue().then(setConfig);

  function storeConfig() {
    storedConfig.setValue(config()!);
  }

  let closeButton: HTMLButtonElement | undefined;
  onMount(() => {
    closeButton?.focus();

    const unwatch = storedConfig.watch(setConfig);
    onCleanup(() => {
      unwatch();
    });
  });

  return (
    <Show when={config()}>
      <Popup
        context={props.context}
        style={{
          padding: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "space-between",
            gap: "1rem",
            "margin-bottom": "1rem",
          }}
        >
          <div
            style={{
              "font-weight": "bold",
            }}
          >
            Configuration
          </div>
          <button
            class="qs-btn qs-outline-btn"
            style={{
              display: "flex",
              padding: rem(0.25),
            }}
            onClick={() => props.context.resetState(true)}
            ref={closeButton}
          >
            <XMarkIcon
              style={{
                width: rem(1.25),
                height: rem(1.25),
                color: Colors["cb-light-90"],
              }}
            />
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            storeConfig();
          }}
        >
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "margin-bottom": rem(0.5),
              gap: rem(0.5),
            }}
          >
            <label for="int-el-sel">Interactive elements selector:</label>
            <input
              id="int-el-sel"
              type="text"
              value={config()?.interactiveElementsSelector}
              onInput={(event) => {
                setConfig((prev) => ({
                  ...prev,
                  interactiveElementsSelector: event.target.value,
                }));
              }}
            />
            <button
              type="button"
              class="qs-btn qs-outline-btn"
              style={{
                "align-self": "start",
                color: Colors["cb-light-90"],
                padding: `${rem(0.25)} ${rem(0.35)}`,
              }}
              onClick={() => {
                setConfig((prev) => ({
                  ...prev,
                  interactiveElementsSelector:
                    DefaultInteractiveElementsSelector,
                }));
              }}
            >
              Reset to default
            </button>
          </div>
          <button
            type="submit"
            class="qs-btn qs-outline-btn"
            style={{
              "align-self": "start",
              color: Colors["cb-light-90"],
              padding: `${rem(0.25)} ${rem(0.35)}`,
            }}
          >
            Save
          </button>
        </form>
      </Popup>
    </Show>
  );
}

function Root() {
  let highlightsContainer: HTMLDivElement | undefined;
  let visualModeContainer: HTMLDivElement | undefined;
  let collapsedCaret: HTMLDivElement | undefined;

  const wordSegmenter = new Intl.Segmenter(
    document.documentElement.lang || "en",
    {
      granularity: "word",
    }
  );

  const state: {
    highlightInput: string;
    highlightInteractionMode: ElementInteraction;
    jumpToCharacter: {
      char: string | null;
      waitingForInput: boolean;
      pos: "before" | "after";
    };
    popupRoot: HTMLDivElement | undefined;
  } = {
    highlightInput: "",
    highlightInteractionMode: { type: ElementInteractionMode.Click },
    jumpToCharacter: {
      char: null,
      waitingForInput: false,
      pos: "before",
    },
    popupRoot: undefined,
  };

  let config: ConfigV1 = {
    interactiveElementsSelector: DefaultInteractiveElementsSelector,
  };
  storedConfig.getValue().then((cfg) => {
    config = cfg;
  });
  storedConfig.watch((newConfig) => {
    config = newConfig;
  });

  const [currentMode, setCurrentMode] = createSignal(Mode.Normal);

  const [isPassthrough, setIsPassthrough] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal("");

  const [shouldShowActionHelp, toggleActionHelp] = createSignal(false);
  const [shouldShowLinkAndButtonList, setShowListAndButtonList] =
    createSignal(false);
  const [shouldShowTabList, toggleTabList] = createSignal(false);
  const [shouldShowImageList, toggleImageList] = createSignal(false);
  const [shouldShowDebugList, toggleDebugList] = createSignal(false);
  const [shouldShowCommandPalette, toggleCommandPalette] = createSignal(false);
  const [shouldShowConfig, toggleConfig] = createSignal(false);
  const [shouldShowContainerList, toggleContainerList] = createSignal(false);

  const [shouldShowDebugInfo, setShouldShowDebugInfo] = createSignal(false);
  createEffect(() => {
    if (shouldShowDebugInfo()) {
      enableLogging();
    } else {
      disableLogging();
    }
  });

  function hideAllPopups() {
    toggleActionHelp(false);
    setShowListAndButtonList(false);
    toggleTabList(false);
    toggleImageList(false);
    toggleCommandPalette(false);
    toggleDebugList(false);
    toggleConfig(false);
    toggleContainerList(false);
  }

  const idToHighlightElementMap = new Map<string, HTMLElement>();
  const elementToHighlightMap = new WeakMap<HTMLElement, Highlight>();

  function removeHighlight(id: string, highlight: HTMLElement) {
    highlight.remove();
    idToHighlightElementMap.delete(id);
    elementToHighlightMap.delete(highlight);
  }

  function clearAllHighlights() {
    for (const [id, highlight] of idToHighlightElementMap) {
      removeHighlight(id, highlight);
    }
    if (!highlightsContainer) {
      return;
    }
    for (const child of Array.from(highlightsContainer.children)) {
      child.remove();
    }
  }

  function cleanupVisualModeElements() {
    if (!visualModeContainer) {
      return;
    }
    for (const child of Array.from(visualModeContainer.children)) {
      child.remove();
    }
  }

  function getInteractionModeForElement(element: HTMLElement) {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement
    ) {
      if (InputTypesThatAreNotTextboxes.includes(element.type)) {
        return { type: ElementInteractionMode.Click };
      }
      return { type: ElementInteractionMode.Focus };
    }
    return state.highlightInteractionMode;
  }

  function highlightElementsBySelector(
    selector: string,
    options: HighlightElementsOptions
  ) {
    const {
      checkOpacity = true,
      handleInstantlyIfOnlyOne = false,
      interaction,
    } = options;
    if (interaction) {
      state.highlightInteractionMode = interaction;
    }
    clearAllHighlights();
    const elements = deepQuerySelectorAll(selector);
    if (!elements || elements.length === 0) {
      return;
    }
    const highlightIDs = twoCharIDGenerator();
    const windowHeight = window.innerHeight;
    let createdHighlights: string[] = [];
    const highlightElements: HTMLElement[] = [];
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const elementRect = element.getBoundingClientRect();
      const elementTop = elementRect.top;

      const isInViewport =
        elementTop >= 0 &&
        elementTop < windowHeight &&
        elementRect.width > 0 &&
        elementRect.height > 0;
      if (!isInViewport) {
        continue;
      }

      const isVisible = element.checkVisibility({
        checkOpacity,
      });
      if (!isVisible) {
        continue;
      }

      const scrollParent = findOverflowingParent(element);
      if (scrollParent) {
        const scrollParentRect = scrollParent.getBoundingClientRect();
        const scrollOffset = scrollParent.scrollTop;
        let scrollParentTop = scrollParentRect.top;
        let scrollParentBottom = scrollParentRect.bottom;
        if (scrollParentTop < 0 && Math.abs(scrollParentTop) === scrollOffset) {
          scrollParentTop += scrollOffset;
          if (scrollOffset + scrollParentBottom === scrollParentRect.height) {
            scrollParentBottom += scrollOffset;
          }
        }
        const isElementVisibleInScroll =
          elementTop >= scrollParentTop &&
          elementRect.bottom <= scrollParentBottom;
        if (!isElementVisibleInScroll) {
          continue;
        }
      }

      const id = highlightIDs.next().value as string;
      const highlight = createElement("div", {
        styles: {
          ...HighlightStyles,
          translate: `${elementRect.x}px ${elementRect.y}px`,
        },
        text: id,
      });
      highlightElements.push(highlight);

      idToHighlightElementMap.set(id, highlight);
      elementToHighlightMap.set(highlight, {
        type: "element",
        element,
      });
      createdHighlights.push(id);
    }
    if (createdHighlights.length === 1 && handleInstantlyIfOnlyOne) {
      handleHighlightInteraction(createdHighlights[0]);
      return;
    }
    for (let i = 0; i < highlightElements.length; i++) {
      const element = highlightElements[i];
      highlightsContainer?.append(element);
    }
    if (createdHighlights.length === 0) {
      return;
    }
    setCurrentMode(Mode.Highlight);
  }

  function getHighlightById(id: string) {
    const highlightElement = idToHighlightElementMap.get(id);
    if (!highlightElement) return;

    const highlight = elementToHighlightMap.get(highlightElement);
    return highlight;
  }

  function handleHighlightInteraction(id: string) {
    const highlight = getHighlightById(id);
    if (!highlight) return;

    setCurrentMode(Mode.Normal);
    state.highlightInput = "";
    clearAllHighlights();

    if (highlight.type === "element") {
      handleElementInteraction(
        highlight.element,
        getInteractionModeForElement(highlight.element)
      );
    } else if (highlight.type === "word") {
      startVisualMode(highlight.word);
    }
  }

  function startVisualMode(word: WordInNode) {
    const selection = window.getSelection();
    if (!selection) {
      resetState(true);
      return;
    }

    setCurrentMode(Mode.VisualCaret);
    selection.setPosition(word.node, word.start);
  }

  function updateHighlightInput(
    key: string,
    event: KeyboardEvent,
    handleInteraction: (id: string) => void = handleHighlightInteraction,
    handleNoResultFound?: () => void
  ) {
    state.highlightInput += key;
    const ids = Array.from(idToHighlightElementMap.keys());
    const highlightInput = state.highlightInput;
    const filtered = ids.filter((id) => id.startsWith(highlightInput));
    for (const [id, highlight] of idToHighlightElementMap) {
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
    if (filtered.length > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (filtered.length === 1 && firstResult === highlightInput) {
      handleInteraction(firstResult);
    } else if (filtered.length === 0) {
      setCurrentMode(Mode.Normal);
      state.highlightInput = "";
      clearAllHighlights();
      handleNoResultFound?.();
    }
  }

  function jumpToCharacter(char: string, direction: "forward" | "backward") {
    const selection = getSelection();
    if (!selection) {
      return;
    }

    const focusNode = selection.focusNode;
    if (!focusNode) {
      return;
    }

    let focusOffset = selection.focusOffset;
    const text = focusNode.textContent;
    if (!text) {
      return;
    }

    let index = -1;
    const pos = state.jumpToCharacter.pos;
    if (direction === "forward") {
      if (pos === "before") {
        focusOffset += 1;
      }
      index = text.indexOf(char, focusOffset);
      if (pos === "after" && index > -1) {
        index += 1;
      }
    } else {
      focusOffset -= 1;
      if (pos === "after") {
        focusOffset -= 1;
      }
      index = text.lastIndexOf(char, focusOffset);
      if (pos === "after" && index > -1) {
        index += 1;
      }
    }
    if (index === -1) {
      return;
    }

    const mode = currentMode();
    if (mode === Mode.VisualCaret) {
      selection.setPosition(focusNode, index);
    } else if (mode === Mode.VisualRange) {
      selection.extend(focusNode, index);
    }
  }

  function setCharacterAndJump(char: string) {
    state.jumpToCharacter.char = char;
    state.jumpToCharacter.waitingForInput = false;

    jumpToCharacter(char, "forward");
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
    let element = document.activeElement;
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

  function highlightInteractiveElements() {
    if (currentMode() !== Mode.Highlight) {
      highlightElementsBySelector(config.interactiveElementsSelector, {
        interaction: { type: ElementInteractionMode.Click },
      });
    }
  }

  function highlightLinksToOpenInNewTab() {
    if (currentMode() !== Mode.Highlight) {
      highlightElementsBySelector("a", {
        interaction: {
          type: ElementInteractionMode.OpenInNewTab,
        },
      });
    }
  }

  function highlightInteractiveElementsToHover() {
    if (currentMode() !== Mode.Highlight) {
      highlightElementsBySelector(config.interactiveElementsSelector, {
        interaction: { type: ElementInteractionMode.Hover },
      });
    }
  }

  function highlightAllInputs() {
    if (currentMode() !== Mode.Highlight) {
      highlightElementsBySelector("input,textarea,[contenteditable]", {
        interaction: { type: ElementInteractionMode.Focus },
        checkOpacity: false,
        handleInstantlyIfOnlyOne: true,
      });
    }
  }

  function togglePassthrough() {
    setIsPassthrough((is) => !is);
  }

  function openNewTabToRight() {
    sendMessage("openNewTab", { background: false });
  }

  function highlightWordsForVisualMode() {
    const selection = getSelection();
    if (selection && !selection.isCollapsed) {
      setCurrentMode(Mode.VisualRange);
      return;
    }

    cleanupVisualModeElements();

    const walk = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    let node = walk.nextNode();
    const windowHeight = window.innerHeight;
    const words: {
      node: Node;
      start: number;
      end: number;
      rect: DOMRect;
    }[] = [];
    while (node) {
      const parentElement = node.parentElement;
      if (!parentElement) {
        node = walk.nextNode();
        continue;
      }

      const parentRect = parentElement.getBoundingClientRect();
      const isParentInViewport =
        parentRect.width > 0 &&
        parentRect.height > 0 &&
        parentRect.top >= 0 &&
        parentRect.top < windowHeight;
      const isParentVisible = parentElement.checkVisibility({
        checkOpacity: true,
      });
      if (!isParentInViewport || !isParentVisible) {
        node = walk.nextNode();
        continue;
      }

      const rangeToCheckInitialVisibility = new Range();
      rangeToCheckInitialVisibility.selectNodeContents(node);
      const rect = rangeToCheckInitialVisibility.getBoundingClientRect();
      const isVisible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= 0 &&
        rect.top < windowHeight;
      if (!isVisible) {
        node = walk.nextNode();
        continue;
      }

      const segmented = wordSegmenter.segment(node.nodeValue!);
      for (const segment of segmented) {
        if (!segment.isWordLike) {
          continue;
        }
        const segmentRange = new Range();
        const start = segment.index;
        const end = start + segment.segment.length;
        segmentRange.setStart(node, start);
        segmentRange.setEnd(node, end);
        const rect = segmentRange.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top >= 0 &&
          rect.top < windowHeight;
        if (!isVisible) {
          continue;
        }
        words.push({
          node,
          start,
          end,
          rect,
        });
      }
      node = walk.nextNode();
    }
    if (words.length > 0) {
      const idGen = twoCharIDGenerator();
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word) continue;
        const { node, start, end, rect } = word;
        const id = idGen.next().value;
        const highlight = createElement("div", {
          styles: {
            ...HighlightStyles,
            translate: `${rect.x}px ${rect.y}px`,
            fontSize: rem(0.75),
          },
          text: id as string,
        });
        highlightsContainer?.append(highlight);
        idToHighlightElementMap.set(id as string, highlight);
        elementToHighlightMap.set(highlight, {
          type: "word",
          word: {
            node,
            start,
            end,
          },
        });
      }
      setCurrentMode(Mode.Highlight);
    }
  }

  const StartsWithProtocolRegex = /^[a-z]+:\/\//;
  function openSelectedTextAsLink() {
    const selection = getSelection();
    if (!selection) return;

    const selectionText = selection.toString();
    const splitByNewlines = selectionText.split("\n");
    for (let i = 0; i < splitByNewlines.length; i++) {
      try {
        let possibleURL = splitByNewlines[i];
        if (!StartsWithProtocolRegex.test(possibleURL)) {
          possibleURL = "https://" + possibleURL;
        }
        const url = new URL(possibleURL);
        sendMessage("openNewTab", {
          background: true,
          url: url.toString(),
        });
      } catch {}
    }
  }

  function searchSelectedText() {
    const selection = getSelection();
    if (!selection) return;

    const selectionText = selection.toString();
    sendMessage("search", selectionText);
  }

  const context: Context = {
    shouldShowDebugInfo,
    toggleDebugInfo: () => setShouldShowDebugInfo((b) => !b),
    hideAllPopups,
    resetState,
    registerKeydownListener,
    registerKeyupListener,
    highlightElementsBySelector,
    popupRoot: () => state.popupRoot,
  };

  function highlightElementsForInteractionMenu() {
    highlightElementsBySelector(config.interactiveElementsSelector, {
      interaction: undefined,
    });
    const removeListener = registerKeydownListener((event) => {
      const { key, ctrlKey, shiftKey, altKey, metaKey } = event;
      if (isModifierKey(key)) {
        return true;
      }

      if (isEscapeKey(key)) {
        removeListener();
        return false;
      }

      const mode = currentMode();
      if (
        !ctrlKey &&
        !shiftKey &&
        !altKey &&
        !metaKey &&
        mode === Mode.Highlight
      ) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        updateHighlightInput(
          key,
          event,
          (id) => {
            const highlight = getHighlightById(id);
            setCurrentMode(Mode.Normal);
            state.highlightInput = "";
            clearAllHighlights();
            if (!state.popupRoot || !highlight || highlight.type === "word") {
              removeListener();
              return;
            }
            const dispose = render(() => {
              const cleanup = () => {
                removeListener();
                dispose();
              };
              return (
                <InteractionMenu
                  context={context}
                  element={highlight.element}
                  onSelect={cleanup}
                  onClose={cleanup}
                />
              );
            }, state.popupRoot);
          },
          () => {
            removeListener();
          }
        );
        return true;
      }

      return false;
    });
  }

  const actionsMap: Record<Mode, Actions> = {
    [Mode.Normal]: {
      "S-?": {
        desc: "Show help",
        fn: () => {
          hideAllPopups();
          toggleActionHelp((show) => !show);
        },
      },
      k: { desc: "Scroll up", fn: scrollUp },
      j: { desc: "Scroll down", fn: scrollDown },
      e: { desc: "Scroll half-page up", fn: scrollHalfPageUp },
      d: { desc: "Scroll half-page down", fn: scrollHalfPageDown },
      "g g": { desc: "Scroll to top", fn: scrollToTop },
      "S-g": { desc: "Scroll to bottom", fn: scrollToBottom },
      i: { desc: "Highlight editable elements", fn: highlightAllInputs },
      "l v": {
        desc: "List all media",
        fn: function listAllMedia() {
          const mediaElements: HTMLMediaElement[] = [];
          for (const media of document.querySelectorAll("video, audio")) {
            if (!(media instanceof HTMLMediaElement)) continue;
            mediaElements.push(media);
          }
          mediaElements.sort((a, b) => +a.paused - +b.paused);
          const popupRoot = context.popupRoot();
          if (!popupRoot) return;
          const dispose = render(
            () =>
              mediaElements.length === 1 ? (
                <MediaControls
                  context={context}
                  media={mediaElements[0]}
                  close={() => dispose()}
                />
              ) : (
                <MediaList
                  context={context}
                  mediaElements={mediaElements}
                  onClose={() => dispose()}
                />
              ),
            popupRoot
          );
        },
      },
      "l t": {
        desc: "List all tabs",
        fn: () => toggleTabList((show) => !show),
      },
      "l i": {
        desc: "List all images",
        fn: () => toggleImageList((show) => !show),
      },
      f: {
        desc: "Highlight interactive elements",
        fn: highlightInteractiveElements,
      },
      "g f": {
        desc: "Highlight links to open in new tab",
        fn: highlightLinksToOpenInNewTab,
      },
      "l f": {
        desc: "List all links & buttons",
        fn: () => setShowListAndButtonList((show) => !show),
      },
      "s f": {
        desc: "Highlight and interact",
        fn: highlightElementsForInteractionMenu,
      },
      "g h": {
        desc: "Highlight interactive elements to hover",
        fn: highlightInteractiveElementsToHover,
      },
      "C-p": { desc: "Toggle passthrough", fn: togglePassthrough },
      "C-S-:": {
        desc: "Show command palette",
        fn: () => toggleCommandPalette(true),
      },
      v: { desc: "Visual mode", fn: highlightWordsForVisualMode },
      "w t [": {
        desc: "Go to previous tab",
        fn: function goToPreviousTab() {
          sendMessage("goToTab", {
            relative: "previous",
          });
        },
      },
      "w t ]": {
        desc: "Go to next tab",
        fn: function goToNextTab() {
          sendMessage("goToTab", {
            relative: "next",
          });
        },
      },
      "w t n": {
        desc: "New tab to right",
        fn: openNewTabToRight,
      },
    },
    [Mode.Highlight]: {},
    [Mode.VisualCaret]: {
      v: {
        desc: "Toggle visual range",
        fn: function toggleVisualRange() {
          setCurrentMode(Mode.VisualRange);
        },
      },
      h: {
        desc: "Move to left by character",
        fn: moveSelectionByCharToLeft,
      },
      l: {
        desc: "Move to right by character",
        fn: moveSelectionByCharToRight,
      },
      w: {
        desc: "Move to right by word",
        fn: moveSelectionByWordToRight,
      },
      b: {
        desc: "Move to left by word",
        fn: moveSelectionByWordToLeft,
      },
      k: {
        desc: "Move to line above",
        fn: moveSelectionToLineAbove,
      },
      j: {
        desc: "Move to line below",
        fn: moveSelectionToLineBelow,
      },
      "S-arrowleft": {
        desc: "Select to left by character",
        fn: () => {
          setCurrentMode(Mode.VisualRange);
          extendSelectionByCharToLeft();
        },
      },
      "S-arrowright": {
        desc: "Select to right by character",
        fn: () => {
          setCurrentMode(Mode.VisualRange);
          extendSelectionByCharToRight();
        },
      },
      "S-arrowup": {
        desc: "Select to line above by character",
        fn: () => {
          setCurrentMode(Mode.VisualRange);
          extendSelectionToLineAbove();
        },
      },
      "S-arrowdown": {
        desc: "Select to line below by character",
        fn: () => {
          setCurrentMode(Mode.VisualRange);
          extendSelectionToLineBelow();
        },
      },
      "C-S-arrowleft": {
        desc: "Select to left by word",
        fn: () => {
          setCurrentMode(Mode.VisualRange);
          extendSelectionByWordToLeft();
        },
      },
      "C-S-arrowright": {
        desc: "Select to right by word",
        fn: () => {
          setCurrentMode(Mode.VisualRange);
          extendSelectionByWordToRight();
        },
      },
    },
    [Mode.VisualRange]: {
      "i w": {
        desc: "Select current word",
        fn: selectCurrentWord,
      },
      "i p": {
        desc: "Select current paragraph",
        fn: selectCurrentParagraph,
      },
      y: {
        desc: "Copy selection",
        fn: function copySelection() {
          const selection = getSelection();
          if (!selection) return;
          document.execCommand("copy");
          resetState(true);
        },
      },
      escape: {
        desc: "Enable visual caret mode",
        fn: () => {
          setCurrentMode(Mode.VisualCaret);
          collapseSelectionToEnd();
        },
      },
      "g f": {
        desc: "Open selected text as link in new tab",
        fn: openSelectedTextAsLink,
      },
      "s f": {
        desc: "Search selected text in new tab",
        fn: searchSelectedText,
      },
    },
  };

  const extendToLeftByChar = {
    desc: "Select character to left",
    fn: extendSelectionByCharToLeft,
  };

  const extendToRightByChar = {
    desc: "Select character to right",
    fn: extendSelectionByCharToRight,
  };

  const extendToRightByWord = {
    desc: "Select word to right",
    fn: extendSelectionByWordToRight,
  };

  const extendToLeftByWord = {
    desc: "Select word to left",
    fn: extendSelectionByWordToLeft,
  };

  const extendToLineAbove = {
    desc: "Select to line above by character",
    fn: extendSelectionToLineAbove,
  };

  const extendToLineBelow = {
    desc: "Select to line below by character",
    fn: extendSelectionToLineBelow,
  };

  actionsMap[Mode.VisualRange]["h"] = extendToLeftByChar;
  actionsMap[Mode.VisualRange]["j"] = extendToLineBelow;
  actionsMap[Mode.VisualRange]["k"] = extendToLineAbove;
  actionsMap[Mode.VisualRange]["l"] = extendToRightByChar;

  actionsMap[Mode.VisualRange]["w"] = extendToRightByWord;
  actionsMap[Mode.VisualRange]["b"] = extendToLeftByWord;

  const jumpToBeforeCharacter = {
    desc: "Jump to before character",
    fn: () => {
      state.jumpToCharacter.char = null;
      state.jumpToCharacter.pos = "before";
      state.jumpToCharacter.waitingForInput = true;
    },
  };
  actionsMap[Mode.VisualCaret]["t"] = jumpToBeforeCharacter;
  actionsMap[Mode.VisualRange]["t"] = jumpToBeforeCharacter;

  const jumpToAfterCharacter = {
    desc: "Jump to after character",
    fn: () => {
      state.jumpToCharacter.char = null;
      state.jumpToCharacter.pos = "after";
      state.jumpToCharacter.waitingForInput = true;
    },
  };
  actionsMap[Mode.VisualCaret]["f"] = jumpToAfterCharacter;
  actionsMap[Mode.VisualRange]["f"] = jumpToAfterCharacter;

  const jumpToNextCharOccurance = {
    desc: "Jump to next character occurance",
    fn: () => {
      if (!state.jumpToCharacter.char) return;
      jumpToCharacter(state.jumpToCharacter.char, "forward");
    },
  };
  actionsMap[Mode.VisualCaret][";"] = jumpToNextCharOccurance;
  actionsMap[Mode.VisualRange][";"] = jumpToNextCharOccurance;

  const jumpToPrevCharOccurance = {
    desc: "Jump to previous character occurance",
    fn: () => {
      if (!state.jumpToCharacter.char) return;
      jumpToCharacter(state.jumpToCharacter.char, "backward");
    },
  };
  actionsMap[Mode.VisualCaret][","] = jumpToPrevCharOccurance;
  actionsMap[Mode.VisualRange][","] = jumpToPrevCharOccurance;

  if (import.meta.env.BROWSER !== "firefox") {
    // Chrome doesn't seem to allow using Shift + arrows to
    // extend selection if it is collapsed, so we can register
    // handlers for that
    actionsMap[Mode.VisualRange]["S-arrowleft"] = extendToLeftByChar;
    actionsMap[Mode.VisualRange]["S-arrowright"] = extendToRightByChar;
    actionsMap[Mode.VisualRange]["S-arrowup"] = extendToLineAbove;
    actionsMap[Mode.VisualRange]["S-arrowdown"] = extendToLineBelow;
    actionsMap[Mode.VisualRange]["C-S-arrowright"] = extendToRightByWord;
    actionsMap[Mode.VisualRange]["C-S-arrowleft"] = extendToLeftByWord;

    // Firefox doesn't support "sentence" granularity
    actionsMap[Mode.VisualCaret]["0"] = {
      desc: "Move to start of sentence",
      fn: moveSelectionToLeftBySentence,
    };
    actionsMap[Mode.VisualCaret]["S-$"] = {
      desc: "Move to end of sentence",
      fn: moveSelectionToRightBySentence,
    };
    actionsMap[Mode.VisualRange]["0"] = {
      desc: "Select to left by sentence",
      fn: extendSelectionToLeftBySentence,
    };
    actionsMap[Mode.VisualRange]["S-$"] = {
      desc: "Select to right by sentence",
      fn: extendSelectionToRightBySentence,
    };
  }

  if (import.meta.env.BROWSER === "firefox") {
    // Firefox-only features

    actionsMap[Mode.Normal]["w c l"] = {
      desc: "List containers",
      fn: () => toggleContainerList(true),
    };
    actionsMap[Mode.Normal]["w c n"] = {
      desc: "New tab in container",
      fn: () => {
        if (!state.popupRoot) return;
        const dispose = render(
          () => (
            <ContainerList
              context={context}
              handleSelect={(container) => {
                dispose();
                sendMessage("openNewTab", {
                  background: false,
                  cookieStoreId: container.cookieStoreId,
                });
              }}
            />
          ),
          state.popupRoot
        );
      },
    };
    actionsMap[Mode.Normal]["w c f"] = {
      desc: "Highlight links to open in container",
      fn: () => {
        if (!state.popupRoot) return;
        const dispose = render(
          () => (
            <ContainerList
              context={context}
              handleSelect={(container) => {
                dispose();
                highlightElementsBySelector("a", {
                  interaction: {
                    type: ElementInteractionMode.OpenInNewTab,
                    cookieStoreId: container.cookieStoreId,
                  },
                });
              }}
            />
          ),
          state.popupRoot
        );
      },
    };
  }

  const actionKeyCombinations: Record<Mode, string[]> = {
    [Mode.Normal]: Object.keys(actionsMap[Mode.Normal]),
    [Mode.Highlight]: Object.keys(actionsMap[Mode.Highlight]),
    [Mode.VisualCaret]: Object.keys(actionsMap[Mode.VisualCaret]),
    [Mode.VisualRange]: Object.keys(actionsMap[Mode.VisualRange]),
  };

  const actionUniqueKeys: Record<Mode, Set<string>> = {
    [Mode.Normal]: new Set(
      actionKeyCombinations[Mode.Normal].flatMap((kc) =>
        kc.split(WhiteSpaceRegEx)
      )
    ),
    [Mode.Highlight]: new Set(
      actionKeyCombinations[Mode.Highlight].flatMap((kc) =>
        kc.split(WhiteSpaceRegEx)
      )
    ),
    [Mode.VisualCaret]: new Set(
      actionKeyCombinations[Mode.VisualCaret].flatMap((kc) =>
        kc.split(WhiteSpaceRegEx)
      )
    ),
    [Mode.VisualRange]: new Set(
      actionKeyCombinations[Mode.VisualRange].flatMap((kc) =>
        kc.split(WhiteSpaceRegEx)
      )
    ),
  };

  const actionsHelpByMode = createMemo(() => {
    return Object.entries(actionsMap).flatMap(([mode, actions]) => ({
      mode,
      actions: Object.entries(actions).flatMap(([key, { desc }]) => ({
        key,
        desc,
      })),
    }));
  });

  function resetState(hidePopups: boolean) {
    if (hidePopups) {
      hideAllPopups();
    }
    clearAllHighlights();
    cleanupVisualModeElements();
    setKeyInput("");
    setCurrentMode(Mode.Normal);
    state.highlightInput = "";
  }

  const keydownListeners = new Set<KeyEventListener>();
  const keyupListeners = new Set<KeyEventListener>();

  function registerKeydownListener(
    listener: KeyEventListener
  ): KeyEventListenerCleanup {
    keydownListeners.add(listener);
    return () => {
      keydownListeners.delete(listener);
      info("cleaned up keydown listener");
    };
  }

  function registerKeyupListener(
    listener: KeyEventListener
  ): KeyEventListenerCleanup {
    keyupListeners.add(listener);
    return () => {
      keyupListeners.delete(listener);
    };
  }

  const InputTypesThatAreNotTextboxes = [
    "button",
    "checkbox",
    "color",
    "file",
    "radio",
    "submit",
  ];
  function isInputElement(
    el: Element | EventTarget | null,
    checkShadowRootActiveElement = true
  ) {
    if (!(el instanceof Element)) return false;
    if (
      el instanceof HTMLInputElement &&
      InputTypesThatAreNotTextboxes.includes(el.type)
    ) {
      return false;
    }
    if (el.shadowRoot && checkShadowRootActiveElement) {
      return isInputElement(el.shadowRoot.activeElement);
    }
    return (
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        !!el?.closest('[contenteditable="true"]')) &&
      el.getAttribute("aria-readonly") !== "true"
    );
  }

  const [isDisabledGlobally, setIsDisabledGlobally] = createSignal(false);
  const [isDisabledOnPage, setIsDisabledOnPage] = createSignal(false);
  const isExtensionDisabled = () => isDisabledGlobally() || isDisabledOnPage();
  function disableForPageIfOnBlocklist(blocklist: Blocklist) {
    let rulesMatched = 0;
    for (const rule of blocklist) {
      if (!rule.enabled) continue;
      const value = rule.value;
      if (rule.type === "exact" && value === location.toString()) {
        rulesMatched++;
      } else if (
        rule.type === "domain" &&
        location.hostname.endsWith(rule.value)
      ) {
        rulesMatched++;
      } else if (
        rule.type === "prefix" &&
        location.toString().startsWith(value)
      ) {
        rulesMatched++;
      } else if (
        rule.type === "regexp" &&
        new RegExp(rule.value).test(location.toString())
      ) {
        rulesMatched++;
      }
    }
    setIsDisabledOnPage(rulesMatched > 0);
  }

  createEffect(() => {
    if (isExtensionDisabled()) {
      resetState(true);
    }
  });

  const mainKeydownListener = (event: KeyboardEvent) => {
    if (isExtensionDisabled()) return;

    if (keydownListeners.size > 0) {
      const listeners = Array.from(keydownListeners);
      const numberOfListeners = listeners.length;
      info(`Going through ${numberOfListeners} keydown listeners`);
      for (let i = listeners.length - 1; i >= 0; i--) {
        const listener = listeners[i];
        if (listener(event)) {
          return;
        }
      }
    }

    const { key, ctrlKey, shiftKey, altKey, metaKey, target } = event;
    info("keydown", event);

    if (isModifierKey(key)) {
      return;
    }

    const element = getCurrentElement();
    if (isInputElement(element) || isInputElement(target)) {
      info("current element or event target is input", {
        element,
        target,
      });
      resetState(false);
      return;
    }

    const mode = currentMode();

    if (isEscapeKey(key) && !actionUniqueKeys[mode].has("escape")) {
      if (mode !== Mode.Normal || keyInput().length > 0) {
        event.stopImmediatePropagation();
        event.stopPropagation();
      }
      resetState(true);
      state.jumpToCharacter.waitingForInput = false;
      return;
    }

    if (
      !ctrlKey &&
      !shiftKey &&
      !altKey &&
      !metaKey &&
      mode === Mode.Highlight &&
      !isEscapeKey(key)
    ) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      updateHighlightInput(key, event);
      return;
    }

    if (state.jumpToCharacter.waitingForInput && !isEscapeKey(key)) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      setCharacterAndJump(key);
      return;
    }

    const keyRepresentation = getKeyRepresentation(event);
    info("event key:", keyRepresentation);

    const isTogglePassthroughKey = keyRepresentation === "C-p";

    if (isPassthrough() && !isTogglePassthroughKey) {
      info("ignoring because passthrough mode");
      return;
    }

    if (!actionUniqueKeys[mode].has(keyRepresentation)) {
      info("ignoring because no listener includes current key");
      return;
    }

    if (keyInput().length > 0) {
      setKeyInput((ki) => ki + " ");
    }

    setKeyInput((ki) => ki + keyRepresentation);

    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    const input = keyInput();
    info("key input:", input);

    const filtered = actionKeyCombinations[mode].filter((key) =>
      key.startsWith(input)
    );
    const firstResult = filtered[0];
    if (filtered.length === 1 && firstResult === input) {
      event.preventDefault();
      actionsMap[mode][firstResult].fn(event);
      setKeyInput("");
    } else if (filtered.length === 0) {
      setKeyInput("");
    }
  };

  const mainKeyupListener = (event: KeyboardEvent) => {
    if (isExtensionDisabled()) return;

    if (keyupListeners.size > 0) {
      const listeners = Array.from(keyupListeners);
      const numberOfListeners = listeners.length;
      info(`Going through ${numberOfListeners} keyup listeners`);
      for (let i = numberOfListeners - 1; i >= 0; i--) {
        const listener = listeners[i];
        if (listener(event)) {
          return;
        }
      }
    }
    const mode = currentMode();
    const keyRepresentation = getKeyRepresentation(event);
    info("keyup", { mode, key: keyRepresentation });
    if (!actionUniqueKeys[mode].has(keyRepresentation)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  };

  const selectionChangeListener = () => {
    if (!collapsedCaret || isExtensionDisabled()) return;

    const selection = getSelection();
    if (!selection || !selection.isCollapsed) {
      collapsedCaret.style.display = "none";
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    collapsedCaret.style.display = "";
    collapsedCaret.style.height = `${rect.height}px`;
    collapsedCaret.style.translate = `${rect.x}px ${rect.y}px`;
  };

  const controller = new AbortController();

  function addEventListeners() {
    document.addEventListener("selectionchange", selectionChangeListener, {
      signal: controller.signal,
    });
    document.body.addEventListener("keydown", mainKeydownListener, {
      capture: true,
      signal: controller.signal,
    });
    document.body.addEventListener("keyup", mainKeyupListener, {
      capture: true,
      signal: controller.signal,
    });
  }

  onMount(() => {
    addEventListeners();

    disabledGlobally.getValue().then(setIsDisabledGlobally).catch(error);
    const unwatchDisabledGlobally = disabledGlobally.watch(
      setIsDisabledGlobally
    );

    storedBlocklist.getValue().then(disableForPageIfOnBlocklist).catch(error);
    const unwatchStoredBlocklist = storedBlocklist.watch(
      disableForPageIfOnBlocklist
    );

    onCleanup(() => {
      unwatchDisabledGlobally();
      unwatchStoredBlocklist();
    });
  });
  onCleanup(() => {
    controller.abort();
  });

  return (
    <>
      <div ref={state.popupRoot} />
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
      <div
        ref={visualModeContainer}
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
      <Show
        when={
          currentMode() === Mode.VisualCaret ||
          currentMode() === Mode.VisualRange
        }
      >
        <div
          ref={collapsedCaret}
          role="presentation"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "1.5px",
            "z-index": 69420,
            "pointer-events": "none",
            background: "fuchsia",
          }}
        />
      </Show>
      <Show when={shouldShowActionHelp()}>
        <ActionsHelp
          context={context}
          mode={currentMode}
          keyInput={keyInput()}
          actionsHelpByMode={actionsHelpByMode()}
        />
      </Show>
      <Show when={keyInput().length > 0 && !shouldShowActionHelp()}>
        <ActionSuggestion
          context={context}
          keyInput={keyInput()}
          actionKeys={actionKeyCombinations[currentMode()]}
          actions={actionsMap[currentMode()]}
        />
      </Show>
      <Show when={shouldShowLinkAndButtonList()}>
        <SearchLinksAndButtons context={context} />
      </Show>
      <Show when={shouldShowTabList()}>
        <TabList context={context} />
      </Show>
      <Show when={shouldShowDebugList()}>
        <DebugList context={context} />
      </Show>
      <Show when={shouldShowImageList()}>
        <ImageList context={context} />
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
      <Show when={shouldShowCommandPalette()}>
        <CommandPalette
          context={context}
          actions={actionsMap[currentMode()]}
          getCurrentElement={getCurrentElement}
          showDebugList={() => toggleDebugList(true)}
          showConfig={() => toggleConfig(true)}
        />
      </Show>
      <Show when={shouldShowConfig()}>
        <Config context={context} />
      </Show>
      <Show when={shouldShowContainerList()}>
        <ContainerList context={context} />
      </Show>
      <Show when={currentMode() === Mode.VisualCaret}>
        <div
          style={{
            ...PopupStyles,
            width: "auto",
            padding: rem(0.5),
          }}
        >
          Visual caret
        </div>
      </Show>
      <Show when={currentMode() === Mode.VisualRange}>
        <div
          style={{
            ...PopupStyles,
            width: "auto",
            padding: rem(0.5),
          }}
        >
          Visual range
        </div>
      </Show>
      <style>{`
.qs-text-ellipsis { white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.qs-input { outline: 0; }
.qs-input:focus-visible, .qs-focus-within:focus-within { outline: 2px solid cornflowerblue; }
.qs-popup { --scrollbar-width: 16px; }
.qs-popup > * { min-height: 0; }
.qs-popup ::-webkit-scrollbar { width: var(--scrollbar-width); }
.qs-popup ::-webkit-scrollbar-thumb {
  background: ${Colors["cb"]};
  border-radius: ${rem(0.5)};
  border: 4px solid rgba(0,0,0,0);
  background-clip: padding-box;
}
.qs-popup:focus-visible, .qs-popup *:focus-visible { outline: 2px solid cornflowerblue; }
.qs-list-item { --is-hovered: 0; background: transparent; }
.qs-list-item:hover, .qs-list-item.active { --is-hovered: 1; background: ${
        Colors["cb-dark-60"]
      }; }
.qs-btn { margin: 0; padding: 0; border-color: transparent; font-family: inherit; font-size: inherit; text-align: left; }
.qs-outline-btn { background: transparent; border: 2px solid ${
        Colors["cb-dark-50"]
      }; }
.qs-outline-btn:hover, .qs-outline-btn:focus { background: ${
        Colors["cb-dark-60"]
      }; }
.qs-outline-btn:focus-visible { outline: 2px solid cornflowerblue; }
.qs-toggle {
  display: grid;
  place-items: center;
  padding: ${rem(0.25)};
  border: 2px solid ${Colors["cb-dark-50"]};
  border-radius: ${rem(0.25)}
}
.qs-toggle.active {
  background: ${Colors["cb-dark-50"]};
}
.qs-toggle:has(input:focus-visible) {
  outline: 2px solid cornflowerblue;
}
.qs-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
`}</style>
    </>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  cssInjectionMode: "ui",
  main(ctx) {
    info("Loaded content script");

    const ui = createIntegratedUi(ctx, {
      position: "inline",
      onMount(uiContainer) {
        render(() => <Root />, uiContainer);
      },
    });
    ui.mount();
  },
});
