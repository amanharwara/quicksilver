import {
  Accessor,
  Component,
  ComponentProps,
  JSX,
  ParentProps,
} from "solid-js";
import { Tabs } from "wxt/browser";
import { Message } from "../../Message";
import {
  ChevronDownIcon,
  LoopIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  SlidersHorizontalIcon,
} from "./icons";
import { log } from "../../Util";
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

const mainContext = createContext<{
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
}>();

function useMainContext() {
  const ctx = useContext(mainContext);
  if (!ctx) throw new Error("No quicksilver context available");
  return ctx;
}

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

function getKeyRepresentation(event: KeyboardEvent) {
  const { ctrlKey, shiftKey, altKey, key } = event;
  return `${ctrlKey ? "C-" : ""}${shiftKey ? "S-" : ""}${
    altKey ? "A-" : ""
  }${key.toLowerCase()}`;
}

enum ElementInteractionMode {
  Click = 0,
  Focus = 1,
  OpenInNewTab = 2,
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
  Normal,
  Highlight,
  VisualCaret,
  VisualRange,
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
  overflow: "hidden",
  padding: 0,
  border: 0,
};
function Popup(props: ComponentProps<"dialog">) {
  let popup: HTMLDialogElement | undefined;

  const context = useMainContext();

  const clickListener = (event: MouseEvent) => {
    if (!popup || !(event.target instanceof Element)) {
      return;
    }
    if (popup.contains(event.target)) {
      return;
    }
    context.hideAllPopups();
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

type KeyEventListener = (event: KeyboardEvent) => boolean;
type KeyEventListenerCleanup = () => void;

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
      browser.runtime.sendMessage({
        type: "open-new-tab-in-background",
        url: href,
      } satisfies Message);
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
        "qs-list-item": true,
        active: isFocused(),
      }}
      style={{
        ...ButtonDefaultStyles,
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

  const context = useMainContext();

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
  items: Item[] | Accessor<Item[]>;
  filter: (item: Item, lowercaseQuery: string) => boolean;
  itemContent: (item: Item, isFocused: boolean, index: number) => JSX.Element;
  itemProps?: ComponentProps<"button">;
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
    const items =
      typeof props.items === "function" ? props.items() : props.items;
    if (q.length === 0) return items;
    const lowercaseQuery = q.toLowerCase();
    return items.filter((item) => props.filter(item, lowercaseQuery));
  });

  const context = useMainContext();

  onMount(() => {
    const cleanup = context.registerKeyupListener((event) => {
      switch (event.key) {
        case "Enter": {
          const item = filtered()[focusedIndex()];
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
      cleanup();
    });
  });

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
      }}
      onKeyDown={(event) => {
        const item = filtered()[focusedIndex()];
        const { key } = event;
        switch (key) {
          case "Escape":
            event.preventDefault();
            context.resetState(true);
            break;
          case "PageUp":
          case "PageDown":
            event.preventDefault();
            break;
          case "Home":
            setFocusedIndex(0);
            break;
          case "End":
            setFocusedIndex(filtered().length - 1);
            break;
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
          default:
            break;
        }
      }}
    >
      <VirtualizedList
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

