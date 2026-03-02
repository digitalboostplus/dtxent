export default [
  {
    // Target all JS files in the project
    files: ["js/**/*.js", "script.js", "sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        location: "readonly",
        history: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        performance: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        matchMedia: "readonly",
        getComputedStyle: "readonly",
        // Service Worker globals
        self: "readonly",
        caches: "readonly",
        clients: "readonly",
        skipWaiting: "readonly",
        // External Libraries
        gsap: "readonly",
        ScrollTrigger: "readonly",
      },
    },
    rules: {
      // Errors - catch real bugs
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-unreachable": "error",
      "no-constant-condition": "warn",
      "no-empty": "warn",
      "use-isnan": "error",
      "valid-typeof": "error",

      // Best practices
      "no-redeclare": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "eqeqeq": ["warn", "smart"],

      // Style (light touch)
      "no-trailing-spaces": "warn",
      "no-multiple-empty-lines": ["warn", { max: 2 }],
    },
  },
  {
    // Admin scripts may use different patterns
    files: ["admin/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        localStorage: "readonly",
        alert: "readonly",
        confirm: "readonly",
        FormData: "readonly",
        URL: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        location: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "eqeqeq": ["warn", "smart"],
    },
  },
  {
    // Ignore build artifacts & dependencies
    ignores: [
      "node_modules/",
      ".firebase/",
      "tests/",
    ],
  },
];
