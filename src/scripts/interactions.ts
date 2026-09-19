export {};

const status = document.querySelector<HTMLElement>('#copy-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

async function copy(text: string, button: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text);
    button.classList.add('is-copied');
    if (status) status.textContent = 'Copied to clipboard.';
    window.setTimeout(() => button.classList.remove('is-copied'), 1600);
  } catch {
    if (status)
      status.textContent = 'Clipboard unavailable. Select the code to copy it.';
    const source =
      button.closest('.code-window')?.querySelector('pre') ??
      button.closest('.install-command')?.querySelector('code');
    if (source) {
      const range = document.createRange();
      range.selectNodeContents(source);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }
}

document
  .querySelectorAll<HTMLButtonElement>('[data-copy-code]')
  .forEach((button) => {
    button.addEventListener('click', () => {
      const source = button
        .closest('.code-window')
        ?.querySelector<HTMLTextAreaElement>('.copy-source');
      if (source) void copy(source.value, button);
    });
  });

document.querySelectorAll<HTMLElement>('.install').forEach((install) => {
  const command = install.querySelector<HTMLElement>('[data-install-command]')!;
  const copyButton = install.querySelector<HTMLButtonElement>(
    '[data-copy-install]',
  )!;
  copyButton.addEventListener(
    'click',
    () => void copy(command.textContent!, copyButton),
  );
  install
    .querySelectorAll<HTMLButtonElement>('[data-package]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        command.textContent =
          button.dataset.package === 'pip' ? 'pip install kedi' : 'uv add kedi';
        install
          .querySelectorAll('[data-package]')
          .forEach((item) =>
            item.setAttribute('aria-pressed', String(item === button)),
          );
      });
    });
});

document
  .querySelectorAll<HTMLButtonElement>('[data-copy-command]')
  .forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.closest('.install-command')?.querySelector('code');
      if (command) void copy(command.textContent!, button);
    });
  });

document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((group) => {
  const tabs = Array.from(
    group.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const select = (tab: HTMLButtonElement) => {
    tabs.forEach((item) => {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    });
    group
      .querySelectorAll<HTMLElement>('[role="tabpanel"]')
      .forEach((panel) => {
        panel.hidden = panel.dataset.panel !== tab.dataset.tab;
      });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      let target: HTMLButtonElement | undefined;
      if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft')
        target = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs[tabs.length - 1];
      if (target) {
        event.preventDefault();
        select(target);
        target.focus();
      }
    });
  });
});

const cat = document.querySelector<HTMLButtonElement>('.cat-button');
cat?.addEventListener('click', () => {
  if (status) status.textContent = 'Meow!';
});
document
  .querySelectorAll<HTMLButtonElement>('[data-replay]')
  .forEach((button) => {
    button.addEventListener('click', () => {
      const demo = button.closest<HTMLElement>('.code-window')!;
      const label = button.querySelector('span')!;
      button.disabled = true;
      demo.classList.add('is-playing');
      demo.dataset.step = 'context';
      demo.setAttribute('aria-busy', 'true');
      label.textContent = 'Replaying...';
      if (!reducedMotion.matches) {
        window.setTimeout(() => {
          demo.dataset.step = 'template';
        }, 400);
      }
      window.setTimeout(
        () => {
          demo.classList.remove('is-playing');
          delete demo.dataset.step;
          demo.removeAttribute('aria-busy');
          button.disabled = false;
          label.textContent = 'Replay example';
        },
        reducedMotion.matches ? 0 : 1100,
      );
    });
  });

const menu = document.querySelector<HTMLButtonElement>('.menu-toggle')!;
function closeMenu() {
  document.body.classList.remove('nav-open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
}
menu.addEventListener('click', () => {
  const open = document.body.classList.toggle('nav-open');
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute(
    'aria-label',
    open ? 'Close navigation' : 'Open navigation',
  );
});
document
  .querySelectorAll('#site-nav a')
  .forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
    closeMenu();
    menu.focus();
  }
});
window.matchMedia('(min-width: 681px)').addEventListener('change', (event) => {
  if (event.matches) closeMenu();
});

const motionButton =
  document.querySelector<HTMLButtonElement>('.motion-toggle')!;
function setPaused(paused: boolean) {
  document.body.classList.toggle('motion-paused', paused);
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.setAttribute('aria-label', paused ? 'Play' : 'Pause');
  motionButton.dataset.tooltip = paused ? 'Play' : 'Pause';
}
setPaused(reducedMotion.matches);
motionButton.addEventListener('click', () =>
  setPaused(!document.body.classList.contains('motion-paused')),
);
reducedMotion.addEventListener('change', (event) => setPaused(event.matches));