function SearchLinksAndButtons() {
  const context = useMainContext();

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
      handleElementInteraction(element, ElementInteractionMode.Click);
    },
  };
  const focusAction = {
    desc: "Focus",
    fn: (item: ClickableItem) => {
      const element = item.element;
      handleElementInteraction(element, ElementInteractionMode.Focus);
    },
  };
  const selectedItemActions = createMemo(() => {
    const actions = [openAction, focusAction];
    if (selectedItem()?.href) {
      actions.push({
        desc: "Open in new tab",
        fn: (item: ClickableItem) => {
          const element = item.element;
          handleElementInteraction(
            element,
            ElementInteractionMode.OpenInNewTab
          );
        },
      });
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
    <>
      <Popup
        style={{
          visibility: !!selectedItem() ? "hidden" : undefined,
        }}
      >
        <ListSearch
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
              >
                {item.text.trim().length > 0 ? item.text.trim() : "No title"}
              </div>
              <div
                class="qs-text-ellipsis"
                style={{
                  "font-size": "smaller",
                }}
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
        <Popup>
          <ListSearch
            items={selectedItemActions()}
            itemContent={({ desc }) => (
              <span class="qs-text-ellipsis" style={{ "font-weight": "bold" }}>
                {desc}
              </span>
            )}
            filter={({ desc }, lq) => desc.toLowerCase().includes(lq)}
            handleSelect={({ fn }) => {
              context.resetState(true);
              const item = selectedItem();
              if (!item) return;
              fn(item);
            }}
          />
        </Popup>
      </Show>
    </>
  );
}

function Toggle(props: {
  active: boolean;
  onChange: (active: boolean) => void;
  label: JSX.Element;
  icon: Component<ComponentProps<"svg">>;
}) {
  return (
    <label
      classList={{
        "qs-outline-btn": true,
        "qs-toggle": true,
        active: props.active,
      }}
    >
      <input
        class="sr-only"
        type="checkbox"
        checked={props.active}
        onChange={(event) => {
          props.onChange(event.target.checked);
        }}
      />
      {props.icon({
        style: {
          width: rem(1.325),
          height: rem(1.325),
        },
      })}
      <span class="sr-only">{props.label}</span>
    </label>
  );
}

const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
function PlaybackRateMenu(props: {
  media: HTMLMediaElement;
  closeMenu: () => void;
}) {
  const context = useMainContext();

  const [focusedIndex, setFocusedIndex] = createSignal(
    playbackRates.findIndex((r) => r === props.media.playbackRate)
  );

  function selectRate(rate: number) {
    props.closeMenu();
    props.media.playbackRate = rate;
  }

  onMount(() => {
    const cleanup = context.registerKeydownListener((event) => {
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
              "qs-list-item": true,
              active: focusedIndex() === index(),
            }}
            style={{
              ...ButtonDefaultStyles,
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

function MediaControls(props: { media: HTMLMediaElement; close: () => void }) {
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

  let popup: HTMLDialogElement | undefined;
  let playbackRateButton: HTMLButtonElement | undefined;
  const [playbackRateMenuPos, setPlaybackRateMenuPos] = createSignal<
    { minWidth: number; bottom: number; right: number } | undefined
  >();

  const context = useMainContext();

  onMount(() => {
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
    }

    const controller = new AbortController();

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
    const cleanupKeydownListener = context.registerKeydownListener((event) => {
      const key = getKeyRepresentation(event);
      switch (key) {
        case " ": {
          const input = (event.target as HTMLElement).closest("input");
          if (input && input.type !== "range") {
            return false;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          toggleMediaPlay();
          return true;
        }
        case "S-<": {
          event.preventDefault();
          event.stopImmediatePropagation();
          const currentRate = props.media.playbackRate;
          props.media.playbackRate = Math.max(currentRate - 0.25, 0);
          return true;
        }
        case "S->": {
          event.preventDefault();
          event.stopImmediatePropagation();
          const currentRate = props.media.playbackRate;
          props.media.playbackRate = Math.min(currentRate + 0.25, 2.5);
          return true;
        }
        case "m": {
          event.preventDefault();
          event.stopImmediatePropagation();
          props.media.muted = !props.media.muted;
          return true;
        }
        case "arrowdown": {
          event.preventDefault();
          event.stopImmediatePropagation();
          props.media.volume = Math.max(props.media.volume - 0.15, 0);
          return true;
        }
        case "arrowup": {
          event.preventDefault();
          event.stopImmediatePropagation();
          props.media.volume = Math.min(props.media.volume + 0.15, 1);
          return true;
        }
        case "arrowleft": {
          event.preventDefault();
          event.stopImmediatePropagation();
          props.media.currentTime = Math.max(props.media.currentTime - 5, 0);
          return true;
        }
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
          props.media.currentTime = Math.max(props.media.currentTime - 0.1, 0);
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
    });

    onCleanup(() => {
      controller.abort();
      cleanupKeydownListener();
    });
  });

  const date = new Date();

  const formattedCurrentTime = createMemo(() => {
    date.setHours(0, 0, currentTime());
    return date.toLocaleTimeString("en-US", {
      minute: "2-digit",
      second: "2-digit",
    });
  });

  const formattedDurationTime = createMemo(() => {
    date.setHours(0, 0, duration());
    return date.toLocaleTimeString("en-US", {
      minute: "2-digit",
      second: "2-digit",
    });
  });

  function toggleMediaPlay() {
    const media = props.media;
    if (isPlaying()) {
      media.pause();
    } else {
      media.play();
    }
  }

  return (
    <Popup
      ref={popup}
      style={{
        display: "grid",
        "grid-template-columns": "repeat(3, 1fr)",
        "grid-template-rows": "repeat(3, auto)",
        gap: rem(0.5),
        padding: rem(0.875),
      }}
      tabIndex={-1}
    >
      <div
        style={{
          "grid-row": "1",
          "grid-column": "1 / 4",
          "font-weight": "bold",
          "text-align": "center",
          "place-self": "center",
        }}
      >
        {props.media.src}
      </div>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: rem(0.5),
          "grid-row": "2",
          "grid-column": "1 / 4",
        }}
      >
        <div style={{ "font-variant-numeric": "tabular-nums" }}>
          {formattedCurrentTime()}
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
        <div style={{ "font-variant-numeric": "tabular-nums" }}>
          {formattedDurationTime()}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: rem(0.5),
          "grid-column": "1 / 2",
          "grid-row": "3",
          "justify-self": "start",
          "align-self": "center",
        }}
      >
        <Toggle
          active={muted()}
          onChange={() => (props.media.muted = !props.media.muted)}
          icon={MuteIcon}
          label={
            <Show when={muted()} fallback={"Mute"}>
              Unmute
            </Show>
          }
        />
        <input
          type="range"
          step={0.05}
          value={volume()}
          max={1}
          style={{ "flex-grow": "1" }}
          onChange={(event) => {
            const target = event.target;
            props.media.volume = parseFloat(target.value);
          }}
          disabled={muted()}
        />
      </div>
      <button
        class="qs-outline-btn"
        style={{
          display: "grid",
          "place-items": "center",
          "grid-column": "2 / 3",
          "grid-row": "3",
          "place-self": "center",
          ...ButtonDefaultStyles,
          color: Colors["cb-light-90"],
          padding: rem(0.25),
          border: `2px solid ${Colors["cb-dark-50"]}`,
          "border-radius": rem(0.25),
        }}
        onClick={toggleMediaPlay}
      >
        <Show
          when={isPlaying()}
          fallback={
            <PlayIcon
              style={{
                width: rem(1.325),
                height: rem(1.325),
              }}
            />
          }
        >
          <PauseIcon
            style={{
              width: rem(1.325),
              height: rem(1.325),
            }}
          />
        </Show>
        <span class="sr-only">
          <Show when={isPlaying()} fallback={"Play"}>
            Pause
          </Show>
        </span>
      </button>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: rem(0.5),
          "grid-row": "3",
          "grid-column": "3",
          "justify-self": "end",
          "align-self": "center",
        }}
      >
        <button
          ref={playbackRateButton}
          class="qs-outline-btn"
          popoverTarget="playback-rate-menu"
          style={{
            display: "flex",
            "align-items": "center",
            gap: rem(0.25),
            ...ButtonDefaultStyles,
            color: Colors["cb-light-90"],
            padding: `${rem(0.25)} ${rem(0.325)}`,
            border: `2px solid ${Colors["cb-dark-50"]}`,
            "border-radius": rem(0.25),
            "border-top-right-radius": isPlaybackRateMenuOpen()
              ? "0px"
              : undefined,
            "border-top-left-radius": isPlaybackRateMenuOpen()
              ? "0px"
              : undefined,
            background: isPlaybackRateMenuOpen()
              ? Colors["cb-dark-50"]
              : undefined,
          }}
          onClick={() => setIsPlaybackRateMenuOpen((open) => !open)}
        >
          <div class="sr-only">Playback speed:</div>
          <div>{playbackRate()}x</div>
          <ChevronDownIcon
            style={{
              width: rem(1.25),
              height: rem(1.25),
              transition: "rotate 50ms",
              rotate: isPlaybackRateMenuOpen() ? "180deg" : undefined,
            }}
          />
        </button>
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
                  media={props.media}
                  closeMenu={() =>
                    document.getElementById("playback-rate-menu")?.hidePopover()
                  }
                />
              </Show>
            </div>
          )}
        </Show>
        <Toggle
          active={showNativeControls()}
          onChange={() =>
            setShowNativeControls(
              (props.media.controls = !props.media.controls)
            )
          }
          icon={SlidersHorizontalIcon}
          label={
            <Show when={showNativeControls()} fallback={"Show native controls"}>
              Hide native controls
            </Show>
          }
        />
        <Toggle
          active={loop()}
          onChange={() => setLoop((props.media.loop = !props.media.loop))}
          icon={LoopIcon}
          label={
            <Show when={loop()} fallback={"Loop"}>
              Disable looping
            </Show>
          }
        />
      </div>
    </Popup>
  );
}

