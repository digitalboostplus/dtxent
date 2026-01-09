// Hero Particles - Three.js animated particle background
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

class HeroParticles {
    constructor() {
        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            console.log('Reduced motion preference detected, skipping Three.js particles');
            return;
        }

        this.container = document.getElementById('hero-canvas');
        if (!this.container) return;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.container,
            alpha: true,
            antialias: true
        });

        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;

        this.init();
    }

    init() {
        this.camera.position.z = 50;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.createParticles();
        this.addEventListeners();
        this.animate();
    }

    createParticles() {
        const particlesGeometry = new THREE.BufferGeometry();
        const particleCount = window.innerWidth < 768 ? 800 : 1500;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        // Brand colors
        const goldColor = new THREE.Color(0xFFCC00);
        const creamColor = new THREE.Color(0xFFFAB3);

        for (let i = 0; i < particleCount; i++) {
            // Position
            positions[i * 3] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

            // Color (mix between gold and cream)
            const mixFactor = Math.random();
            const color = goldColor.clone().lerp(creamColor, mixFactor);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const particlesMaterial = new THREE.PointsMaterial({
            size: 0.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });

        this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(this.particles);

        // Add connecting lines for nearby particles
        this.createConnections();
    }

    createConnections() {
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xFFCC00,
            transparent: true,
            opacity: 0.1,
            blending: THREE.AdditiveBlending
        });

        // Create a few decorative lines
        const points = [];
        for (let i = 0; i < 20; i++) {
            const x1 = (Math.random() - 0.5) * 80;
            const y1 = (Math.random() - 0.5) * 80;
            const z1 = (Math.random() - 0.5) * 30;
            const x2 = x1 + (Math.random() - 0.5) * 20;
            const y2 = y1 + (Math.random() - 0.5) * 20;
            const z2 = z1 + (Math.random() - 0.5) * 10;

            points.push(new THREE.Vector3(x1, y1, z1));
            points.push(new THREE.Vector3(x2, y2, z2));
        }

        lineGeometry.setFromPoints(points);
        this.lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        this.scene.add(this.lines);
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.onResize());

        // Mouse movement for parallax
        document.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Touch support
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.mouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.mouseY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
            }
        });
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Smooth mouse follow
        this.targetRotationX += (this.mouseY * 0.1 - this.targetRotationX) * 0.05;
        this.targetRotationY += (this.mouseX * 0.1 - this.targetRotationY) * 0.05;

        // Apply rotation
        this.particles.rotation.x = this.targetRotationX;
        this.particles.rotation.y = this.targetRotationY + Date.now() * 0.0001;

        if (this.lines) {
            this.lines.rotation.x = this.targetRotationX * 0.5;
            this.lines.rotation.y = this.targetRotationY * 0.5 + Date.now() * 0.00005;
        }

        // Pulse effect
        const time = Date.now() * 0.001;
        this.particles.material.opacity = 0.4 + Math.sin(time) * 0.2;

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new HeroParticles());
} else {
    new HeroParticles();
}
