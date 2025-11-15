import { loadAnime } from './utils/loadAnime.js';

export async function animateHeading(element) {
  if (!element) {
    return;
  }

  const anime = await loadAnime();
  if (!anime) {
    return;
  }

  const letters = Array.from(element.textContent);
  element.textContent = '';

  letters.forEach((char, index) => {
    const span = document.createElement('span');
    span.className = 'hero__letter';
    span.textContent = char === ' ' ? '\u00A0' : char;
    span.style.opacity = '0';
    span.style.transform = 'translateY(60px)';
    element.appendChild(span);
    span.dataset.index = index.toString();
  });

  const letterNodes = element.querySelectorAll('.hero__letter');

  anime
    .timeline({ easing: 'easeOutQuad' })
    .add({
      targets: letterNodes,
      translateY: [60, 0],
      opacity: [0, 1],
      delay: anime.stagger(40),
      duration: 750,
    })
    .add(
      {
        targets: letterNodes,
        scale: [1, 1.04, 1],
        duration: 1800,
        elasticity: 500,
        delay: anime.stagger(35),
      },
      '-=400',
    );
}
