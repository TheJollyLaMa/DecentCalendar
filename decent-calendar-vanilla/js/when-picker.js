// Neon date/time picker for the Add Event panel. Writes local wall-clock
// values ("YYYY-MM-DDTHH:mm[:ss]") into the hidden #event-start/#event-end inputs.

export const STEP_MINUTES = 15;
export const DURATIONS = [15, 30, 45, 60, 90, 120];
const MINUTE = 60000;
const pad = value => String(value).padStart(2, '0');

export function localValue(date) {
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.getSeconds() ? `${base}:${pad(date.getSeconds())}` : base;
}

export function roundUp(date, step = STEP_MINUTES) {
  const ms = step * MINUTE;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return [hours && `${hours}h`, rest && `${rest}m`].filter(Boolean).join(' ') || '0m';
}

/** 42 local dates (6 weeks, Sunday first) covering the month of `anchor`. */
export function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Copy the wall-clock time of `time` onto the calendar day of `day`. */
export function withDay(time, day) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes(), time.getSeconds());
}

const fmt = (options, date) => new Intl.DateTimeFormat(undefined, options).format(date);
const dateText = date => fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, date);
const timeText = date => fmt({ hour: 'numeric', minute: '2-digit', ...(date.getSeconds() ? { second: '2-digit' } : {}) }, date);

