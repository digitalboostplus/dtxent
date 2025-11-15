import { experiences, highlights } from '../data/content.js';
import { animateHeading } from './animatedHeading.js';
import { initHeroBackground } from './heroBackground.js';

const allCategories = [...new Set(experiences.map((exp) => exp.category))].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }),
);

const allNeighborhoods = ['all', ...new Set(experiences.map((exp) => exp.neighborhood))].sort((a, b) => {
  if (a === 'all') return -1;
  if (b === 'all') return 1;
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
});

const state = {
  searchTerm: '',
  selectedCategories: new Set(),
  minRating: 4,
  neighborhood: 'all',
};

let searchInput;
let resultsSummary;
let resultsGrid;
let ratingValue;

function computeTrendingTags() {
  const counts = new Map();
  experiences.forEach((exp) => {
    exp.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);
}

function filterExperiences() {
  const normalized = state.searchTerm.trim().toLowerCase();

  return experiences.filter((exp) => {
    const matchesCategory = state.selectedCategories.size === 0 || state.selectedCategories.has(exp.category);
    const matchesNeighborhood = state.neighborhood === 'all' || exp.neighborhood === state.neighborhood;
    const matchesRating = exp.rating >= state.minRating;
    const matchesSearch =
      normalized.length === 0
        ? true
        : [exp.name, exp.description, exp.category, exp.neighborhood, ...exp.tags]
            .join(' ')
            .toLowerCase()
            .includes(normalized);

    return matchesCategory && matchesNeighborhood && matchesRating && matchesSearch;
  });
}

function updateResults() {
  const filtered = filterExperiences();

  const summaryText = filtered.length === 1 ? 'top pick' : 'top picks';
  resultsSummary.innerHTML = `
    <strong>${filtered.length}</strong> ${summaryText} for ${
      state.neighborhood === 'all' ? 'Dallas–Fort Worth' : state.neighborhood
    } <span>• Rating ${state.minRating.toFixed(1)}+ • ${
      state.selectedCategories.size > 0 ? state.selectedCategories.size : 'All'
    } categories</span>
  `;

  resultsGrid.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `
      <h3 class="card__title">No matches yet</h3>
      <p class="card__description">Try adjusting your filters or searching for a different neighborhood or vibe.</p>
    `;
    resultsGrid.appendChild(empty);
    return;
  }

  filtered.forEach((exp) => {
    const card = document.createElement('article');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card__header';

    const title = document.createElement('h3');
    title.className = 'card__title';
    title.textContent = exp.name;

    const rating = document.createElement('span');
    rating.className = 'card__rating';
    rating.textContent = `${exp.rating.toFixed(1)}★`;

    header.appendChild(title);
    header.appendChild(rating);

    const meta = document.createElement('p');
    meta.className = 'card__meta';
    meta.textContent = `${exp.category} • ${exp.neighborhood}`;

    const description = document.createElement('p');
    description.className = 'card__description';
    description.textContent = exp.description;

    const tags = document.createElement('div');
    tags.className = 'card__tags';
    exp.tags.forEach((tag) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'card__tag';
      tagEl.textContent = `#${tag}`;
      tags.appendChild(tagEl);
    });

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(description);
    card.appendChild(tags);

    resultsGrid.appendChild(card);
  });
}

function renderCategories(container) {
  container.innerHTML = '';
  allCategories.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filters__chip';
    button.dataset.category = category;
    button.textContent = category;
    button.setAttribute('aria-pressed', 'false');
    container.appendChild(button);
  });
}

function updateCategoryStyles(container) {
  const buttons = container.querySelectorAll('button[data-category]');
  buttons.forEach((button) => {
    const isActive = state.selectedCategories.has(button.dataset.category);
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderNeighborhoods(select) {
  select.innerHTML = '';
  allNeighborhoods.forEach((hood) => {
    const option = document.createElement('option');
    option.value = hood;
    option.textContent = hood === 'all' ? 'All' : hood;
    if (hood === state.neighborhood) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function renderTrending(container) {
  const tags = computeTrendingTags();
  container.innerHTML = '';
  tags.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hero__tag';
    button.textContent = `#${tag}`;
    button.addEventListener('click', () => {
      setSearchTerm(tag.replace('-', ' '));
    });
    container.appendChild(button);
  });
}

function renderHighlights(container) {
  container.innerHTML = '';
  highlights.forEach((highlight) => {
    const card = document.createElement('article');
    card.className = 'highlight-card';

    const title = document.createElement('h3');
    title.textContent = highlight.title;

    const description = document.createElement('p');
    description.textContent = highlight.description;

    card.appendChild(title);
    card.appendChild(description);
    container.appendChild(card);
  });
}

function setSearchTerm(value) {
  state.searchTerm = value;
  searchInput.value = value;
  updateResults();
}

function initEventListeners({
  categoryContainer,
  neighborhoodSelect,
  ratingInput,
  trendingContainer,
}) {
  categoryContainer.addEventListener('click', (event) => {
    const target = event.target.closest('button[data-category]');
    if (!target) return;
    const category = target.dataset.category;
    if (state.selectedCategories.has(category)) {
      state.selectedCategories.delete(category);
    } else {
      state.selectedCategories.add(category);
    }
    updateCategoryStyles(categoryContainer);
    updateResults();
  });

  neighborhoodSelect.addEventListener('change', (event) => {
    state.neighborhood = event.target.value;
    updateResults();
  });

  ratingInput.addEventListener('input', (event) => {
    state.minRating = Number(event.target.value);
    ratingValue.textContent = `${state.minRating.toFixed(1)}+`;
    updateResults();
  });

  searchInput.addEventListener('input', (event) => {
    state.searchTerm = event.target.value;
    updateResults();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      updateResults();
    }
  });

  const searchButton = document.querySelector('[data-search-button]');
  if (searchButton) {
    searchButton.addEventListener('click', () => updateResults());
  }

  trendingContainer.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const tagButton = event.target.closest('button.hero__tag');
      if (tagButton) {
        tagButton.click();
      }
    }
  });
}

function init() {
  const heading = document.querySelector('.hero__heading');
  animateHeading(heading);

  const canvasContainer = document.querySelector('.hero__canvas');
  initHeroBackground(canvasContainer);

  const yearElement = document.querySelector('[data-current-year]');
  if (yearElement) {
    yearElement.textContent = String(new Date().getFullYear());
  }

  searchInput = document.querySelector('[data-search-input]');
  resultsSummary = document.querySelector('[data-results-summary]');
  resultsGrid = document.querySelector('[data-results-grid]');
  ratingValue = document.querySelector('[data-rating-value]');

  const categoryContainer = document.querySelector('[data-category-container]');
  const neighborhoodSelect = document.querySelector('[data-neighborhood-select]');
  const ratingInput = document.querySelector('[data-rating-input]');
  const trendingContainer = document.querySelector('[data-trending-tags]');
  const highlightsContainer = document.querySelector('[data-highlights]');

  renderCategories(categoryContainer);
  updateCategoryStyles(categoryContainer);
  renderNeighborhoods(neighborhoodSelect);
  renderTrending(trendingContainer);
  renderHighlights(highlightsContainer);

  ratingInput.value = String(state.minRating);
  ratingValue.textContent = `${state.minRating.toFixed(1)}+`;

  initEventListeners({
    categoryContainer,
    neighborhoodSelect,
    ratingInput,
    trendingContainer,
  });

  updateResults();
}

document.addEventListener('DOMContentLoaded', init);
