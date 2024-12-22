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

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  matchOriginAsFallback: true,
  main() {
    log("Loaded content script");
    const state: {
      activeElement: HTMLElement | null;
      lastKeyEvent: KeyboardEvent | null;
    } = {
      activeElement: null,
      lastKeyEvent: null,
    };
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
      const { key, ctrlKey, shiftKey } = event;
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
      }
    });
  },
});
