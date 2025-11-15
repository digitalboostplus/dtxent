const experiences = [
  {
    name: 'AT&T Discovery District',
    category: 'Landmarks & Attractions',
    rating: 4.8,
    neighborhood: 'Downtown Dallas',
    description:
      'Immersive plaza with 104-foot media wall, food hall, rotating art installations, and frequent outdoor concerts.',
    tags: ['family-friendly', 'outdoor', 'tech-driven', 'free-entry'],
  },
  {
    name: 'Klyde Warren Park',
    category: 'Outdoors & Wellness',
    rating: 4.7,
    neighborhood: 'Arts District',
    description:
      'Deck park built over the Woodall Rodgers Freeway featuring fitness classes, food trucks, kids zone, and skyline views.',
    tags: ['outdoor', 'family-friendly', 'green-space', 'events'],
  },
  {
    name: 'The Rustic',
    category: 'Live Music & Nightlife',
    rating: 4.6,
    neighborhood: 'Uptown',
    description:
      'Texas-sized backyard with nightly live music, farm-to-table menu, and local craft beers under the string lights.',
    tags: ['live-music', 'local-brews', 'patio', 'late-night'],
  },
  {
    name: 'Deep Ellum Art Walk',
    category: 'Arts & Culture',
    rating: 4.9,
    neighborhood: 'Deep Ellum',
    description:
      'Self-guided tour of the district’s iconic murals, galleries, and indie shops with pop-up performances on weekends.',
    tags: ['murals', 'street-art', 'indie', 'walkable'],
  },
  {
    name: 'Joe T. Garcia’s',
    category: 'Dining',
    rating: 4.7,
    neighborhood: 'Fort Worth Stockyards',
    description:
      'Beloved Tex-Mex institution with sprawling garden patio, legendary margaritas, and family-style platters.',
    tags: ['tex-mex', 'historic', 'patio', 'reservations'],
  },
  {
    name: 'Nasher Sculpture Center',
    category: 'Arts & Culture',
    rating: 4.8,
    neighborhood: 'Arts District',
    description:
      'World-class collection of modern and contemporary sculpture with serene garden, rotating exhibitions, and live talks.',
    tags: ['museum', 'architecture', 'serene', 'daytime'],
  },
  {
    name: 'Truck Yard',
    category: 'Live Music & Nightlife',
    rating: 4.5,
    neighborhood: 'Lower Greenville',
    description:
      'Casual adult playground with treehouse bar, daily live music, rotating food trucks, and retro airstream seating.',
    tags: ['quirky', 'live-music', 'outdoor', 'food-trucks'],
  },
  {
    name: 'Fort Worth Stockyards Rodeo',
    category: 'Events & Festivals',
    rating: 4.8,
    neighborhood: 'Fort Worth Stockyards',
    description:
      'Authentic rodeo every Friday and Saturday night featuring bull riding, barrel racing, and live Western music.',
    tags: ['western', 'weekly', 'family-friendly', 'ticketed'],
  },
  {
    name: 'Midnight Rambler',
    category: 'Dining',
    rating: 4.6,
    neighborhood: 'Downtown Dallas',
    description:
      'Craft cocktail den inside The Joule hotel with subterranean vibes, vinyl soundtrack, and inventive seasonal menu.',
    tags: ['cocktails', 'date-night', 'late-night', 'speakeasy'],
  },
  {
    name: 'Bishop Arts Food Crawl',
    category: 'Events & Festivals',
    rating: 4.9,
    neighborhood: 'Bishop Arts District',
    description:
      'Guided tasting tour of the neighborhood’s top restaurants, bakeries, and bars with stories from local chefs.',
    tags: ['foodie', 'guided', 'small-group', 'neighborhood'],
  },
  {
    name: 'Texas Live!',
    category: 'Landmarks & Attractions',
    rating: 4.6,
    neighborhood: 'Arlington',
    description:
      'Entertainment complex between the stadiums with mega screens, brewery, arcade, and gameday watch parties.',
    tags: ['sports', 'game-day', 'family-friendly', 'open-late'],
  },
  {
    name: 'Sixty Vines',
    category: 'Dining',
    rating: 4.7,
    neighborhood: 'Uptown',
    description:
      'Wine-on-tap destination featuring seasonal farm cuisine, greenhouse-inspired dining room, and weekend brunch.',
    tags: ['wine', 'brunch', 'farm-to-table', 'date-night'],
  },
  {
    name: 'Levitt Pavilion Concert Series',
    category: 'Events & Festivals',
    rating: 4.8,
    neighborhood: 'Arlington',
    description:
      'Free outdoor concert series with national touring acts, food trucks, and lawn games from April through November.',
    tags: ['free-entry', 'live-music', 'seasonal', 'outdoor'],
  },
  {
    name: 'Puttery Dallas',
    category: 'Experiences',
    rating: 4.5,
    neighborhood: 'Design District',
    description:
      'Upscale indoor mini golf with immersive themed courses, craft cocktails, and shareable plates perfect for groups.',
    tags: ['group-activity', 'indoors', 'date-night', 'instagrammable'],
  }
];

const highlights = [
  {
    title: '48 hours in Dallas',
    description:
      'Start at Klyde Warren Park, tour the Nasher, catch sunset drinks at Sixty Vines, and dance the night away at The Rustic.'
  },
  {
    title: 'Fort Worth heritage trail',
    description:
      'Pair a legendary Joe T. Garcia’s dinner with the Stockyards Rodeo, then explore live music under the stars at Levitt Pavilion.'
  },
  {
    title: 'Night out with friends',
    description:
      'Kick off at Puttery for elevated mini golf, hop to Midnight Rambler for cocktails, and close with late-night bites at Truck Yard.'
  }
];

