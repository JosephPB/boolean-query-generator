const boardElement = document.getElementById("board");
const addTopicBtn = document.getElementById("addTopicBtn");
const addTopicMenu = document.getElementById("addTopicMenu");
const brandwatchBtn = document.getElementById("brandwatchBtn");
const mclBtn = document.getElementById("mclBtn");
const outputSection = document.getElementById("outputSection");
const outputTextarea = document.getElementById("outputTextarea");
const copyBtn = document.getElementById("copyBtn");
const copyStatus = document.getElementById("copyStatus");
const validationMsg = document.getElementById("validationMsg");
const notWarning = document.getElementById("notWarning");

const state = { cards: [] };
let cardIdSeed = 0;
let pendingFocusCardId = null;
let pendingScrollCardId = null;
let menuOpen = false;
let draggedCardId = null;
let draggingCardElement = null;
let dropPlaceholder = null;
let dropTargetIndex = null;
const notWarningText =
  "Topics excluded using the NOT operator is applied over the whole query, please add any more keywords or phrases to exclude to the existing NOT topic";

function generateId() {
  cardIdSeed += 1;
  return `card-${Date.now()}-${cardIdSeed}`;
}

function normalizeToken(value) {
  return value.replace(/\s+/g, " ").trim();
}

function ensureDropPlaceholder() {
  if (!dropPlaceholder) {
    dropPlaceholder = document.createElement("div");
    dropPlaceholder.className = "drop-placeholder";
  }
}

function clearDropPlaceholder() {
  if (dropPlaceholder && dropPlaceholder.parentElement) {
    dropPlaceholder.remove();
  }
  dropTargetIndex = null;
}

function updateDropPlaceholderPosition(event) {
  ensureDropPlaceholder();
  if (!draggedCardId) {
    return;
  }
  if (dropPlaceholder.contains && dropPlaceholder.contains(event.target)) {
    return;
  }
  const cards = Array.from(boardElement.querySelectorAll(".topic-card")).filter(
    (entry) => entry.dataset.cardId !== draggedCardId,
  );
  const targetCard = event.target.closest(".topic-card");
  const pointerX = event.clientX;
  if (targetCard && targetCard.dataset.cardId !== draggedCardId) {
    const cardIndex = cards.findIndex(
      (entry) => entry.dataset.cardId === targetCard.dataset.cardId,
    );
    if (cardIndex !== -1) {
      const rect = targetCard.getBoundingClientRect();
      const before = pointerX < rect.left + rect.width * 0.35;
      const referenceNode = before ? targetCard : targetCard.nextElementSibling;
      if (referenceNode === dropPlaceholder) {
        dropTargetIndex = before ? cardIndex : cardIndex + 1;
        return;
      }
      boardElement.insertBefore(dropPlaceholder, referenceNode);
      dropPlaceholder.style.height = `${targetCard.offsetHeight}px`;
      dropPlaceholder.style.width = `${targetCard.offsetWidth}px`;
      dropTargetIndex = before ? cardIndex : cardIndex + 1;
      return;
    }
  }
  boardElement.appendChild(dropPlaceholder);
  const referenceCard = cards[cards.length - 1] || cards[0];
  dropPlaceholder.style.height = `${referenceCard?.offsetHeight || 150}px`;
  dropPlaceholder.style.width = `${referenceCard?.offsetWidth || 280}px`;
  dropTargetIndex = cards.length;
}

function ensureNotCardAtEnd() {
  const notIndex = state.cards.findIndex((card) => card.relation === "NOT");
  if (notIndex > -1 && notIndex !== state.cards.length - 1) {
    const [notCard] = state.cards.splice(notIndex, 1);
    state.cards.push(notCard);
  }
  if (state.cards.length) {
    state.cards[0].relation = "START";
  }
}

