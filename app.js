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

    const body = document.createElement('div');
    body.className = 'card-body';

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

    body.append(label, chipList, input);
    cardEl.append(header, body);
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
  let expression = '';
  cards.forEach((card, index) => {
    const terms = card.tokens.map((token) => formatBrandwatchToken(token));
    if (!terms.length) {
      return;
    }
    const group = `(${terms.join(' OR ')})`;
    if (index === 0) {
      expression = group;
      return;
    }

    const connector = card.relation === 'OR' ? ' OR ' : card.relation === 'NOT' ? ' NOT ' : ' AND ';
    expression = `${expression}${connector}${group}`;
  });
  return expression;
}

function formatBrandwatchToken(token) {
  const escaped = token.replace(/"/g, '\\\"');
  return /\s/.test(token) ? `"${escaped}"` : escaped;
}

function buildMcl(cards) {
  let expression = '';
  cards.forEach((card, index) => {
    const group = `(${card.tokens.join('|')})`;
    if (index === 0) {
      expression = group;
      return;
    }

    if (card.relation === 'OR') {
      expression = `${expression}|${group}`;
    } else if (card.relation === 'NOT') {
      expression = `${expression}-${group}`;
    } else {
      expression = `${expression}&${group}`;
    }
  });
  return expression;
}

function validateMclTokens(cards) {
  const invalid = [];
  cards.forEach((card) => {
    card.tokens.forEach((token) => {
      if (/\s/.test(token) || token.includes('*')) {
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
      `Meta Content Library only supports single-word keywords without wildcards. Invalid tokens: ${invalidList}.`
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
