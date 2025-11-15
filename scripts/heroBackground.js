const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.min.js';

function loadThree() {
  return new Promise((resolve, reject) => {
    if (window.THREE) {
      resolve(window.THREE);
      return;
    }

    const existing = document.querySelector(`script[src="${THREE_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.THREE), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load three.js')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = THREE_CDN;
    script.async = true;
    script.addEventListener('load', () => resolve(window.THREE), { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load three.js')), { once: true });
    document.head.appendChild(script);
  });
}

export async function initHeroBackground(container) {
  if (!container) {
    return;
  }

  const THREE = await loadThree();
  if (!THREE) {
    return;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#0f172a', 0.08);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setClearColor('#030712', 0.6);

  const geometry = new THREE.IcosahedronGeometry(3, 1);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#38bdf8'),
    emissive: new THREE.Color('#0ea5e9'),
    emissiveIntensity: 0.4,
    metalness: 0.4,
    roughness: 0.15,
    wireframe: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const starGeometry = new THREE.BufferGeometry();
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 20;
    positions[i + 1] = (Math.random() - 0.5) * 20;
    positions[i + 2] = (Math.random() - 0.5) * 20;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: '#38bdf8',
    size: 0.04,
    transparent: true,
    opacity: 0.75,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  const directionalLight = new THREE.DirectionalLight('#38bdf8', 0.6);
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight('#cbd5f5', 0.4);
  scene.add(ambientLight);

  const rendererCanvas = renderer.domElement;
  rendererCanvas.setAttribute('aria-hidden', 'true');
  container.appendChild(rendererCanvas);

  const updateSize = () => {
    const { clientWidth, clientHeight } = container.parentElement;
    renderer.setSize(clientWidth, clientHeight);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };

  const handleResize = () => updateSize();
  window.addEventListener('resize', handleResize);
  updateSize();

  let frameId;
  const animate = () => {
    frameId = requestAnimationFrame(animate);
    mesh.rotation.x += 0.003;
    mesh.rotation.y += 0.0025;
    stars.rotation.y += 0.0008;
    renderer.render(scene, camera);
  };
  animate();

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', handleResize);
    if (container.contains(rendererCanvas)) {
      container.removeChild(rendererCanvas);
    }
    geometry.dispose();
    material.dispose();
    starGeometry.dispose();
    starMaterial.dispose();
    renderer.dispose();
  };
}
