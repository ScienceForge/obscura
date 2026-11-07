import { entryStatus } from './core/access.js';
import { ACHIEVEMENT_INDEX, ENTRY_INDEX } from './core/catalog.js';
import { matchRoute } from './core/routes.js';
import { createAudio } from './engine/audio.js';
import { createProgressStore } from './engine/store.js';
import { mountArchive } from './ui/archive.js';
import { mountIntro } from './ui/intro.js';
import { mountJournal } from './ui/journal.js';
import { mountOrigin } from './ui/origin.js';
import { mountNotFound, mountSealed, mountUnavailable } from './ui/screens.js';
import { createShell } from './ui/shell.js';
import { ROOM_LOADERS } from './rooms/index.js';

const TITLES = {
  home: 'OBSCURA',
  archive: 'The Archive · OBSCURA',
  journal: 'Discovery log · OBSCURA',
  submit: 'Transmit · OBSCURA',
  notfound: 'No signal · OBSCURA',
};

export function startApp(root) {
  const store = createProgressStore();
  const audio = createAudio();

  async function setSound(on) {
    const applied = await audio.setEnabled(on);
    store.dispatch({ type: 'sound/set', on: applied });
    shell.setSound(applied, audio.supported);
    return applied;
  }

  const shell = createShell(root, { onToggleSound: () => setSound(!audio.enabled) });

  const ctx = {
    store,
    audio,
    toast: shell.toast,
    setSound,
    forceIntro: false,
    navigate(path) {
      const hash = `#/${path}`;
      const current = window.location.hash || '#/';
      if (current === hash) route();
      else window.location.hash = hash;
    },
    replayIntro() {
      ctx.forceIntro = true;
      ctx.navigate('');
    },
  };

  /* ------------------------------------------------------ notifications */
  store.onEvent((event) => {
    switch (event.type) {
      case 'entry': {
        const entry = ENTRY_INDEX.get(event.id);
        shell.toast({ label: 'ENTRY LOGGED', title: `${entry.id} · ${entry.title}` });
        break;
      }
      case 'complete': {
        const entry = ENTRY_INDEX.get(event.id);
        shell.toast({ label: 'COMPLETE', title: entry.title, detail: 'The archive has noted this.' });
        audio.discovery();
        break;
      }
      case 'fragment':
        shell.toast({ label: 'FRAGMENT RECOVERED', title: 'A fragment of something older', detail: 'Filed under OBS-0000.' });
        audio.discovery();
        break;
      case 'achievement': {
        const achievement = ACHIEVEMENT_INDEX.get(event.id);
        shell.toast({ label: 'ACHIEVEMENT', title: achievement.title, detail: achievement.description });
        break;
      }
      default:
        break;
    }
  });

  /* ------------------------------------------------------------- views */
  let current = null;
  let token = 0;

  /** Decide what to show for a route, loading code if needed. */
  async function resolve(match) {
    switch (match.view) {
      case 'home':
        if (store.get().introSeen && !ctx.forceIntro) {
          window.location.replace('#/archive');
          return null;
        }
        ctx.forceIntro = false;
        return { name: 'home', where: '', mount: mountIntro };
      case 'archive':
        return { name: 'archive', where: 'INDEX', mount: mountArchive };
      case 'journal':
        return { name: 'journal', where: 'DISCOVERY LOG', mount: mountJournal };
      case 'submit': {
        const module = await import('./ui/submit.js');
        return { name: 'submit', where: 'TRANSMIT', mount: module.mountSubmit };
      }
      case 'origin':
        return { name: 'origin', where: 'OBS-0000', title: 'THE_ORIGIN · OBSCURA', discover: 'OBS-0000', mount: mountOrigin };
      case 'room': {
        const entry = ENTRY_INDEX.get(match.entryId);
        if (entryStatus(store.get(), entry) === 'sealed') {
          return { name: 'sealed', where: entry.id, mount: (c, x) => mountSealed(c, x, { entry }) };
        }
        const loader = ROOM_LOADERS[entry.id];
        if (!loader) return { name: 'room', where: entry.id, mount: (c, x) => mountUnavailable(c, x, { entry }) };
        try {
          const module = await loader();
          return { name: 'room', where: `${entry.id} — ${entry.title.toUpperCase()}`, title: `${entry.title} · OBSCURA`, discover: entry.id, mount: module.mount };
        } catch (error) {
          console.error(error);
          return { name: 'room', where: entry.id, mount: (c, x) => mountUnavailable(c, x, { entry }) };
        }
      }
      default:
        return { name: 'notfound', where: 'NO SIGNAL', mount: (c, x) => mountNotFound(c, x, { path: match.path }) };
    }
  }

  async function route() {
    const mine = (token += 1);
    const match = matchRoute(window.location.hash);
    let plan;
    try {
      plan = await resolve(match);
    } catch (error) {
      console.error(error);
      plan = { name: 'notfound', where: 'ERROR', mount: (c, x) => mountNotFound(c, x, { path: 'error' }) };
    }
    if (!plan || mine !== token) return;

    await shell.transition(() => {
      current?.destroy?.();
      current = null;
      shell.stage.replaceChildren();
      shell.setView(plan.name);
      shell.setWhere(plan.where);
      document.title = plan.title ?? TITLES[plan.name] ?? 'OBSCURA';
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (plan.discover) store.dispatch({ type: 'entry/discover', id: plan.discover });
      current = plan.mount(shell.stage, ctx);
      if (!shell.stage.contains(document.activeElement)) shell.stage.focus({ preventScroll: true });
    });
  }

  window.addEventListener('hashchange', route);

  /* -------------------------------------------------------------- boot */
  shell.setSound(false, audio.supported);
  if (store.get().sound && audio.supported) {
    // Browsers only start audio after a gesture, so resume on the first one.
    const resume = () => {
      setSound(true);
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }
  if (store.notice) shell.toast({ label: 'ARCHIVE', title: store.notice });
  if (!store.persistent) {
    shell.toast({ label: 'ARCHIVE', title: 'Progress cannot be saved in this browser', detail: 'Private browsing can do this. Discoveries will last until you close the tab.', duration: 9000 });
  }
  route();
}
