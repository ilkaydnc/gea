---
layout: home

hero:
  name: Gea
  text: Lightweight Reactive UI Framework
  tagline: Write ordinary JavaScript. Get reactivity for free. No virtual DOM, no hooks, no signals — just your code, made reactive at compile time.
  image:
    src: /logo.jpg
    alt: Gea
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/dashersw/gea

features:
  - title: Zero Concepts
    details: No signals, hooks, dependency arrays, or compiler directives. Stores are classes. Components are classes or functions. Computed values are getters.
  - title: Compile-Time Reactivity
    details: The Vite plugin analyzes JSX at build time and generates surgical DOM patches — no virtual DOM, no diffing, no runtime overhead.
  - title: "~9 kb Gzipped"
    details: Tiny footprint with zero runtime dependencies. The heavy lifting happens at build time, not in the browser.
  - title: Proxy-Based Stores
    details: State lives in ordinary classes wrapped by a deep Proxy. Mutate properties directly — array methods, nested objects, everything just works.
  - title: Built-In Router
    details: Client-side RouterView, Link, route params, wildcards, and programmatic navigation. No extra packages needed.
  - title: Full Toolkit
    details: Mobile UI primitives, VS Code extension, project scaffolder, and HMR support. Everything you need, nothing you don't.
---
