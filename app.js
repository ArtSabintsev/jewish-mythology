/**
 * Jewish Midrashim - Search & Filter Application
 * A modern interface for exploring Jewish mythology and legends
 */

// State management
const state = {
  myths: [],
  filteredMyths: [],
  metadata: null,
  currentPage: 1,
  itemsPerPage: 24,
  searchQuery: '',
  selectedSource: 'all',
  selectedThemes: [],
  selectedBook: 'all',
  sortBy: 'relevance',
  viewMode: 'cards'
};

// DOM Elements
const elements = {
  loading: document.getElementById('loading'),
  resultsGrid: document.getElementById('resultsGrid'),
  resultsCount: document.getElementById('resultsCount'),
  resultsShowing: document.getElementById('resultsShowing'),
  emptyState: document.getElementById('emptyState'),
  pagination: document.getElementById('pagination'),
  pageInfo: document.getElementById('pageInfo'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  searchInput: document.getElementById('searchInput'),
  sourceFilters: document.getElementById('sourceFilters'),
  themeFilters: document.getElementById('themeFilters'),
  bookFilter: document.getElementById('bookFilter'),
  clearFilters: document.getElementById('clearFilters'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalContent: document.getElementById('modalContent'),
  modalClose: document.getElementById('modalClose'),
  totalCount: document.getElementById('totalCount'),
  sidebar: document.getElementById('sidebar'),
  mobileFilterToggle: document.getElementById('mobileFilterToggle'),
  viewCards: document.getElementById('viewCards'),
  viewList: document.getElementById('viewList'),
  sortRelevance: document.getElementById('sortRelevance'),
  sortTitle: document.getElementById('sortTitle'),
  sortSource: document.getElementById('sortSource')
};

// Initialize application
async function init() {
  try {
    await loadData();
    setupEventListeners();
    populateFilters();
    applyFilters();
    elements.loading.classList.add('hidden');
  } catch (error) {
    console.error('Failed to initialize:', error);
    elements.loading.innerHTML = `
      <div class="empty-icon">&#x26A0;</div>
      <h3>Failed to load data</h3>
      <p>Please ensure myths.json exists in the data folder</p>
    `;
  }
}

// Load JSON data
async function loadData() {
  const response = await fetch('data/myths.json');
  if (!response.ok) throw new Error('Failed to load myths data');
  const data = await response.json();
  state.myths = data.myths;
  state.metadata = data.metadata;
  elements.totalCount.textContent = state.myths.length;
}

// Setup event listeners
function setupEventListeners() {
  // Search input with debounce
  let searchTimeout;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      state.currentPage = 1;
      applyFilters();
    }, 300);
  });

  // Source filters
  elements.sourceFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip')) {
      const source = e.target.dataset.source;
      state.selectedSource = source;
      state.currentPage = 1;
      updateSourceFilterUI();
      applyFilters();
    }
  });

  // Theme filters
  elements.themeFilters.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip')) {
      const theme = e.target.dataset.theme;
      if (theme === 'all') {
        state.selectedThemes = [];
      } else if (state.selectedThemes.includes(theme)) {
        state.selectedThemes = state.selectedThemes.filter(t => t !== theme);
      } else {
        state.selectedThemes.push(theme);
      }
      state.currentPage = 1;
      updateThemeFilterUI();
      applyFilters();
    }
  });

  // Book filter
  elements.bookFilter.addEventListener('change', (e) => {
    state.selectedBook = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  // Sort buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.sortBy = e.target.dataset.sort;
      state.currentPage = 1;
      updateSortUI();
      applyFilters();
    });
  });

  // View toggle
  elements.viewCards.addEventListener('click', () => setViewMode('cards'));
  elements.viewList.addEventListener('click', () => setViewMode('list'));

  // Clear filters
  elements.clearFilters.addEventListener('click', clearAllFilters);

  // Pagination
  elements.prevPage.addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderResults();
      scrollToTop();
    }
  });

  elements.nextPage.addEventListener('click', () => {
    const totalPages = Math.ceil(state.filteredMyths.length / state.itemsPerPage);
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderResults();
      scrollToTop();
    }
  });

  // Modal
  elements.modalClose.addEventListener('click', closeModal);
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Mobile filter toggle
  elements.mobileFilterToggle.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
  });

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 &&
        elements.sidebar.classList.contains('open') &&
        !elements.sidebar.contains(e.target) &&
        e.target !== elements.mobileFilterToggle) {
      elements.sidebar.classList.remove('open');
    }
  });
}