function renderBoard() {
  ensureNotCardAtEnd();
  clearDropPlaceholder();
  boardElement.innerHTML = "";
  state.cards.forEach((card, index) => {
    const cardEl = document.createElement("section");
    cardEl.className = "topic-card";
    cardEl.dataset.cardId = card.id;
    cardEl.setAttribute("role", "listitem");

    const header = document.createElement("div");
    header.className = "card-header";
    const title = document.createElement("h3");
    title.textContent = `Topic ${index + 1}`;
    const badge = document.createElement("span");
    badge.className = "relation-badge";
    badge.dataset.relation = card.relation;
    badge.textContent = card.relation === "START" ? "START" : card.relation;
    header.append(title, badge);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "delete-topic";
    deleteBtn.textContent = "Delete topic";
    deleteBtn.setAttribute("aria-label", `Delete topic ${index + 1}`);
    deleteBtn.disabled = state.cards.length === 1;
    deleteBtn.addEventListener("click", () => removeCard(card.id));

    const topControls = document.createElement("div");
    topControls.className = "card-controls";
    topControls.setAttribute("title", "Drag to reorder topics");

    cardEl.setAttribute("draggable", "true");
    cardEl.addEventListener("dragstart", (event) =>
      handleDragStart(event, cardEl),
    );
    cardEl.addEventListener("dragend", handleDragEnd);

    topControls.append(header, deleteBtn);

    const body = document.createElement("div");
    body.className = "card-body";

    if (index > 0) {
      const relationWrap = document.createElement("div");
      relationWrap.className = "relation-select-wrap";

      const relationLabel = document.createElement("label");
      relationLabel.setAttribute("for", `relation-${card.id}`);
      relationLabel.textContent = "Linked with";

      const relationSelect = document.createElement("select");
      relationSelect.id = `relation-${card.id}`;
      ["AND", "OR", "NOT"].forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        relationSelect.append(option);
      });
      relationSelect.value = card.relation;
      relationSelect.addEventListener("change", (event) => {
        hideNotWarning();
        const selected = event.target.value;
        const hasOtherNot =
          selected === "NOT" &&
          state.cards.some(
            (entry) => entry.relation === "NOT" && entry.id !== card.id,
          );
        if (hasOtherNot) {
          showNotWarning(notWarningText);
          event.target.value = card.relation;
          return;
        }
        card.relation = selected;
        if (selected === "NOT") {
          ensureNotCardAtEnd();
        }
        renderBoard();
      });

      relationWrap.append(relationLabel, relationSelect);
      body.append(relationWrap);
    }

    const chipList = document.createElement("div");
    chipList.className = "chip-list";
    card.tokens.forEach((token) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = token;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "chip-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.setAttribute(
        "aria-label",
        `Remove ${token} from ${title.textContent}`,
      );
      removeBtn.addEventListener("click", () => {
        removeTokenFromCard(card.id, token);
      });

      chip.append(removeBtn);
      chipList.append(chip);
    });

    const label = document.createElement("label");
    label.className = "sr-only";
    label.setAttribute("for", `topic-input-${card.id}`);
    label.textContent = `Add keyword for ${title.textContent}`;

    const input = document.createElement("input");
    input.type = "text";
    input.id = `topic-input-${card.id}`;
    input.placeholder = "Add keyword or phrase";
    input.autocomplete = "off";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        commitToken(card.id, input);
      }
    });

    body.append(chipList, label, input);
    cardEl.append(topControls, body);
    boardElement.appendChild(cardEl);

    if (card.id === pendingFocusCardId) {
      setTimeout(() => {
        input.focus();
        pendingFocusCardId = null;
      }, 0);
    }
  });

  if (pendingScrollCardId) {
    const target = boardElement.querySelector(
      `[data-card-id="${pendingScrollCardId}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", inline: "start" });
    pendingScrollCardId = null;
  }
}

function handleDragStart(event, cardEl) {
  if (event.target.closest(".delete-topic")) {
    event.preventDefault();
    return;
  }
  clearDropPlaceholder();
  draggedCardId = cardEl.dataset.cardId;
  draggingCardElement = cardEl;
  cardEl.classList.add("dragging");
  requestAnimationFrame(() => {
    cardEl.classList.add("drag-hidden");
  });
  event.dataTransfer?.setData("text/plain", draggedCardId);
  event.dataTransfer?.setDragImage(cardEl, 0, 0);
  event.dataTransfer?.setDropEffect("move");
}

function handleDragEnd() {
  clearDropPlaceholder();
  if (draggingCardElement) {
    draggingCardElement.classList.remove("dragging");
    draggingCardElement.classList.remove("drag-hidden");
    draggingCardElement = null;
  }
  draggedCardId = null;
}

function handleBoardDragOver(event) {
  if (!draggedCardId) {
    return;
  }
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  updateDropPlaceholderPosition(event);
}

function handleBoardDrop(event) {
  if (!draggedCardId) {
    return;
  }
  event.preventDefault();
  const targetIndex = dropTargetIndex ?? state.cards.length;
  clearDropPlaceholder();
  insertCardAt(draggedCardId, targetIndex);
  handleDragEnd();
}

function insertCardAt(draggedId, targetIndex) {
  const draggedIndex = state.cards.findIndex((entry) => entry.id === draggedId);
  if (draggedIndex === -1) {
    return;
  }
  const [movedCard] = state.cards.splice(draggedIndex, 1);
  let insertIndex =
    typeof targetIndex === "number"
      ? Math.max(0, targetIndex)
      : state.cards.length;
  if (insertIndex > state.cards.length) {
    insertIndex = state.cards.length;
  }
  if (insertIndex > draggedIndex) {
    insertIndex = Math.max(0, insertIndex - 1);
  }
  state.cards.splice(insertIndex, 0, movedCard);
  ensureNotCardAtEnd();
  pendingScrollCardId = draggedId;
  renderBoard();
}

function commitToken(cardId, inputElement) {
  const rawValue = inputElement.value;
  const normalized = normalizeToken(rawValue);
  if (!normalized) {
    inputElement.value = "";
    return;
  }

  const card = state.cards.find((entry) => entry.id === cardId);
  if (!card) {
    inputElement.value = "";
    return;
  }

  const duplicate = card.tokens.some(
    (entry) => entry.toLowerCase() === normalized.toLowerCase(),
  );
  if (duplicate) {
    inputElement.value = "";
    return;
  }

  card.tokens.push(normalized);
  inputElement.value = "";
  pendingFocusCardId = cardId;
  renderBoard();
}

function removeTokenFromCard(cardId, token) {
  const card = state.cards.find((entry) => entry.id === cardId);
  if (!card) {
    return;
  }
  card.tokens = card.tokens.filter((entry) => entry !== token);
  pendingFocusCardId = cardId;
  renderBoard();
}

function addCard(relation) {
  const newCard = { id: generateId(), relation, tokens: [] };
  state.cards.push(newCard);
  pendingFocusCardId = newCard.id;
  pendingScrollCardId = newCard.id;
  renderBoard();
}

function removeCard(cardId) {
  if (state.cards.length === 1) {
    return;
  }
  const card = state.cards.find((entry) => entry.id === cardId);
  state.cards = state.cards.filter((entry) => entry.id !== cardId);
  ensureNotCardAtEnd();
  if (!state.cards.some((entry) => entry.relation === "NOT")) {
    hideNotWarning();
  }
  pendingFocusCardId = state.cards[0].id;
  renderBoard();
}

function openAddMenu() {
  addTopicMenu.classList.add("open");
  addTopicBtn.setAttribute("aria-expanded", "true");
  addTopicMenu.setAttribute("aria-hidden", "false");
  menuOpen = true;
  requestAnimationFrame(() => {
    addTopicMenu.querySelector("button")?.focus();
  });
}

function closeAddMenu() {
  addTopicMenu.classList.remove("open");
  addTopicBtn.setAttribute("aria-expanded", "false");
  addTopicMenu.setAttribute("aria-hidden", "true");
  menuOpen = false;
}

function showNotWarning(message) {
  notWarning.textContent = message;
  notWarning.classList.remove("hidden");
}

function hideNotWarning() {
  notWarning.textContent = "";
  notWarning.classList.add("hidden");
}

function prepareCardExpressions(cards, expressionBuilder) {
  const expressions = [];
  cards.forEach((card) => {
    if (!card.tokens.length) {
      return;
    }
    const expression = expressionBuilder(card);
    if (!expression) {
      return;
    }
    expressions.push({ relation: card.relation, expression });
  });
  if (expressions.length) {
    expressions[0].relation = "START";
  }
  return expressions;
}

function buildSegments(cardExpressions) {
  if (!cardExpressions.length) {
    return [];
  }
  const segments = [];
  let currentConnector = null;
  let currentExpressions = [cardExpressions[0].expression];

  for (let i = 1; i < cardExpressions.length; i += 1) {
    const card = cardExpressions[i];
    if (card.relation === "AND") {
      currentExpressions.push(card.expression);
      continue;
    }
    segments.push({
      expressions: currentExpressions,
      connector: currentConnector,
    });
    currentConnector = card.relation;
    currentExpressions = [card.expression];
  }

  segments.push({
    expressions: currentExpressions,
    connector: currentConnector,
  });
  return segments;
}

function combineSegments(segments, formatter, connectorFn) {
  if (!segments.length) {
    return "";
  }
  let expression = "";
  segments.forEach((segment, index) => {
    const segmentExpression = formatter(segment);
    if (!segmentExpression) {
      return;
    }
    if (index === 0) {
      expression = segmentExpression;
      return;
    }
    expression = `${expression}${connectorFn(segment.connector)}${segmentExpression}`;
  });
  return expression;
}

function formatBrandwatchToken(token) {
  const escaped = token.replace(/"/g, '\\"');
  return /\s/.test(token) ? `"${escaped}"` : escaped;
}

function createBrandwatchCardExpression(card) {
  const terms = card.tokens.map((token) => formatBrandwatchToken(token));
  return terms.length ? `(${terms.join(" OR ")})` : "";
}

function createMclCardExpression(card) {
  const segments = card.tokens
    .map((token) => expandMclToken(token))
    .filter(Boolean);
  return segments.length ? `(${segments.join(" | ")})` : "";
}

function expandMclToken(token) {
  const words = token.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "";
  }
  if (words.length === 1) {
    return words[0];
  }
  return `(${words.join(" & ")})`;
}

function buildBrandwatch(cards) {
  const mainCards = cards.filter((card) => card.relation !== "NOT");
  const expressions = prepareCardExpressions(
    mainCards,
    createBrandwatchCardExpression,
  );
  const segments = buildSegments(expressions);
  let expression = combineSegments(
    segments,
    formatBrandwatchSegment,
    brandwatchConnector,
  );
  const notCard = cards.find((card) => card.relation === "NOT");
  const notExpression = notCard ? createBrandwatchCardExpression(notCard) : "";
  if (!expression && notExpression) {
    return `NOT ${notExpression}`;
  }
  if (expression && notExpression) {
    return `(${expression}) NOT ${notExpression}`;
  }
  return expression;
}

function buildMcl(cards) {
  const mainCards = cards.filter((card) => card.relation !== "NOT");
  const expressions = prepareCardExpressions(
    mainCards,
    createMclCardExpression,
  );
  const segments = buildSegments(expressions);
  let expression = combineSegments(segments, formatMclSegment, mclConnector);
  const notCard = cards.find((card) => card.relation === "NOT");
  const notExpression = notCard ? formatMclNotSegment(notCard) : "";
  if (!expression && notExpression) {
    return notExpression;
  }
  if (expression && notExpression) {
    return `(${expression}) ${notExpression}`;
  }
  return expression;
}

function formatBrandwatchSegment(segment) {
  if (segment.expressions.length === 1) {
    return segment.expressions[0];
  }
  return `(${segment.expressions.join(" AND ")})`;
}

function formatMclSegment(segment) {
  if (segment.expressions.length === 1) {
    return segment.expressions[0];
  }
  return `(${segment.expressions.join(" & ")})`;
}

function formatMclNotSegment(card) {
  if (!card.tokens.length) {
    return "";
  }
  return card.tokens.map((token) => `-${token}`).join(" ");
}

function brandwatchConnector(relation) {
  if (relation === "OR") {
    return " OR ";
  }
  if (relation === "NOT") {
    return " NOT ";
  }
  return " AND ";
}

function mclConnector(relation) {
  if (relation === "OR") {
    return " | ";
  }
  if (relation === "NOT") {
    return " - ";
  }
  return " & ";
}

function validateMclTokens(cards) {
  const invalid = [];
  cards.forEach((card) => {
    card.tokens.forEach((token) => {
      if (token.includes("*")) {
        const reason =
          "Meta Content Library does not allow wildcard characters.";
        if (
          !invalid.some(
            (entry) => entry.token === token && entry.reason === reason,
          )
        ) {
          invalid.push({ token, reason });
        }
      }
      if (card.relation === "NOT" && /\s/.test(token)) {
        const reason =
          "Meta Content Library only supports single-word keywords in NOT topics.";
        if (
          !invalid.some(
            (entry) => entry.token === token && entry.reason === reason,
          )
        ) {
          invalid.push({ token, reason });
        }
      }
    });
  });
  return invalid;
}

function displayValidation(message) {
  showOutput("", message);
}

function showOutput(query, message) {
  if (!query && !message) {
    outputSection.classList.add("hidden");
    return;
  }
  outputSection.classList.remove("hidden");
  outputTextarea.value = query;
  copyBtn.disabled = !query;
  validationMsg.textContent = message || "";
  copyStatus.textContent = "";
}

function handleBrandwatchGenerate() {
  const activeCards = state.cards.filter((card) => card.tokens.length > 0);
  if (!activeCards.length) {
    displayValidation(
      "Add at least one keyword token before generating a query.",
    );
    return;
  }
  const query = buildBrandwatch(activeCards);
  showOutput(query, "");
}

function handleMclGenerate() {
  const activeCards = state.cards.filter((card) => card.tokens.length > 0);
  if (!activeCards.length) {
    displayValidation(
      "Add at least one keyword token before generating a query.",
    );
    return;
  }
  const invalidTokens = validateMclTokens(activeCards);
  if (invalidTokens.length) {
    const invalidList = invalidTokens
      .map((entry) => `"${entry.token}"`)
      .join(", ");
    const reasonText = Array.from(
      new Set(invalidTokens.map((entry) => entry.reason)),
    ).join(" ");
    displayValidation(`${reasonText} Invalid tokens: ${invalidList}.`);
    return;
  }
  const query = buildMcl(activeCards);
  showOutput(query, "");
}

function copyOutput() {
  const query = outputTextarea.value;
  if (!query) {
    return;
  }
  const doCopy = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(query)
    : new Promise((resolve, reject) => {
        try {
          outputTextarea.select();
          document.execCommand("copy");
          resolve();
        } catch (err) {
          reject(err);
        }
      });

  doCopy
    .then(() => {
      copyStatus.textContent = "Copied";
      setTimeout(() => {
        copyStatus.textContent = "";
      }, 2500);
    })
    .catch(() => {
      copyStatus.textContent = "Unable to copy";
      setTimeout(() => {
        copyStatus.textContent = "";
      }, 2500);
    });
}

addTopicBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  if (menuOpen) {
    closeAddMenu();
    return;
  }
  openAddMenu();
});

addTopicMenu.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-relation]");
  if (!button) {
    return;
  }
  const relation = button.dataset.relation;
  if (
    relation === "NOT" &&
    state.cards.some((entry) => entry.relation === "NOT")
  ) {
    showNotWarning(notWarningText);
    closeAddMenu();
    return;
  }
  hideNotWarning();
  addCard(relation);
  closeAddMenu();
});

document.addEventListener("click", (event) => {
  if (
    menuOpen &&
    !addTopicMenu.contains(event.target) &&
    event.target !== addTopicBtn
  ) {
    closeAddMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (menuOpen && event.key === "Escape") {
    closeAddMenu();
    addTopicBtn.focus();
  }
});

boardElement.addEventListener("dragover", handleBoardDragOver);
boardElement.addEventListener("drop", handleBoardDrop);

brandwatchBtn.addEventListener("click", handleBrandwatchGenerate);
mclBtn.addEventListener("click", handleMclGenerate);
copyBtn.addEventListener("click", copyOutput);

function initialize() {
  state.cards.push({ id: generateId(), relation: "START", tokens: [] });
  renderBoard();
}

initialize();