function MediaList() {
  const mediaElements: HTMLMediaElement[] = [];
  for (const media of document.querySelectorAll("video, audio")) {
    if (!(media instanceof HTMLMediaElement)) continue;
    mediaElements.push(media);
  }

  const [selectedMedia, setSelectedMedia] =
    createSignal<HTMLMediaElement | null>(null);

  return (
    <>
      <Show when={!selectedMedia()}>
        <Popup>
          <ListSearch
            items={mediaElements}
            itemContent={(item) => (
              <span class="qs-text-ellipsis">{item.src}</span>
            )}
            filter={(media, lq) => media.src.toLowerCase().includes(lq)}
            handleSelect={function selectMedia(media) {
              setSelectedMedia(media);
            }}
          />
        </Popup>
      </Show>
      <Show when={selectedMedia()}>
        <MediaControls
          media={selectedMedia()!}
          close={() => {
            setSelectedMedia(null);
          }}
        />
      </Show>
    </>
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

  const context = useMainContext();

  const [selectedTab, setSelectedTab] = createSignal<Tabs.Tab>();

  const tabActions = [
    {
      name: "Open tab",
      fn: function openTab() {
        const tab = selectedTab();
        if (!tab) return;
        browser.runtime.sendMessage({
          type: "activate-tab",
          tabId: tab.id,
        } satisfies Message);
      },
    },
    {
      name: "Close tab",
      fn: function closeTab() {
        const tab = selectedTab();
        if (!tab) return;
        browser.runtime.sendMessage({
          type: "close-tab",
          tabId: tab.id,
        } satisfies Message);
      },
    },
  ];

  return (
    <Show when={tabs()}>
      <Popup
        style={{
          visibility: !!selectedTab() ? "hidden" : undefined,
        }}
      >
        <ListSearch
          items={tabs()!}
          itemContent={(tab) => (
            <>
              <div class="qs-text-ellipsis" style={{ "font-weight": "bold" }}>
                {tab.title}
              </div>
              <div
                class="qs-text-ellipsis"
                style={{
                  "font-size": "smaller",
                  "grid-row": "2",
                }}
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
        <Popup>
          <ListSearch
            items={tabActions}
            itemContent={(item) => (
              <span class="qs-text-ellipsis" style={{ "font-weight": "bold" }}>
                {item.name}
              </span>
            )}
            filter={({ name }, lq) => name.toLowerCase().includes(lq)}
            handleSelect={(action) => {
              context.resetState(true);
              action.fn();
            }}
          />
        </Popup>
      </Show>
    </Show>
  );
}

function noop() {}

function DebugList() {
  const debug: number[] = [];
  for (let i = 0; i < 5000; i++) {
    debug.push(i);
  }
  return (
    <Popup>
      <ListSearch
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
  actions: Actions;
  getCurrentElement: () => HTMLElement | null;
  showDebugList: () => boolean;
}) {
  const context = useMainContext();

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
    fn: context.toggleDebugInfo,
  });

  function handleSelect(
    item: (typeof commands)[number],
    event: KeyboardEvent | MouseEvent
  ) {
    context.resetState(true);
    item.fn(event);
  }

  return (
    <Popup>
      <ListSearch
        items={commands}
        itemContent={(item) => (
          <div
            style={{ display: "flex", "align-items": "center", gap: rem(1) }}
          >
            <Show when={item.key}>
              <div>
                <Kbd>{item.key}</Kbd>
              </div>
            </Show>
            <div class="qs-text-ellipsis">{item.desc}</div>
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
    activeElement: HTMLElement | null;
    highlightInput: string;
    highlightInteractionMode: ElementInteractionMode;
  } = {
    activeElement: null,
    highlightInput: "",
    highlightInteractionMode: ElementInteractionMode.Click,
  };

  const [currentMode, setCurrentMode] = createSignal(Mode.Normal);

  const [isPassthrough, setIsPassthrough] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal("");

  const [showActionHelp, setShowActionHelp] = createSignal(false);
  const [showLinkAndButtonList, setShowListAndButtonList] = createSignal(false);
  const [showMediaList, setShowMediaList] = createSignal(false);
  const [showTabList, setShowTabList] = createSignal(false);
  const [showDebugList, setShowDebugList] = createSignal(false);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);

  const [shouldShowDebugInfo, setShouldShowDebugInfo] = createSignal(false);

  function hideAllPopups() {
    setShowActionHelp(false);
    setShowListAndButtonList(false);
    setShowMediaList(false);
    setShowTabList(false);
    setShowCommandPalette(false);
    setShowDebugList(false);
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
        elementRect.top < windowHeight &&
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
      idToHighlightElementMap.set(id as string, highlight);
      elementToHighlightMap.set(highlight, {
        type: "element",
        element,
      });
      createdHighlights++;
    }
    if (createdHighlights === 0) {
      return;
    }
    setCurrentMode(Mode.Highlight);
  }

  function handleHighlightInteraction(id: string) {
    const highlightElement = idToHighlightElementMap.get(id);
    if (!highlightElement) return;

    const highlight = elementToHighlightMap.get(highlightElement);
    if (!highlight) return;

    if (highlight.type === "element") {
      handleElementInteraction(
        highlight.element,
        highlight.element instanceof HTMLInputElement
          ? ElementInteractionMode.Focus
          : state.highlightInteractionMode
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

  function updateHighlightInput(key: string, event: KeyboardEvent) {
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
    if (filtered.length === 1 && firstResult === highlightInput) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setCurrentMode(Mode.Normal);
      state.highlightInput = "";
      handleHighlightInteraction(firstResult);
      clearAllHighlights();
    } else if (filtered.length === 0) {
      setCurrentMode(Mode.Normal);
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
      state.activeElement = element =
        document.activeElement as HTMLElement | null;
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

  function highlightInteractiveElements() {
    if (currentMode() !== Mode.Highlight) {
      state.highlightInteractionMode = ElementInteractionMode.Click;
      highlightElementsBySelector(
        `:is(a,button,input,[role^="menuitem"],[role="button"],[role="treeitem"]):not(:disabled):not([aria-disabled="true"])`
      );
    }
  }

  function highlightLinksToOpenInNewTab() {
    if (currentMode() !== Mode.Highlight) {
      state.highlightInteractionMode = ElementInteractionMode.OpenInNewTab;
      highlightElementsBySelector("a");
    }
  }

  function highlightAllInputs() {
    if (currentMode() !== Mode.Highlight) {
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

  function openNewTabToRight() {
    browser.runtime.sendMessage({
      type: "open-new-tab-next-to-current",
    } satisfies Message);
  }

  function highlightWordsForVisualMode() {
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

  const actionsMap: Record<Mode, Actions> = {
    [Mode.Normal]: {
      k: { desc: "Scroll up", fn: scrollUp },
      j: { desc: "Scroll down", fn: scrollDown },
      e: { desc: "Scroll half-page up", fn: scrollHalfPageUp },
      d: { desc: "Scroll half-page down", fn: scrollHalfPageDown },
      "g g": { desc: "Scroll to top", fn: scrollToTop },
      "S-g": { desc: "Scroll to bottom", fn: scrollToBottom },
      i: { desc: "Highlight editable elements", fn: highlightAllInputs },
      "l f": {
        desc: "List all links & buttons",
        fn: () => setShowListAndButtonList((show) => !show),
      },
      "l v": {
        desc: "List all media",
        fn: () => setShowMediaList((show) => !show),
      },
      "l t": {
        desc: "List all tabs",
        fn: () => setShowTabList((show) => !show),
      },
      "n t": {
        desc: "New tab to right",
        fn: openNewTabToRight,
      },
      f: {
        desc: "Highlight links, buttons and inputs",
        fn: highlightInteractiveElements,
      },
      "g f": {
        desc: "Highlight links to open in new tab",
        fn: highlightLinksToOpenInNewTab,
      },
      "S-?": {
        desc: "Show help",
        fn: () => {
          hideAllPopups();
          setShowActionHelp((show) => !show);
        },
      },
      p: { desc: "Toggle passthrough", fn: togglePassthrough },
      "C-p": { desc: "Show command palette", fn: toggleCommandPalette },
      v: { desc: "Visual mode", fn: highlightWordsForVisualMode },
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

  const actionKeyCombinations: Record<Mode, string[]> = {
    [Mode.Normal]: Object.keys(actionsMap[Mode.Normal]),
    [Mode.Highlight]: Object.keys(actionsMap[Mode.Highlight]),
    [Mode.VisualCaret]: Object.keys(actionsMap[Mode.VisualCaret]),
    [Mode.VisualRange]: Object.keys(actionsMap[Mode.VisualRange]),
  };

  const actionUniqueKeys: Record<Mode, Set<string>> = {
    [Mode.Normal]: new Set(
      actionKeyCombinations[Mode.Normal].flatMap((kc) => kc.split(" "))
    ),
    [Mode.Highlight]: new Set(
      actionKeyCombinations[Mode.Highlight].flatMap((kc) =>
        kc.replace(/[CSA]-/g, "").split(" ")
      )
    ),
    [Mode.VisualCaret]: new Set(
      actionKeyCombinations[Mode.VisualCaret].flatMap((kc) =>
        kc.replace(/[CSA]-/g, "").split(" ")
      )
    ),
    [Mode.VisualRange]: new Set(
      actionKeyCombinations[Mode.VisualRange].flatMap((kc) =>
        kc.replace(/[CSA]-/g, "").split(" ")
      )
    ),
  };

  function resetState(hidePopups: boolean) {
    if (hidePopups) {
      hideAllPopups();
    }
    clearAllHighlights();
    cleanupVisualModeElements();
    setKeyInput("");
    setIsPassthrough(false);
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

  function isInputElement(el: Element | EventTarget | null) {
    if (!(el instanceof Element)) return false;
    return (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      !!el?.closest('[contenteditable="true"]')
    );
  }

  const mainKeydownListener = (event: KeyboardEvent) => {
    if (keydownListeners.size > 0) {
      const listeners = Array.from(keydownListeners);
      for (let i = listeners.length - 1; i >= 0; i--) {
        const listener = listeners[i];
        if (listener(event)) {
          return;
        }
      }
    }

    const { key, ctrlKey, shiftKey, altKey, target } = event;

    if (key === "Control" || key === "Shift" || key === "Alt") {
      return;
    }

    const element = getCurrentElement();
    if (isInputElement(element) || isInputElement(target)) {
      resetState(false);
      return;
    }

    const mode = currentMode();

    if (key === "Escape" && !actionUniqueKeys[mode].has("escape")) {
      resetState(true);
      return;
    }

    if (
      !ctrlKey &&
      !shiftKey &&
      !altKey &&
      mode === Mode.Highlight &&
      key !== "Escape"
    ) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      updateHighlightInput(key, event);
      return;
    }

    const keyRepresentation = getKeyRepresentation(event);

    if (isPassthrough() && keyRepresentation !== "p") {
      return;
    }

    if (!actionUniqueKeys[mode].has(keyRepresentation)) {
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
    if (keyupListeners.size > 0) {
      const listeners = Array.from(keyupListeners);
      for (let i = listeners.length - 1; i >= 0; i--) {
        const listener = listeners[i];
        if (listener(event)) {
          return;
        }
      }
    }
    const mode = currentMode();
    const keyRepresentation = getKeyRepresentation(event);
    if (!actionUniqueKeys[mode].has(keyRepresentation)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  };

  const selectionChangeListener = () => {
    if (!collapsedCaret) return;

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

  onMount(() => {
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
  });

  onCleanup(() => {
    controller.abort();
  });

  return (
    <mainContext.Provider
      value={{
        shouldShowDebugInfo,
        toggleDebugInfo: () => setShouldShowDebugInfo((b) => !b),
        hideAllPopups,
        resetState,
        registerKeydownListener,
        registerKeyupListener,
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
      <Show when={keyInput().length > 0 || showActionHelp()}>
        <ActionsHelp
          keyInput={keyInput()}
          actions={actionsMap[currentMode()]}
          actionKeys={actionKeyCombinations[currentMode()]}
        />
      </Show>
      <Show when={showLinkAndButtonList()}>
        <SearchLinksAndButtons />
      </Show>
      <Show when={showMediaList()}>
        <MediaList />
      </Show>
      <Show when={showTabList()}>
        <TabList />
      </Show>
      <Show when={showDebugList()}>
        <DebugList />
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
        <CommandPalette
          actions={actionsMap[currentMode()]}
          getCurrentElement={getCurrentElement}
          showDebugList={() => setShowDebugList(true)}
        />
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
.qs-input:focus-visible { outline: 2px solid cornflowerblue; }
.qs-popup > * { min-height: 0; }
.qs-popup ::-webkit-scrollbar { width: 16px; }
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
.qs-outline-btn { background: transparent; }
.qs-outline-btn:hover { background: ${Colors["cb-dark-60"]}; }
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
.sr-only {
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
    </mainContext.Provider>
  );
}

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  cssInjectionMode: "ui",
  main(ctx) {
    log("info", "Loaded content script");

    const ui = createIntegratedUi(ctx, {
      position: "inline",
      onMount(uiContainer) {
        render(() => <Root />, uiContainer);
      },
    });
    ui.mount();
  },
});
