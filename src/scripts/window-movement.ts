interface Position {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function initWindowMovement() {
  const desktop = window.matchMedia('(min-width: 681px)');
  const movedWindows = new Set<() => void>();
  let idleTimeout: number | undefined;

  const restartIdleTimer = () => {
    window.clearTimeout(idleTimeout);
    idleTimeout = undefined;
    if (movedWindows.size) {
      idleTimeout = window.setTimeout(() => {
        for (const restore of Array.from(movedWindows)) restore();
      }, 60_000);
    }
  };

  for (const event of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'keydown',
    'wheel',
    'scroll',
  ]) {
    window.addEventListener(event, restartIdleTimer, {
      passive: true,
      capture: true,
    });
  }

  document.querySelectorAll<HTMLElement>('.code-window').forEach((frame) => {
    const title = frame.querySelector<HTMLElement>('.window-title')!;
    const reset = frame.querySelector<HTMLButtonElement>(
      '[data-reset-window]',
    )!;
    const section = frame.closest('section')!;
    let position: Position = { x: 0, y: 0 };
    let drag:
      | { id: number; start: Position; origin: Position; bounds: Bounds }
      | undefined;

    // The window keeps its layout space; only its painted position moves.
    const bounds = (): Bounds => {
      const rect = frame.getBoundingClientRect();
      const area = section.getBoundingClientRect();
      return {
        minX: Math.min(0, Math.max(area.left, 0) + 12 - rect.left + position.x),
        maxX: Math.max(
          0,
          Math.min(area.right, document.documentElement.clientWidth) -
            12 -
            rect.right +
            position.x,
        ),
        minY: Math.min(0, area.top + 12 - rect.top + position.y),
        maxY: Math.max(0, area.bottom - 12 - rect.bottom + position.y),
      };
    };

    const move = (next: Position, limits = bounds()) => {
      position = {
        x: Math.max(limits.minX, Math.min(limits.maxX, next.x)),
        y: Math.max(limits.minY, Math.min(limits.maxY, next.y)),
      };
      const displaced = position.x !== 0 || position.y !== 0;
      frame.style.translate = displaced
        ? `${position.x}px ${position.y}px`
        : '';
      frame.classList.toggle('is-displaced', displaced);
      reset.disabled = !displaced;
      if (displaced) movedWindows.add(restore);
      else movedWindows.delete(restore);
      restartIdleTimer();
    };

    const stop = (cancel = false) => {
      if (!drag) return;
      const previous = drag;
      drag = undefined;
      frame.classList.remove('is-dragging');
      if (title.hasPointerCapture(previous.id)) {
        title.releasePointerCapture(previous.id);
      }
      if (cancel) move(previous.origin);
    };

    const restore = () => {
      stop();
      move({ x: 0, y: 0 });
    };

    const updateAvailability = () => {
      restore();
      frame.classList.toggle('is-movable', desktop.matches);
      title.tabIndex = desktop.matches ? 0 : -1;
      reset.hidden = !desktop.matches;
      if (desktop.matches) {
        title.setAttribute(
          'aria-description',
          'Drag or use arrow keys to move. Home resets position.',
        );
        title.setAttribute(
          'aria-keyshortcuts',
          'ArrowUp ArrowDown ArrowLeft ArrowRight Home Escape',
        );
        title.title = 'Move window';
      } else {
        title.removeAttribute('aria-description');
        title.removeAttribute('aria-keyshortcuts');
        title.removeAttribute('title');
      }
    };

    title.addEventListener('pointerdown', (event) => {
      if (
        !desktop.matches ||
        drag ||
        !event.isPrimary ||
        event.button !== 0 ||
        (event.target as Element).closest('button')
      )
        return;
      event.preventDefault();
      title.focus({ preventScroll: true });
      drag = {
        id: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        origin: { ...position },
        bounds: bounds(),
      };
      title.setPointerCapture(event.pointerId);
      frame.classList.add('is-dragging');
    });

    title.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      move(
        {
          x: drag.origin.x + event.clientX - drag.start.x,
          y: drag.origin.y + event.clientY - drag.start.y,
        },
        drag.bounds,
      );
    });
    title.addEventListener('pointerup', (event) => {
      if (drag?.id === event.pointerId) stop();
    });
    title.addEventListener('pointercancel', (event) => {
      if (drag?.id === event.pointerId) stop(true);
    });
    title.addEventListener('lostpointercapture', () => stop());
    window.addEventListener('blur', () => stop(true));

    title.addEventListener('keydown', (event) => {
      if (
        !desktop.matches ||
        event.target !== title ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      const step = event.shiftKey ? 40 : 10;
      const directions: Record<string, Position> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      if (event.key === 'Home' || event.key === 'Escape') {
        event.preventDefault();
        restore();
      } else if (directions[event.key]) {
        event.preventDefault();
        stop();
        const delta = directions[event.key];
        move({ x: position.x + delta.x, y: position.y + delta.y });
      }
    });
    title.addEventListener('dblclick', (event) => {
      if (desktop.matches && !(event.target as Element).closest('button'))
        restore();
    });
    reset.addEventListener('click', () => {
      restore();
      title.focus({ preventScroll: true });
    });
    window.addEventListener('resize', updateAvailability);
    updateAvailability();
  });
}