const state = {
  searchTerm: '',
  selectedCategories: new Set(),
  minRating: 4,
  neighborhood: 'all'
};

const elements = {
  searchInput: document.getElementById('searchInput'),
  searchButton: document.getElementById('searchButton'),
  categoryFilter: document.getElementById('categoryFilter'),
  ratingFilter: document.getElementById('ratingFilter'),
  ratingValue: document.getElementById('ratingValue'),
  neighborhoodFilter: document.getElementById('neighborhoodFilter'),
  resultsSummary: document.getElementById('resultsSummary'),
  resultsGrid: document.getElementById('resultsGrid'),
  highlightsGrid: document.getElementById('highlightsGrid'),
  trendingTags: document.getElementById('trendingTags')
};

const formatRating = (rating) => `${rating.toFixed(1)}`;

function buildCategoryChips() {
  const categories = [...new Set(experiences.map((exp) => exp.category))].sort();
  categories.forEach((category) => {
    const button = document.createElement('button');
    button.className = 'filters__chip';
    button.type = 'button';
    button.textContent = category;
    button.dataset.category = category;
    button.addEventListener('click', () => {
      if (state.selectedCategories.has(category)) {
        state.selectedCategories.delete(category);
      } else {
        state.selectedCategories.add(category);
      }
      button.classList.toggle('is-active');
      renderResults();
    });
    elements.categoryFilter.appendChild(button);
  });
}

function buildNeighborhoodFilter() {
  const neighborhoods = [...new Set(experiences.map((exp) => exp.neighborhood))].sort();
  neighborhoods.forEach((neighborhood) => {
    const option = document.createElement('option');
    option.value = neighborhood;
    option.textContent = neighborhood;
    elements.neighborhoodFilter.appendChild(option);
  });
}

function buildTrendingTags() {
  const tagCounts = experiences
    .flatMap((exp) => exp.tags)
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag]) => tag);

  topTags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'hero__tag';
    span.textContent = `#${tag}`;
    span.addEventListener('click', () => {
      elements.searchInput.value = tag.replace('-', ' ');
      state.searchTerm = tag;
      renderResults();
    });
    elements.trendingTags.appendChild(span);
  });
}

function renderHighlights() {
  highlights.forEach((highlight) => {
    const card = document.createElement('article');
    card.className = 'highlight-card';
    card.innerHTML = `
      <h3>${highlight.title}</h3>
      <p>${highlight.description}</p>
    `;
    elements.highlightsGrid.appendChild(card);
  });
}

function filterExperiences() {
  const query = state.searchTerm.trim().toLowerCase();
  return experiences.filter((exp) => {
    const matchesCategory =
      state.selectedCategories.size === 0 || state.selectedCategories.has(exp.category);

    const matchesNeighborhood = state.neighborhood === 'all' || exp.neighborhood === state.neighborhood;

    const matchesRating = exp.rating >= state.minRating;

    const matchesQuery = !query
      ? true
      : [exp.name, exp.description, exp.category, exp.neighborhood, ...exp.tags]
          .join(' ')
          .toLowerCase()
          .includes(query);

    return matchesCategory && matchesNeighborhood && matchesRating && matchesQuery;
  });
}

function renderResults() {
  const filtered = filterExperiences();
  elements.resultsGrid.innerHTML = '';

  if (filtered.length === 0) {
    elements.resultsGrid.innerHTML = `
      <div class="card">
        <h3 class="card__title">No matches yet</h3>
        <p class="card__description">Try adjusting your filters or searching for a different neighborhood or vibe.</p>
      </div>
    `;
  } else {
    filtered.forEach((exp) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="card__header">
          <h3 class="card__title">${exp.name}</h3>
          <span class="card__rating">${formatRating(exp.rating)}</span>
        </div>
        <div class="card__meta">${exp.category} • ${exp.neighborhood}</div>
        <p class="card__description">${exp.description}</p>
        <div class="card__tags">
          ${exp.tags.map((tag) => `<span class="card__tag">${tag}</span>`).join('')}
        </div>
      `;
      elements.resultsGrid.appendChild(card);
    });
  }

  const summaryText = filtered.length === 1 ? 'top pick' : 'top picks';
  elements.resultsSummary.innerHTML = `
    <strong>${filtered.length}</strong> ${summaryText} for ${state.neighborhood === 'all' ? 'Dallas–Fort Worth' : state.neighborhood}
    <span>• Rating ${state.minRating.toFixed(1)}+ • ${state.selectedCategories.size || 'All'} categories</span>
  `;
}

function attachEventListeners() {
  elements.searchButton.addEventListener('click', () => {
    state.searchTerm = elements.searchInput.value;
    renderResults();
  });

  elements.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      state.searchTerm = event.target.value;
      renderResults();
    }
  });

  elements.ratingFilter.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    state.minRating = value;
    elements.ratingValue.textContent = `${value.toFixed(1)}+`;
    renderResults();
  });

  elements.neighborhoodFilter.addEventListener('change', (event) => {
    state.neighborhood = event.target.value;
    renderResults();
  });
}

function init() {
  buildCategoryChips();
  buildNeighborhoodFilter();
  buildTrendingTags();
  renderHighlights();
  attachEventListeners();
  renderResults();
}

init();