export function installWhenPicker({ onChange = () => {} } = {}) {
  const $ = id => document.getElementById(id);
  const startInput = $('event-start'), endInput = $('event-end');
  const popover = $('when-popover');
  const triggers = { date: $('event-date-trigger'), start: $('event-start-trigger'), end: $('event-end-trigger') };
  const chips = [...document.querySelectorAll('#event-duration-chips [data-minutes]')];
  let start, end, open = null, viewMonth = new Date();

  const minutes = () => Math.round((end - start) / MINUTE);
  const render = () => {
    startInput.value = localValue(start);
    endInput.value = localValue(end);
    $('event-date-label').textContent = dateText(start);
    $('event-start-label').textContent = timeText(start);
    $('event-end-label').textContent = `${timeText(end)}${sameDay(start, end) ? '' : ` (${fmt({ weekday: 'short' }, end)})`}`;
    for (const chip of chips) chip.setAttribute('aria-pressed', String(Number(chip.dataset.minutes) === minutes()));
    $('event-duration-label').textContent = durationLabel(minutes());
    onChange({ start, end });
  };

  const close = (focus = true) => {
    if (!open) return;
    const trigger = triggers[open];
    open = null;
    popover.hidden = true;
    popover.replaceChildren();
    for (const t of Object.values(triggers)) t.setAttribute('aria-expanded', 'false');
    if (focus) trigger.focus();
  };

  const button = (text, className, onClick) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = text;
    el.addEventListener('click', onClick);
    return el;
  };

  const renderMonth = focusDate => {
    const today = new Date();
    const head = document.createElement('div');
    head.className = 'picker-month-head';
    const title = document.createElement('strong');
    title.textContent = fmt({ month: 'long', year: 'numeric' }, viewMonth);
    title.id = 'picker-month-title';
    const shift = by => () => { viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + by, 1); renderMonth(); };
    const prev = button('‹', 'picker-nav', shift(-1));
    prev.setAttribute('aria-label', 'Previous month');
    prev.disabled = viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() <= today.getMonth();
    const next = button('›', 'picker-nav', shift(1));
    next.setAttribute('aria-label', 'Next month');
    head.append(prev, title, next);

    const grid = document.createElement('div');
    grid.className = 'picker-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-labelledby', title.id);
    const days = monthGrid(viewMonth);
    for (const day of days.slice(0, 7)) {
      const dow = document.createElement('span');
      dow.className = 'picker-dow';
      dow.textContent = fmt({ weekday: 'narrow' }, day);
      dow.title = fmt({ weekday: 'long' }, day);
      dow.setAttribute('aria-hidden', 'true');
      grid.append(dow);
    }
    const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let focusTarget;
    for (const day of days) {
      const cell = button(String(day.getDate()), 'picker-day', () => {
        const duration = end - start;
        start = withDay(start, day);
        end = new Date(start.getTime() + duration);
        render();
        close();
      });
      cell.dataset.date = localValue(day).slice(0, 10);
      cell.setAttribute('aria-label', fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }, day));
      if (day.getMonth() !== viewMonth.getMonth()) cell.classList.add('outside');
      if (sameDay(day, today)) { cell.classList.add('today'); cell.setAttribute('aria-current', 'date'); }
      const selected = sameDay(day, start);
      cell.setAttribute('aria-pressed', String(selected));
      cell.disabled = day < midnight;
      cell.tabIndex = -1;
      if (focusDate ? sameDay(day, focusDate) : selected) focusTarget = cell;
      grid.append(cell);
    }
    const enabled = [...grid.querySelectorAll('.picker-day:not(:disabled)')];
    focusTarget ||= enabled.find(cell => !cell.classList.contains('outside')) || enabled[0];
    if (focusTarget) focusTarget.tabIndex = 0;
    grid.addEventListener('keydown', event => {
      const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
      if (!steps || !event.target.dataset.date) return;
      event.preventDefault();
      const [y, m, d] = event.target.dataset.date.split('-').map(Number);
      const target = new Date(y, m - 1, d + steps);
      if (target < midnight) return;
      if (target.getMonth() !== viewMonth.getMonth()) viewMonth = new Date(target.getFullYear(), target.getMonth(), 1);
      renderMonth(target);
    });
    popover.replaceChildren(head, grid);
    popover.setAttribute('aria-label', 'Choose a date');
    (focusTarget || next).focus();
  };

  const renderTimes = which => {
    const list = document.createElement('div');
    list.className = 'picker-times';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', which === 'start' ? 'Start time' : 'End time');
    const now = new Date();
    const options = [];
    if (which === 'start') {
      const seen = new Set();
      for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
        // Wall-clock construction keeps labels right on DST days; skip folded duplicates.
        const time = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, m);
        if (!sameDay(time, start) || seen.has(time.getTime())) continue;
        seen.add(time.getTime());
        if (time >= roundUp(now) || !sameDay(time, now)) options.push({ time, note: '' });
      }
    } else {
      for (let m = STEP_MINUTES; m <= 12 * 60; m += STEP_MINUTES) {
        const time = new Date(start.getTime() + m * MINUTE);
        options.push({ time, note: `${durationLabel(m)}${sameDay(time, start) ? '' : ' · next day'}` });
      }
    }
    let selected;
    for (const { time, note } of options) {
      const item = button('', 'picker-time', () => {
        if (which === 'start') {
          const duration = end - start;
          start = time;
          end = new Date(time.getTime() + duration);
        } else end = time;
        render();
        close();
      });
      item.setAttribute('role', 'option');
      const value = which === 'start' ? start : end;
      const isSelected = time.getTime() === value.getTime();
      item.setAttribute('aria-selected', String(isSelected));
      item.dataset.time = localValue(time);
      const label = document.createElement('span');
      label.textContent = timeText(time);
      item.append(label);
      if (note) {
        const small = document.createElement('small');
        small.textContent = note;
        item.append(small);
      }
      if (isSelected || (!selected && time >= value)) selected = item;
      list.append(item);
    }
    if (!options.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No start times left today. Pick another date.';
      list.append(empty);
    }
    list.addEventListener('keydown', event => {
      const items = [...list.querySelectorAll('.picker-time')];
      const index = items.indexOf(document.activeElement);
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (!step || index < 0) return;
      event.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, index + step))].focus();
    });
    popover.replaceChildren(list);
    popover.setAttribute('aria-label', which === 'start' ? 'Choose a start time' : 'Choose an end time');
    selected ||= list.querySelector('.picker-time');
    if (selected) {
      list.scrollTop = Math.max(0, selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2);
      selected.focus({ preventScroll: true });
    }
  };

  const toggle = which => {
    if (open === which) { close(); return; }
    close(false);
    open = which;
    triggers[which].setAttribute('aria-expanded', 'true');
    popover.hidden = false;
    popover.dataset.kind = which;
    if (which === 'date') { viewMonth = new Date(start.getFullYear(), start.getMonth(), 1); renderMonth(); }
    else renderTimes(which);
  };

  for (const [which, trigger] of Object.entries(triggers)) trigger.addEventListener('click', () => toggle(which));
  for (const chip of chips) chip.addEventListener('click', () => {
    end = new Date(start.getTime() + Number(chip.dataset.minutes) * MINUTE);
    close(false);
    render();
  });
  popover.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  });
  document.addEventListener('pointerdown', event => {
    if (open && !popover.contains(event.target) && !Object.values(triggers).some(t => t.contains(event.target))) close(false);
  });

  return {
    /** Accepts Dates or local/ISO strings; keeps exact seconds for chain-aligned slots. */
    setRange(from, to) {
      start = new Date(from);
      end = to ? new Date(to) : new Date(start.getTime() + 60 * MINUTE);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Invalid date range.');
      close(false);
      render();
    },
    reset() {
      start = roundUp(new Date());
      end = new Date(start.getTime() + 60 * MINUTE);
      close(false);
      render();
    },
    close: () => close(false),
    isOpen: () => open !== null,
    get range() { return { start, end }; },
  };
}
