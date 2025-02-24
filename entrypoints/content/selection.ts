export function extendSelectionByCharToLeft() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("extend", "left", "character");
}

export function extendSelectionByCharToRight() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("extend", "right", "character");
}

export function extendSelectionByWordToRight() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("extend", "right", "word");
}

export function extendSelectionByWordToLeft() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("extend", "left", "word");
}

export function moveSelectionToLeftBySentence() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("move", "left", "sentence");
}

export function moveSelectionToRightBySentence() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("move", "right", "sentence");
}

export function extendSelectionToLeftBySentence() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("extend", "left", "sentence");
}

export function extendSelectionToRightBySentence() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("extend", "right", "sentence");
}

export function selectCurrentParagraph() {
  const selection = getSelection();
  if (!selection || !selection.anchorNode) return;
  const node = selection.anchorNode;
  const paragraph = node.parentElement?.closest("p,div");
  if (paragraph) {
    selection.selectAllChildren(paragraph);
  }
}

export function selectCurrentWord() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("move", "left", "word");
  selection.modify("extend", "right", "word");
}

export function moveSelectionByWordToLeft() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("move", "left", "word");
}

export function moveSelectionByCharToLeft() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("move", "left", "character");
}

export function moveSelectionByCharToRight() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("move", "right", "character");
}

export function moveSelectionByWordToRight() {
  const selection = getSelection();
  if (!selection) return;
  selection.modify("move", "right", "word");
}

export function collapseSelectionToEnd() {
  const selection = getSelection();
  if (!selection) return;
  selection.collapse(selection.focusNode, selection.focusOffset);
}
