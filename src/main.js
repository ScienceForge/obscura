import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './styles/index.css';

import { startApp } from './app.js';

const root = document.getElementById('app');

try {
  root.replaceChildren();
  startApp(root);
} catch (error) {
  console.error(error);
  root.innerHTML =
    '<div class="fatal" role="alert"><h1>The archive did not open</h1><p>Something failed while loading. Reloading usually fixes it. Your saved progress has not been touched.</p></div>';
}
