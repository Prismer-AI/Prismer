import type { FilesMap, TemplateType } from "./types";

// ============================================================
// React Template
// ============================================================

export const reactTemplate: FilesMap = {
  "package.json": {
    language: "json",
    content: JSON.stringify(
      {
        name: "react-playground",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite --host" },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        devDependencies: { "@vitejs/plugin-react": "^4.2.1", vite: "^5.0.0" },
      },
      null,
      2
    ),
  },
  "vite.config.js": {
    language: "javascript",
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
  },
  "index.html": {
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Playground</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
  },
  "src/main.jsx": {
    language: "javascript",
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
  },
  "src/App.jsx": {
    language: "javascript",
    content: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <h1>React Playground</h1>
      <div className="card">
        <p>Count: {count}</p>
        <button onClick={() => setCount(c => c + 1)}>
          Click me!
        </button>
      </div>
    </div>
  )
}

export default App`,
  },
  "src/index.css": {
    language: "css",
    content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: white;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.card {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 1rem;
  backdrop-filter: blur(10px);
  text-align: center;
}

.card p {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: white;
  color: #764ba2;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}`,
  },
};

// ============================================================
// Vue Template
// ============================================================

export const vueTemplate: FilesMap = {
  "package.json": {
    language: "json",
    content: JSON.stringify(
      {
        name: "vue-playground",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite --host" },
        dependencies: { vue: "^3.4.0" },
        devDependencies: { "@vitejs/plugin-vue": "^5.0.0", vite: "^5.0.0" },
      },
      null,
      2
    ),
  },
  "vite.config.js": {
    language: "javascript",
    content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})`,
  },
  "index.html": {
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue Playground</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,
  },
  "src/main.js": {
    language: "javascript",
    content: `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')`,
  },
  "src/App.vue": {
    language: "html",
    content: `<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="app">
    <h1>Vue Playground</h1>
    <div class="card">
      <p>Count: {{ count }}</p>
      <button @click="count++">Click me!</button>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: white;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.card {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 1rem;
  backdrop-filter: blur(10px);
  text-align: center;
}

.card p {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: white;
  color: #42b883;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}
</style>`,
  },
  "src/style.css": {
    language: "css",
    content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
  min-height: 100vh;
}`,
  },
};

// ============================================================
// Vanilla JS Template
// ============================================================

export const vanillaTemplate: FilesMap = {
  "package.json": {
    language: "json",
    content: JSON.stringify(
      {
        name: "vanilla-playground",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite --host" },
        devDependencies: { vite: "^5.0.0" },
      },
      null,
      2
    ),
  },
  "index.html": {
    language: "html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vanilla JS Playground</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div id="app">
      <h1>Vanilla JS Playground</h1>
      <div class="card">
        <p>Count: <span id="count">0</span></p>
        <button id="btn">Click me!</button>
      </div>
    </div>
    <script type="module" src="/main.js"></script>
  </body>
</html>`,
  },
  "main.js": {
    language: "javascript",
    content: `let count = 0
const countEl = document.getElementById('count')
const btn = document.getElementById('btn')

btn.addEventListener('click', () => {
  count++
  countEl.textContent = count
})

console.log('Vanilla JS Playground loaded!')`,
  },
  "style.css": {
    language: "css",
    content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, sans-serif;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: white;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.card {
  background: rgba(255, 255, 255, 0.1);
  padding: 2rem;
  border-radius: 1rem;
  backdrop-filter: blur(10px);
  text-align: center;
}

.card p {
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: white;
  color: #f5576c;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s;
}

button:hover {
  transform: scale(1.05);
}`,
  },
};

// ============================================================
// Python Template (Script Mode)
// ============================================================

export const pythonTemplate: FilesMap = {
  "main.py": {
    language: "python",
    content: `# Python Script
# Run with: python main.py

def main():
    print("Hello from Python!")
    
    # Example: Simple calculation
    numbers = [1, 2, 3, 4, 5]
    total = sum(numbers)
    print(f"Sum of {numbers} = {total}")
    
    # Example: List comprehension
    squares = [x**2 for x in numbers]
    print(f"Squares: {squares}")

if __name__ == "__main__":
    main()
`,
  },
  "requirements.txt": {
    language: "plaintext",
    content: `# Python dependencies
# Add your packages here
numpy
pandas
matplotlib
`,
  },
};

// ============================================================
// Node.js Template (Script Mode)
// ============================================================

export const nodeTemplate: FilesMap = {
  "main.js": {
    language: "javascript",
    content: `// Node.js Script
// Run with: node main.js

async function main() {
  console.log("Hello from Node.js!");
  
  // Example: Async operation
  console.log("Processing...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log("Done!");
  
  // Example: Working with data
  const data = [
    { name: "Alice", score: 95 },
    { name: "Bob", score: 87 },
    { name: "Charlie", score: 92 },
  ];
  
  const average = data.reduce((sum, d) => sum + d.score, 0) / data.length;
  console.log(\`Average score: \${average.toFixed(1)}\`);
}

main().catch(console.error);
`,
  },
  "package.json": {
    language: "json",
    content: JSON.stringify(
      {
        name: "node-script",
        version: "1.0.0",
        type: "module",
        main: "main.js",
        scripts: {
          start: "node main.js",
        },
      },
      null,
      2
    ),
  },
};

// ============================================================
// Template Registry
// ============================================================

// Frontend templates (use WebContainer)
export const frontendTemplates: Record<string, FilesMap> = {
  react: reactTemplate,
  vue: vueTemplate,
  vanilla: vanillaTemplate,
};

// Script templates (use ScriptTerminal)
export const scriptTemplates: Record<string, FilesMap> = {
  python: pythonTemplate,
  node: nodeTemplate,
};

export const templates: Record<Exclude<TemplateType, "custom">, FilesMap> = {
  react: reactTemplate,
  vue: vueTemplate,
  vanilla: vanillaTemplate,
  python: pythonTemplate,
  node: nodeTemplate,
};

/**
 * Get template files by type
 */
export function getTemplate(type: TemplateType): FilesMap {
  if (type === "custom") {
    return {};
  }
  return templates[type] || templates.react;
}

/**
 * Get default selected file for a template
 */
export function getDefaultFile(type: TemplateType): string {
  const defaults: Record<TemplateType, string> = {
    react: "src/App.jsx",
    vue: "src/App.vue",
    vanilla: "main.js",
    python: "main.py",
    node: "main.js",
    custom: "",
  };
  return defaults[type] || "";
}

/**
 * Check if a template is for frontend (WebContainer)
 */
export function isFrontendTemplate(type: TemplateType): boolean {
  return type in frontendTemplates;
}

/**
 * Check if a template is for scripts (ScriptTerminal)
 */
export function isScriptTemplate(type: TemplateType): boolean {
  return type in scriptTemplates;
}