// Populate filter options
function populateFilters() {
  // Theme filters
  const themeLabels = {
    'adam-eve': 'Adam & Eve',
    'holy-land': 'Holy Land',
    'messiah': 'Messiah',
    'mysticism': 'Mysticism',
    'patriarchs': 'Patriarchs',
    'creatures': 'Creatures',
    'prophecy': 'Prophecy',
    'temple': 'Temple',
    'angels': 'Angels',
    'demons': 'Demons',
    'heaven': 'Heaven',
    'hell': 'Hell',
    'creation': 'Creation',
    'torah': 'Torah',
    'moses': 'Moses',
    'noah': 'Noah',
    'soul': 'Soul',
    'exile': 'Exile'
  };

  const themesHtml = state.metadata.filterOptions.themes.map(theme => {
    const label = themeLabels[theme] || theme.charAt(0).toUpperCase() + theme.slice(1);
    return `<button class="chip" data-theme="${theme}">${label}</button>`;
  }).join('');
  elements.themeFilters.innerHTML = `
    <button class="chip active" data-theme="all">All Themes</button>
    ${themesHtml}
  `;

  // Book filter
  const booksHtml = state.metadata.filterOptions.books.map(book => {
    const displayName = book.length > 50 ? book.substring(0, 47) + '...' : book;
    return `<option value="${book}">${displayName}</option>`;
  }).join('');
  elements.bookFilter.innerHTML = `
    <option value="all">All Books & Chapters</option>
    ${booksHtml}
  `;
}

// Apply all filters and search
function applyFilters() {
  let results = [...state.myths];

  // Search filter
  if (state.searchQuery) {
    const query = state.searchQuery;
    results = results.filter(myth => {
      const searchText = `${myth.title} ${myth.content} ${myth.commentary || ''} ${myth.themes.join(' ')}`.toLowerCase();
      return searchText.includes(query);
    });

    // Calculate relevance scores for search results
    results = results.map(myth => {
      let score = 0;
      const query = state.searchQuery;

      // Title match is most important
      if (myth.title.toLowerCase().includes(query)) score += 100;

      // Theme match
      if (myth.themes.some(t => t.includes(query))) score += 50;

      // Content match
      const contentMatches = (myth.content.toLowerCase().match(new RegExp(query, 'g')) || []).length;
      score += contentMatches * 5;

      return { ...myth, relevanceScore: score };
    });
  } else {
    results = results.map(myth => ({ ...myth, relevanceScore: 0 }));
  }

  // Source filter
  if (state.selectedSource !== 'all') {
    results = results.filter(myth => myth.sourceWork === state.selectedSource);
  }

  // Theme filter
  if (state.selectedThemes.length > 0) {
    results = results.filter(myth =>
      state.selectedThemes.some(theme => myth.themes.includes(theme))
    );
  }

  // Book filter
  if (state.selectedBook !== 'all') {
    results = results.filter(myth => myth.book === state.selectedBook);
  }

  // Sort
  results = sortResults(results);

  state.filteredMyths = results;
  renderResults();
}

// Sort results
function sortResults(results) {
  switch (state.sortBy) {
    case 'relevance':
      if (state.searchQuery) {
        return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      }
      // Default order by source and number
      return results.sort((a, b) => {
        if (a.sourceWork !== b.sourceWork) {
          return a.sourceWork.localeCompare(b.sourceWork);
        }
        return (a.number || 0) - (b.number || 0);
      });
    case 'title':
      return results.sort((a, b) => a.title.localeCompare(b.title));
    case 'source':
      return results.sort((a, b) => {
        const sourceOrder = { 'schwartz': 1, 'ginzberg-v1': 2, 'ginzberg-v2': 3 };
        return (sourceOrder[a.sourceWork] || 99) - (sourceOrder[b.sourceWork] || 99);
      });
    default:
      return results;
  }
}

