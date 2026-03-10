const boardElement = document.getElementById('board');
const addTopicBtn = document.getElementById('addTopicBtn');
const addTopicMenu = document.getElementById('addTopicMenu');
const brandwatchBtn = document.getElementById('brandwatchBtn');
const mclBtn = document.getElementById('mclBtn');
const outputSection = document.getElementById('outputSection');
const outputTextarea = document.getElementById('outputTextarea');
const copyBtn = document.getElementById('copyBtn');
const copyStatus = document.getElementById('copyStatus');
const validationMsg = document.getElementById('validationMsg');

const state = { cards: [] };
let cardIdSeed = 0;
let pendingFocusCardId = null;
let pendingScrollCardId = null;
let menuOpen = false;

function generateId() {
  cardIdSeed += 1;
  return `card-${Date.now()}-${cardIdSeed}`;
}

function normalizeToken(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function renderBoard() {
  boardElement.innerHTML = '';
  state.cards.forEach((card, index) => {
    const cardEl = document.createElement('section');
    cardEl.className = 'topic-card';
    cardEl.dataset.cardId = card.id;
    cardEl.setAttribute('role', 'listitem');

    const header = document.createElement('div');
    header.className = 'card-header';
    const title = document.createElement('h3');
    title.textContent = `Topic ${index + 1}`;
    const badge = document.createElement('span');
    badge.className = 'relation-badge';
    badge.textContent = card.relation === 'START' ? 'START' : card.relation;
    header.append(title, badge);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-topic';
    deleteBtn.textContent = 'Delete topic';
    deleteBtn.setAttribute('aria-label', `Delete topic ${index + 1}`);
    deleteBtn.disabled = state.cards.length === 1;
    deleteBtn.addEventListener('click', () => removeCard(card.id));

    const topControls = document.createElement('div');
    topControls.className = 'card-controls';
    topControls.append(header, deleteBtn);

    const body = document.createElement('div');
    body.className = 'card-body';

    if (index > 0) {
      const relationWrap = document.createElement('div');
      relationWrap.className = 'relation-select-wrap';

      const relationLabel = document.createElement('label');
      relationLabel.setAttribute('for', `relation-${card.id}`);
      relationLabel.textContent = 'Linked with';

      const relationSelect = document.createElement('select');
      relationSelect.id = `relation-${card.id}`;
      ['AND', 'OR', 'NOT'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        relationSelect.append(option);
      });
      relationSelect.value = card.relation;
      relationSelect.addEventListener('change', (event) => {
        card.relation = event.target.value;
        renderBoard();
      });

      relationWrap.append(relationLabel, relationSelect);
      body.append(relationWrap);
    }

    const chipList = document.createElement('div');
    chipList.className = 'chip-list';
    card.tokens.forEach((token) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = token;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'chip-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.setAttribute('aria-label', `Remove ${token} from ${title.textContent}`);
      removeBtn.addEventListener('click', () => {
        removeTokenFromCard(card.id, token);
      });

      chip.append(removeBtn);
      chipList.append(chip);
    });

    const label = document.createElement('label');
    label.className = 'sr-only';
    label.setAttribute('for', `topic-input-${card.id}`);
    label.textContent = `Add keyword for ${title.textContent}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `topic-input-${card.id}`;
    input.placeholder = 'Add keyword';
    input.autocomplete = 'off';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
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
    const target = boardElement.querySelector(`[data-card-id="${pendingScrollCardId}"]`);
    target?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
    pendingScrollCardId = null;
  }
}

function commitToken(cardId, inputElement) {
  const rawValue = inputElement.value;
  const normalized = normalizeToken(rawValue);
  if (!normalized) {
    inputElement.value = '';
    return;
  }

  const card = state.cards.find((entry) => entry.id === cardId);
  if (!card) {
    inputElement.value = '';
    return;
  }

  const duplicate = card.tokens.some((entry) => entry.toLowerCase() === normalized.toLowerCase());
  if (duplicate) {
    inputElement.value = '';
    return;
  }

  card.tokens.push(normalized);
  inputElement.value = '';
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
  state.cards = state.cards.filter((entry) => entry.id !== cardId);
  if (!state.cards.length) {
    state.cards.push({ id: generateId(), relation: 'START', tokens: [] });
  }
  state.cards[0].relation = 'START';
  pendingFocusCardId = state.cards[0].id;
  renderBoard();
}

function openAddMenu() {
  addTopicMenu.classList.add('open');
  addTopicBtn.setAttribute('aria-expanded', 'true');
  addTopicMenu.setAttribute('aria-hidden', 'false');
  menuOpen = true;
  requestAnimationFrame(() => {
    addTopicMenu.querySelector('button')?.focus();
  });
}

function closeAddMenu() {
  addTopicMenu.classList.remove('open');
  addTopicBtn.setAttribute('aria-expanded', 'false');
  addTopicMenu.setAttribute('aria-hidden', 'true');
  menuOpen = false;
}

function buildBrandwatch(cards) {
  const cardExpressions = cards.map((card) => ({
    relation: card.relation,
    expression: createBrandwatchCardExpression(card),
  }));
  const segments = buildSegments(cardExpressions);
  let expression = '';
  segments.forEach((segment, index) => {
    const segmentExpression = formatBrandwatchSegment(segment);
    if (index === 0) {
      expression = segmentExpression;
      return;
    }
    expression = `${expression}${brandwatchConnector(segment.connector)}${segmentExpression}`;
  });
  return expression;
}

function formatBrandwatchToken(token) {
  const escaped = token.replace(/"/g, '\\\"');
  return /\s/.test(token) ? `"${escaped}"` : escaped;
}

function buildMcl(cards) {
  const cardExpressions = cards.map((card) => ({
    relation: card.relation,
    expression: createMclCardExpression(card),
  }));
  const segments = buildSegments(cardExpressions);
  let expression = '';
  segments.forEach((segment, index) => {
    const segmentExpression = formatMclSegment(segment);
    if (index === 0) {
      expression = segmentExpression;
      return;
    }
    expression = `${expression}${mclConnector(segment.connector)}${segmentExpression}`;
  });
  return expression;
}

function createBrandwatchCardExpression(card) {
  const terms = card.tokens.map((token) => formatBrandwatchToken(token));
  return terms.length ? `(${terms.join(' OR ')})` : '';
}

function createMclCardExpression(card) {
  const segments = card.tokens
    .map((token) => expandMclToken(token))
    .filter(Boolean);
  return segments.length ? `(${segments.join(' | ')})` : '';
}

function expandMclToken(token) {
  const words = token.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '';
  }
  if (words.length === 1) {
    return words[0];
  }
  return `(${words.join(' & ')})`;
}

function buildSegments(cardExpressions) {
  const segments = [];
  let currentConnector = null;
  let currentExpressions = [cardExpressions[0].expression];

  for (let i = 1; i < cardExpressions.length; i += 1) {
    const card = cardExpressions[i];
    if (card.relation === 'AND') {
      currentExpressions.push(card.expression);
      continue;
    }
    segments.push({ expressions: currentExpressions, connector: currentConnector });
    currentConnector = card.relation;
    currentExpressions = [card.expression];
  }

  segments.push({ expressions: currentExpressions, connector: currentConnector });
  return segments;
}

function formatBrandwatchSegment(segment) {
  if (segment.expressions.length === 1) {
    return segment.expressions[0];
  }
  return `(${segment.expressions.join(' AND ')})`;
}

function formatMclSegment(segment) {
  if (segment.expressions.length === 1) {
    return segment.expressions[0];
  }
  return `(${segment.expressions.join(' & ')})`;
}

function brandwatchConnector(relation) {
  if (relation === 'OR') {
    return ' OR ';
  }
  if (relation === 'NOT') {
    return ' NOT ';
  }
  return ' AND ';
}

function mclConnector(relation) {
  if (relation === 'OR') {
    return ' | ';
  }
  if (relation === 'NOT') {
    return ' - ';
  }
  return ' & ';
}

function validateMclTokens(cards) {
  const invalid = [];
  cards.forEach((card) => {
    card.tokens.forEach((token) => {
      if (token.includes('*')) {
        invalid.push(token);
      }
    });
  });
  return invalid;
}

function displayValidation(message) {
  showOutput('', message);
}

function showOutput(query, message) {
  if (!query && !message) {
    outputSection.classList.add('hidden');
    return;
  }
  outputSection.classList.remove('hidden');
  outputTextarea.value = query;
  copyBtn.disabled = !query;
  validationMsg.textContent = message || '';
  copyStatus.textContent = '';
}

function handleBrandwatchGenerate() {
  const activeCards = state.cards.filter((card) => card.tokens.length > 0);
  if (!activeCards.length) {
    displayValidation('Add at least one keyword token before generating a query.');
    return;
  }
  const query = buildBrandwatch(activeCards);
  showOutput(query, '');
}

function handleMclGenerate() {
  const activeCards = state.cards.filter((card) => card.tokens.length > 0);
  if (!activeCards.length) {
    displayValidation('Add at least one keyword token before generating a query.');
    return;
  }
  const invalidTokens = validateMclTokens(activeCards);
  if (invalidTokens.length) {
    const invalidList = invalidTokens.map((token) => `"${token}"`).join(', ');
    displayValidation(
      `Meta Content Library does not allow wildcard characters. Invalid tokens: ${invalidList}.`
    );
    return;
  }
  const query = buildMcl(activeCards);
  showOutput(query, '');
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
          document.execCommand('copy');
          resolve();
        } catch (err) {
          reject(err);
        }
      });

  doCopy
    .then(() => {
      copyStatus.textContent = 'Copied';
      setTimeout(() => {
        copyStatus.textContent = '';
      }, 2500);
    })
    .catch(() => {
      copyStatus.textContent = 'Unable to copy';
      setTimeout(() => {
        copyStatus.textContent = '';
      }, 2500);
    });
}

addTopicBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (menuOpen) {
    closeAddMenu();
    return;
  }
  openAddMenu();
});

addTopicMenu.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-relation]');
  if (!button) {
    return;
  }
  const relation = button.dataset.relation;
  addCard(relation);
  closeAddMenu();
});

document.addEventListener('click', (event) => {
  if (menuOpen && !addTopicMenu.contains(event.target) && event.target !== addTopicBtn) {
    closeAddMenu();
  }
});

document.addEventListener('keydown', (event) => {
  if (menuOpen && event.key === 'Escape') {
    closeAddMenu();
    addTopicBtn.focus();
  }
});

brandwatchBtn.addEventListener('click', handleBrandwatchGenerate);
mclBtn.addEventListener('click', handleMclGenerate);
copyBtn.addEventListener('click', copyOutput);

function initialize() {
  state.cards.push({ id: generateId(), relation: 'START', tokens: ['brandwatch', 'consumer insights'] });
  renderBoard();
}

initialize();
