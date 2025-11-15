const CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js';

function loadScript() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${CDN_URL}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve(window.anime);
        return;
      }
      existing.addEventListener('load', () => resolve(window.anime), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load anime.js script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = CDN_URL;
    script.async = true;

    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve(window.anime);
    }, { once: true });

    script.addEventListener('error', () => {
      reject(new Error('Failed to load anime.js script.'));
    }, { once: true });

    document.head.appendChild(script);
  });
}

export async function loadAnime() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.anime) {
    return window.anime;
  }

  if (!window.__animeLoaderPromise) {
    window.__animeLoaderPromise = loadScript();
  }

  try {
    const anime = await window.__animeLoaderPromise;
    return anime || null;
  } catch (error) {
    console.error(error);
    return null;
  }
}