// Render results
function renderResults() {
  const { filteredMyths, currentPage, itemsPerPage } = state;
  const totalPages = Math.ceil(filteredMyths.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageResults = filteredMyths.slice(startIndex, endIndex);

  // Update counts
  elements.resultsCount.textContent = `${filteredMyths.length} results`;
  if (filteredMyths.length > itemsPerPage) {
    elements.resultsShowing.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, filteredMyths.length)}`;
  } else {
    elements.resultsShowing.textContent = '';
  }

  // Show/hide states
  if (filteredMyths.length === 0) {
    elements.resultsGrid.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    elements.pagination.classList.add('hidden');
  } else {
    elements.resultsGrid.classList.remove('hidden');
    elements.emptyState.classList.add('hidden');
    elements.pagination.classList.remove('hidden');
  }

  // Render cards
  elements.resultsGrid.innerHTML = pageResults.map(myth => createMythCard(myth)).join('');

  // Add click handlers to cards
  elements.resultsGrid.querySelectorAll('.myth-card').forEach(card => {
    card.addEventListener('click', () => {
      const mythId = card.dataset.id;
      const myth = state.myths.find(m => m.id === mythId);
      if (myth) openModal(myth);
    });
  });

  // Update pagination
  elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
  elements.prevPage.disabled = currentPage <= 1;
  elements.nextPage.disabled = currentPage >= totalPages;
}

// Create myth card HTML
function createMythCard(myth) {
  const sourceLabels = {
    'schwartz': 'Tree of Souls',
    'ginzberg-v1': 'Legends Vol. 1',
    'ginzberg-v2': 'Legends Vol. 2'
  };

  const excerpt = myth.content.substring(0, 200) + (myth.content.length > 200 ? '...' : '');
  const themeTags = myth.themes.slice(0, 4).map(t =>
    `<span class="theme-tag">${t.replace('-', ' ')}</span>`
  ).join('');

  return `
    <article class="myth-card" data-id="${myth.id}">
      <div class="myth-card-header">
        <h3 class="myth-card-title">${escapeHtml(myth.title)}</h3>
        ${myth.number ? `<span class="myth-card-number">#${myth.number}</span>` : ''}
      </div>
      <div class="myth-card-meta">
        <span class="myth-card-source">${sourceLabels[myth.sourceWork] || myth.sourceWork}</span>
        ${myth.book ? `<span class="myth-card-book">${escapeHtml(myth.book)}</span>` : ''}
      </div>
      <p class="myth-card-excerpt">${escapeHtml(excerpt)}</p>
      <div class="myth-card-themes">${themeTags}</div>
    </article>
  `;
}

// Open modal with myth details
function openModal(myth) {
  const sourceLabels = {
    'schwartz': 'Tree of Souls (Schwartz)',
    'ginzberg-v1': 'Legends of the Jews Vol. 1 (Ginzberg)',
    'ginzberg-v2': 'Legends of the Jews Vol. 2 (Ginzberg)'
  };

  const themeTags = myth.themes.map(t =>
    `<span class="modal-theme-tag">${t.replace('-', ' ')}</span>`
  ).join('');

  const sourcesList = myth.sources && myth.sources.length > 0
    ? `<div class="modal-sources">
         <h4>Sources</h4>
         <ul>${myth.sources.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
       </div>`
    : '';

  const referencesList = myth.biblicalReferences && myth.biblicalReferences.length > 0
    ? `<div class="modal-references">
         <h4>Biblical References</h4>
         <ul>${myth.biblicalReferences.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
       </div>`
    : '';

  const commentary = myth.commentary
    ? `<div class="modal-section-label">Commentary</div>
       <div class="modal-commentary">${escapeHtml(myth.commentary)}</div>`
    : '';

  elements.modalContent.innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${escapeHtml(myth.title)}</h2>
      <div class="modal-meta">
        <span class="modal-source">${sourceLabels[myth.sourceWork] || myth.sourceWork}</span>
        ${myth.book ? `<span class="modal-book">${escapeHtml(myth.book)}</span>` : ''}
        ${myth.section ? `<span class="modal-book">${escapeHtml(myth.section)}</span>` : ''}
      </div>
    </div>
    <div class="modal-section-label">Content</div>
    <div class="modal-text">${escapeHtml(myth.content)}</div>
    ${commentary}
    ${myth.themes.length > 0 ? `
      <div class="modal-section-label">Themes</div>
      <div class="modal-themes">${themeTags}</div>
    ` : ''}
    ${sourcesList}
    ${referencesList}
  `;

  elements.modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
  elements.modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

// Update UI helpers
function updateSourceFilterUI() {
  elements.sourceFilters.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.source === state.selectedSource);
  });
}

function updateThemeFilterUI() {
  elements.themeFilters.querySelectorAll('.chip').forEach(chip => {
    const theme = chip.dataset.theme;
    if (theme === 'all') {
      chip.classList.toggle('active', state.selectedThemes.length === 0);
    } else {
      chip.classList.toggle('active', state.selectedThemes.includes(theme));
    }
  });
}

function updateSortUI() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === state.sortBy);
  });
}

function setViewMode(mode) {
  state.viewMode = mode;
  elements.resultsGrid.classList.toggle('cards-view', mode === 'cards');
  elements.resultsGrid.classList.toggle('list-view', mode === 'list');
  elements.viewCards.classList.toggle('active', mode === 'cards');
  elements.viewList.classList.toggle('active', mode === 'list');
}

function clearAllFilters() {
  state.searchQuery = '';
  state.selectedSource = 'all';
  state.selectedThemes = [];
  state.selectedBook = 'all';
  state.sortBy = 'relevance';
  state.currentPage = 1;

  elements.searchInput.value = '';
  elements.bookFilter.value = 'all';
  updateSourceFilterUI();
  updateThemeFilterUI();
  updateSortUI();
  applyFilters();
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Utility: escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start application
document.addEventListener('DOMContentLoaded', init);
