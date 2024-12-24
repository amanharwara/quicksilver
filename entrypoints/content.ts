function log(...args: any[]) {
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
    styles?: {
      [key in keyof Partial<CSSStyleDeclaration>]: string;
    };
    children?: HTMLElement[];
    text?: string;
  } = {},
) {
  const element = document.createElement(tag);
  const { styles, children, text } = options;
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

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  main() {
    log("Loaded content script");

    const letters = Array(26)
      .fill(0)
      .map((_, index) => {
        let i = index + 97;
        return String.fromCharCode(i);
      });

    function generateIDfromIndex(index: number) {
      if (index <= 25) {
        return letters[index];
      }
      let floor = Math.floor(index / 25);
      let id = letters[floor];
      let t = index;
      for (let i = 0; i < floor; i++) {
        id += letters[(t -= 25) % letters.length];
      }
      return id;
    }

    const state: {
      activeElement: HTMLElement | null;
      lastKeyEvent: KeyboardEvent | null;
      highlightsContainer: HTMLElement;
      highlightState: HighlightState;
      highlightInput: string;
    } = {
      activeElement: null,
      lastKeyEvent: null,
      highlightsContainer: createElement("div", {
        styles: {
          position: "fixed",
          pointerEvents: "none",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
        },
      }),
      highlightState: HighlightState.None,
      highlightInput: "",
    };

    document.body.append(state.highlightsContainer);

    const idToHighlightMap = new Map<string, HTMLElement>();
    const highlightToLinkMap = new Map<HTMLElement, HTMLAnchorElement>();

    function clearAllHighlights() {
      for (const [id, highlight] of idToHighlightMap) {
        highlight.remove();
        idToHighlightMap.delete(id);
        highlightToLinkMap.delete(highlight);
      }
    }

    function highlightLinks() {
      clearAllHighlights();
      const links = document.querySelectorAll("a");
      const linkRects = links
        .values()
        .map((linkEl) => linkEl.getBoundingClientRect())
        .toArray();
      for (let index = 0; index < links.length; index++) {
        const link = links[index];
        const linkRect = linkRects[index];
        const id = generateIDfromIndex(index);
        const highlight = createElement("div", {
          styles: {
            position: "absolute",
            top: "0",
            left: "0",
            translate: `${linkRect.x}px ${linkRect.y}px`,
            background: `hsl(${index % 360}deg 80% 80%)`,
          },
          text: id,
        });
        state.highlightsContainer.append(highlight);
        idToHighlightMap.set(id, highlight);
        highlightToLinkMap.set(highlight, link);
      }
      state.highlightState = HighlightState.Highlighted;
    }

    function openLinkById(id: string) {
      const highlight = idToHighlightMap.get(id);
      if (!highlight) {
        return;
      }
      const link = highlightToLinkMap.get(highlight);
      if (link) {
        link.click();
      }
    }

    function updateHighlightInput(key: string) {
      const lengthRequired = idToHighlightMap.size;
      if (lengthRequired <= 26) {
        let ids = idToHighlightMap.keys();
        if (ids.find((id) => id === key)) {
          openLinkById(key);
        }
        clearAllHighlights();
        state.highlightState = HighlightState.None;
      }
    }

    document.documentElement.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement) {
        state.activeElement = event.target;
      }
    });

    document.body.addEventListener("focusin", (event) => {
      if (event.target instanceof HTMLElement) {
        state.activeElement = event.target;
      }
    });

    document.documentElement.addEventListener("keydown", (event) => {
      let lastKeyEvent = state.lastKeyEvent;
      state.lastKeyEvent = event;
      const element = state.activeElement || document.activeElement;
      if (!(element instanceof HTMLElement)) {
        return;
      }
      const { key, ctrlKey, shiftKey, altKey } = event;
      if (
        !ctrlKey &&
        !shiftKey &&
        !altKey &&
        state.highlightState === HighlightState.Highlighted
      ) {
        updateHighlightInput(key);
        return;
      }
      const isScrollHalfPageDown = !ctrlKey && key === "d";
      const isScrollHalfPageUp = !ctrlKey && key === "e";
      const isDoubleG = lastKeyEvent
        ? key === "g" &&
          !(shiftKey || ctrlKey) &&
          lastKeyEvent.key === "g" &&
          !(lastKeyEvent.shiftKey || lastKeyEvent.ctrlKey) &&
          lastKeyEvent.timeStamp - event.timeStamp < 100
        : false;
      const isShiftG = shiftKey && key === "G";
      let elementToScroll: HTMLElement | null = null;
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement
      ) {
        log("activeElement is input/textarea");
        return;
      }
      if (element) {
        elementToScroll = isElementOverflowing(element)
          ? element
          : findOverflowingParent(element);
      }
      if (!elementToScroll) {
        elementToScroll = document.documentElement;
      }
      if (isScrollHalfPageDown) {
        event.preventDefault();
        elementToScroll.scrollBy({
          top: window.innerHeight / 2,
        });
      } else if (key === "j") {
        event.preventDefault();
        elementToScroll.scrollBy({
          top: 70,
        });
      } else if (isScrollHalfPageUp) {
        event.preventDefault();
        elementToScroll.scrollBy({
          top: -(window.innerHeight / 2),
        });
      } else if (key === "k") {
        event.preventDefault();
        elementToScroll.scrollBy({
          top: -70,
        });
      } else if (isDoubleG) {
        event.preventDefault();
        elementToScroll.scrollTop = 0;
      } else if (isShiftG) {
        event.preventDefault();
        elementToScroll.scrollTop = elementToScroll.scrollHeight;
      } else if (key === "f" && !ctrlKey && !shiftKey) {
        if (state.highlightState === HighlightState.None) {
          highlightLinks();
        }
      } else if (key === "Escape") {
        clearAllHighlights();
        state.highlightState = HighlightState.None;
      }
    });
  },
});
