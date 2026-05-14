const STORAGE_KEY = 'calendar4xd-state-v3';
const LEGACY_STORAGE_KEYS = ['calendar4xd-state-v2', 'calendar4xd-state-v1'];
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const DEFAULT_TODO_COLOR = '#d95f93';
const DEFAULT_DONE_COLOR = '#5fa982';

const els = {
  yearLabel: document.querySelector('#yearLabel'),
  prevYear: document.querySelector('#prevYear'),
  nextYear: document.querySelector('#nextYear'),
  monthList: document.querySelector('#monthList'),
  singleThreadToggle: document.querySelector('#singleThreadToggle'),
  syncHolidayBtn: document.querySelector('#syncHolidayBtn'),
  shiftBack: document.querySelector('#shiftBack'),
  shiftForward: document.querySelector('#shiftForward'),
  monthTitle: document.querySelector('#monthTitle'),
  todayBtn: document.querySelector('#todayBtn'),
  overviewBtn: document.querySelector('#overviewBtn'),
  newTaskBtn: document.querySelector('#newTaskBtn'),
  newTaskForDayBtn: document.querySelector('#newTaskForDayBtn'),
  calendarGrid: document.querySelector('#calendarGrid'),
  selectedDateTitle: document.querySelector('#selectedDateTitle'),
  selectedDateHint: document.querySelector('#selectedDateHint'),
  dayTypeLabel: document.querySelector('#dayTypeLabel'),
  setDefaultDay: document.querySelector('#setDefaultDay'),
  setWorkDay: document.querySelector('#setWorkDay'),
  setRestDay: document.querySelector('#setRestDay'),
  dayTaskCount: document.querySelector('#dayTaskCount'),
  dayTaskList: document.querySelector('#dayTaskList'),
  taskFormCard: document.querySelector('#taskFormCard'),
  formTitle: document.querySelector('#formTitle'),
  cancelEditBtn: document.querySelector('#cancelEditBtn'),
  taskForm: document.querySelector('#taskForm'),
  taskId: document.querySelector('#taskId'),
  taskTitle: document.querySelector('#taskTitle'),
  taskNote: document.querySelector('#taskNote'),
  taskStart: document.querySelector('#taskStart'),
  taskDuration: document.querySelector('#taskDuration'),
  taskPoints: document.querySelector('#taskPoints'),
  taskCompleted: document.querySelector('#taskCompleted'),
  taskColor: document.querySelector('#taskColor'),
  completeTodayBtn: document.querySelector('#completeTodayBtn'),
  deleteTaskBtn: document.querySelector('#deleteTaskBtn'),
  monthStatsLabel: document.querySelector('#monthStatsLabel'),
  totalPoints: document.querySelector('#totalPoints'),
  monthPoints: document.querySelector('#monthPoints'),
  todayPoints: document.querySelector('#todayPoints'),
  totalDeliveryWeight: document.querySelector('#totalDeliveryWeight'),
  monthDeliveryWeight: document.querySelector('#monthDeliveryWeight'),
  todayDeliveryWeight: document.querySelector('#todayDeliveryWeight'),
  deliveryForm: document.querySelector('#deliveryForm'),
  deliveryWeight: document.querySelector('#deliveryWeight'),
  deliveryNote: document.querySelector('#deliveryNote'),
  deliveryDayTotal: document.querySelector('#deliveryDayTotal'),
  deliveryList: document.querySelector('#deliveryList'),
  overviewDrawer: document.querySelector('#overviewDrawer'),
  overviewBackdrop: document.querySelector('#overviewBackdrop'),
  closeOverviewBtn: document.querySelector('#closeOverviewBtn'),
  overviewList: document.querySelector('#overviewList'),
  toast: document.querySelector('#toast')
};

const today = stripTime(new Date());
let state = loadState();
let uiMode = 'view';
let overviewFilter = 'all';
const undoStack = [];
migrateSyncedManualOverrides();

function snapshotState() {
  return {
    state: JSON.parse(JSON.stringify(state)),
    uiMode,
    overviewFilter
  };
}

function recordUndo(label) {
  undoStack.push({ ...snapshotState(), label });
  if (undoStack.length > 50) undoStack.shift();
}

function undoLastChange() {
  const snapshot = undoStack.pop();
  if (!snapshot) {
    showToast('没有可撤销的操作');
    return;
  }
  state = snapshot.state;
  uiMode = snapshot.uiMode;
  overviewFilter = snapshot.overviewFilter;
  showToast(`已撤销：${snapshot.label}`);
  render();
}

function isEditingText(event) {
  const target = event.target;
  if (!target) return false;
  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!saved) return defaultState();

  try {
    const parsed = JSON.parse(saved);
    const legacyManualOverrides = parsed.manualDayOverrides || {};
    const legacySystemOverrides = parsed.systemDayOverrides || {};
    const legacyFlatOverrides = parsed.dayOverrides || {};
    const hasSystemLayer = Object.keys(legacySystemOverrides).length > 0;
    return {
      viewYear: parsed.viewYear ?? today.getFullYear(),
      viewMonth: parsed.viewMonth ?? today.getMonth(),
      selectedDate: parsed.selectedDate ?? toISO(today),
      singleThread: parsed.singleThread ?? true,
      manualDayOverrides: hasSystemLayer ? legacyManualOverrides : {},
      systemDayOverrides: hasSystemLayer ? legacySystemOverrides : { ...legacyFlatOverrides },
      holidaySyncYears: parsed.holidaySyncYears || {},
      deliveryEntries: Array.isArray(parsed.deliveryEntries) ? parsed.deliveryEntries.map(cleanDeliveryEntry) : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(cleanTask) : seedTasks()
    };
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return {
    viewYear: today.getFullYear(),
    viewMonth: today.getMonth(),
    selectedDate: toISO(today),
    singleThread: true,
    manualDayOverrides: {},
    systemDayOverrides: {},
    holidaySyncYears: {},
    deliveryEntries: [],
    tasks: seedTasks()
  };
}

function seedTasks() {
  const base = normalizeWorkStart(toISO(today), {});
  return [
    {
      id: crypto.randomUUID(),
      title: '整理本周工作计划',
      note: '明确每天只推进一个重点任务。',
      start: base,
      duration: 1,
      draftWeight: 1,
      completed: false,
      completedDate: null
    },
    {
      id: crypto.randomUUID(),
      title: '完成项目复盘文档',
      note: '写清楚问题、收益和后续行动。',
      start: addWorkdays(base, 1, {}),
      duration: 2,
      draftWeight: 1.25,
      completed: false,
      completedDate: null
    }
  ];
}

function cleanTask(task) {
  return {
    id: task.id || crypto.randomUUID(),
    title: task.title || '未命名任务',
    note: task.note || '',
    start: task.start || toISO(today),
    duration: Math.max(1, Number(task.duration) || 1),
    draftWeight: normalizeWeight(task.draftWeight ?? task.points ?? 0),
    customColor: isValidColor(task.customColor) ? task.customColor : '',
    completed: Boolean(task.completed),
    completedDate: task.completedDate || null
  };
}

function cleanDeliveryEntry(entry) {
  return {
    id: entry.id || crypto.randomUUID(),
    date: entry.date || toISO(today),
    weight: normalizeWeight(entry.weight ?? 0),
    note: entry.note || ''
  };
}

function migrateSyncedManualOverrides() {
  if (!state.manualDayOverrides || !state.systemDayOverrides) return;
  Object.entries(state.systemDayOverrides).forEach(([iso, value]) => {
    if (state.manualDayOverrides[iso] === value) {
      delete state.manualDayOverrides[iso];
    }
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeWeight(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(Math.max(0, parsed) * 100) / 100;
}

function formatWeight(value) {
  return normalizeWeight(value).toFixed(2);
}

function isValidColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function stripTime(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISO(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(a, b) {
  return Math.round((stripTime(a) - stripTime(b)) / DAY_MS);
}

function isDefaultRestDay(iso) {
  const day = parseISO(iso).getDay();
  return day === 0 || day === 6;
}

function getManualDayOverride(iso) {
  return state.manualDayOverrides?.[iso] || null;
}

function getSystemDayOverride(iso) {
  return state.systemDayOverrides?.[iso] || null;
}

function getEffectiveDayOverride(iso) {
  return getManualDayOverride(iso) || getSystemDayOverride(iso);
}

function isRestDay(iso, overrides = null) {
  if (overrides?.[iso] === 'work') return false;
  if (overrides?.[iso] === 'rest') return true;
  if (overrides) return isDefaultRestDay(iso);
  const effective = getEffectiveDayOverride(iso);
  if (effective === 'work') return false;
  if (effective === 'rest') return true;
  return isDefaultRestDay(iso);
}

function isWorkday(iso, overrides = null) {
  return !isRestDay(iso, overrides);
}

function normalizeWorkStart(iso, overrides = null) {
  let date = parseISO(iso);
  while (!isWorkday(toISO(date), overrides)) {
    date = addDays(date, 1);
  }
  return toISO(date);
}

function addWorkdays(iso, amount, overrides = null) {
  if (amount === 0) return normalizeWorkStart(iso, overrides);

  let date = parseISO(iso);
  let remaining = Math.abs(amount);
  const step = amount > 0 ? 1 : -1;
  while (remaining > 0) {
    date = addDays(date, step);
    if (isWorkday(toISO(date), overrides)) remaining -= 1;
  }
  return toISO(date);
}

function nextWorkdayAfter(iso) {
  return addWorkdays(iso, 1);
}

function taskDates(task) {
  const dates = [];
  let cursor = normalizeWorkStart(task.start);
  while (dates.length < task.duration) {
    if (isWorkday(cursor)) dates.push(cursor);
    cursor = toISO(addDays(parseISO(cursor), 1));
  }
  return dates;
}

function taskEnd(task) {
  return parseISO(taskDates(task).at(-1));
}

function formatDate(iso) {
  const date = parseISO(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatRange(task) {
  const dates = taskDates(task);
  const start = dates[0];
  const end = dates.at(-1);
  return start === end ? formatDate(start) : `${formatDate(start)} - ${formatDate(end)}`;
}

function isTaskOnDate(task, iso) {
  return taskDates(task).includes(iso);
}

function getTasksOnDate(iso) {
  return state.tasks
    .filter((task) => isTaskOnDate(task, iso))
    .sort((a, b) => taskDates(a)[0].localeCompare(taskDates(b)[0]) || a.title.localeCompare(b.title));
}

function sortTasks() {
  state.tasks.sort((a, b) => taskDates(a)[0].localeCompare(taskDates(b)[0]) || a.title.localeCompare(b.title));
}

function findTask(id) {
  return state.tasks.find((task) => task.id === id);
}

function taskColor(task) {
  if (task.completed) return DEFAULT_DONE_COLOR;
  return isValidColor(task.customColor) ? task.customColor : DEFAULT_TODO_COLOR;
}

function shiftTask(task, workdays) {
  task.start = addWorkdays(taskDates(task)[0], workdays);
}

function normalizeExceptIds(exceptIds = null) {
  if (!exceptIds) return new Set();
  if (exceptIds instanceof Set) return exceptIds;
  if (Array.isArray(exceptIds)) return new Set(exceptIds);
  return new Set([exceptIds]);
}

function shiftTasksFrom(dateISO, workdays, exceptIds = null) {
  const anchor = normalizeWorkStart(dateISO);
  const excluded = normalizeExceptIds(exceptIds);
  state.tasks.forEach((task) => {
    if (!excluded.has(task.id) && taskDates(task)[0] >= anchor) {
      shiftTask(task, workdays);
    }
  });
}

function shiftBlockingTasks(dateISO, workdays, exceptIds = null) {
  const anchor = normalizeWorkStart(dateISO);
  const excluded = normalizeExceptIds(exceptIds);
  state.tasks.forEach((task) => {
    if (!excluded.has(task.id) && toISO(taskEnd(task)) >= anchor) {
      shiftTask(task, workdays);
    }
  });
}

function hasTaskOnDate(dateISO, exceptIds = null) {
  const excluded = normalizeExceptIds(exceptIds);
  return getTasksOnDate(dateISO).some((task) => !excluded.has(task.id));
}

function hasTaskInDates(dates, exceptIds = null) {
  const excluded = normalizeExceptIds(exceptIds);
  return state.tasks.some((task) => {
    if (excluded.has(task.id)) return false;
    const occupied = taskDates(task);
    return dates.some((date) => occupied.includes(date));
  });
}

function getPlannedDates(startISO, duration) {
  return taskDates({ start: startISO, duration });
}

function tasksOverlap(a, b) {
  const aDates = taskDates(a);
  const bDates = taskDates(b);
  return aDates.some((date) => bDates.includes(date));
}

function placeAfter(task, anchorTask) {
  task.start = nextWorkdayAfter(toISO(taskEnd(anchorTask)));
}

function resolveSingleThreadOverlaps(preferredIds = null) {
  if (!state.singleThread) return;
  const preferred = normalizeExceptIds(preferredIds);
  let changed = true;
  let guard = 0;

  while (changed && guard < 500) {
    guard += 1;
    changed = false;
    sortTasks();

    for (let i = 0; i < state.tasks.length; i += 1) {
      for (let j = i + 1; j < state.tasks.length; j += 1) {
        const first = state.tasks[i];
        const second = state.tasks[j];
        if (!tasksOverlap(first, second)) continue;

        if (preferred.has(second.id) && !preferred.has(first.id)) {
          placeAfter(first, second);
        } else {
          placeAfter(second, first);
        }
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
}

function alignTaskStartToDraggedDate(dropISO, draggedOffset) {
  let start = normalizeWorkStart(dropISO);
  for (let index = 0; index < draggedOffset; index += 1) {
    start = addWorkdays(start, -1);
  }
  return normalizeWorkStart(start);
}

function parseDragPayload(payload) {
  try {
    const parsed = JSON.parse(payload);
    return {
      taskId: parsed.taskId,
      draggedOffset: Math.max(0, Number(parsed.draggedOffset) || 0)
    };
  } catch {
    return { taskId: payload, draggedOffset: 0 };
  }
}

function setDragPayload(event, taskId, draggedOffset = 0) {
  event.dataTransfer.setData('text/plain', JSON.stringify({ taskId, draggedOffset }));
  event.dataTransfer.effectAllowed = 'move';
}

function normalizeAllTaskStarts() {
  state.tasks.forEach((task) => {
    task.start = normalizeWorkStart(task.start);
  });
}

function render() {
  normalizeAllTaskStarts();
  sortTasks();
  saveState();
  renderMonths();
  renderCalendar();
  renderSelectedDay();
  renderStats();
  if (!els.overviewDrawer.classList.contains('hidden')) renderOverview();
}

function renderMonths() {
  els.yearLabel.textContent = state.viewYear;
  els.monthList.innerHTML = '';
  for (let index = 0; index < 12; index += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `month-pill${index === state.viewMonth ? ' active' : ''}`;
    button.textContent = `${index + 1}月`;
    button.addEventListener('click', () => selectDate(getMonthFocusDate(state.viewYear, index)));
    els.monthList.append(button);
  }
  els.singleThreadToggle.checked = state.singleThread;
}

function getMonthFocusDate(year, month) {
  const firstTaskDate = state.tasks
    .flatMap((task) => taskDates(task))
    .filter((iso) => {
      const date = parseISO(iso);
      return date.getFullYear() === year && date.getMonth() === month;
    })
    .sort()[0];
  return firstTaskDate || toISO(new Date(year, month, 1));
}

function renderCalendar() {
  els.monthTitle.textContent = `${state.viewYear}年${state.viewMonth + 1}月`;
  els.calendarGrid.innerHTML = '';

  const first = new Date(state.viewYear, state.viewMonth, 1);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const iso = toISO(date);
    const tasks = getTasksOnDate(iso);
    const completedDraftWeight = tasks
      .filter((task) => task.completed && taskDates(task)[0] === iso)
      .reduce((sum, task) => sum + task.draftWeight, 0);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.setAttribute('role', 'button');
    cell.tabIndex = 0;
    cell.dataset.date = iso;
    if (date.getMonth() !== state.viewMonth) cell.classList.add('outside');
    if (iso === state.selectedDate) cell.classList.add('selected');
    if (iso === toISO(today)) cell.classList.add('today');
    if (isRestDay(iso)) cell.classList.add('rest-day');
    if (getSystemDayOverride(iso) === 'work') cell.classList.add('system-workday');
    if (getSystemDayOverride(iso) === 'rest') cell.classList.add('system-restday');
    if (getManualDayOverride(iso) === 'work') cell.classList.add('manual-workday');
    if (getManualDayOverride(iso) === 'rest') cell.classList.add('manual-restday');
    cell.addEventListener('click', () => selectDate(iso));
    cell.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectDate(iso);
      }
    });
    cell.addEventListener('dragover', (event) => {
      event.preventDefault();
      cell.classList.add('drop-target');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('drop-target'));
    cell.addEventListener('drop', (event) => {
      event.preventDefault();
      cell.classList.remove('drop-target');
      moveTaskToDate(event.dataTransfer.getData('text/plain'), iso);
    });

    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML = `
      <span class="day-number">${date.getDate()}</span>
      <span class="day-tags">
        ${renderDayTypeBadge(iso)}
        <span class="day-points">${completedDraftWeight ? `+${formatWeight(completedDraftWeight)}` : ''}</span>
      </span>
    `;
    cell.append(head);
    if (iso === toISO(today)) {
      const todayMark = document.createElement('span');
      todayMark.className = 'today-corner';
      todayMark.textContent = '今';
      cell.append(todayMark);
    }

    tasks.slice(0, state.singleThread ? 1 : 3).forEach((task) => {
      cell.append(createCalendarTask(task, iso));
    });

    const visibleCount = state.singleThread ? 1 : 3;
    if (tasks.length > visibleCount) {
      const more = document.createElement('div');
      more.className = 'more-count';
      more.textContent = `还有 ${tasks.length - visibleCount} 个`;
      cell.append(more);
    }

    els.calendarGrid.append(cell);
  }
}

function renderDayTypeBadge(iso) {
  if (getManualDayOverride(iso) === 'work') return '<span class="day-type-badge work">手班</span>';
  if (getManualDayOverride(iso) === 'rest') return '<span class="day-type-badge rest">手休</span>';
  if (getSystemDayOverride(iso) === 'work') return '<span class="day-type-badge work">调班</span>';
  if (getSystemDayOverride(iso) === 'rest') return '<span class="day-type-badge rest">节休</span>';
  if (isRestDay(iso)) return '<span class="day-type-badge rest">休</span>';
  return '';
}

function createCalendarTask(task, iso) {
  const dates = taskDates(task);
  const index = dates.indexOf(iso);
  const item = document.createElement('div');
  const segment = dates.length === 1 ? 'single' : index === 0 ? 'start' : index === dates.length - 1 ? 'end' : 'middle';
  item.className = `calendar-task segment-${segment}${task.completed ? ' completed' : ''}`;
  item.draggable = true;
  item.dataset.taskId = task.id;
  item.style.setProperty('--task-color', taskColor(task));
  item.title = `${task.title}，${formatRange(task)}，初稿权值 ${formatWeight(task.draftWeight)}`;
  item.innerHTML = `
    <span class="title">${escapeHTML(task.title)}</span>
    <span class="meta">${task.completed ? '完成' : `${index + 1}/${task.duration}`}</span>
  `;
  item.addEventListener('click', (event) => {
    event.stopPropagation();
    selectDate(iso);
  });
  item.addEventListener('dragstart', (event) => {
    setDragPayload(event, task.id, index);
  });
  return item;
}

function renderSelectedDay() {
  const date = parseISO(state.selectedDate);
  const tasks = getTasksOnDate(state.selectedDate);
  const rest = isRestDay(state.selectedDate);
  const manualOverride = getManualDayOverride(state.selectedDate);
  const systemOverride = getSystemDayOverride(state.selectedDate);
  els.selectedDateTitle.textContent = `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
  els.selectedDateHint.textContent = rest
    ? '这一天默认跳过排程。可以手动设为工作日。'
    : tasks.length
      ? `这一天有 ${tasks.length} 个任务，拖拽任意任务段会移动整个任务`
      : '这一天还没有任务，可以新建一个';
  els.dayTypeLabel.textContent = manualOverride === 'work'
    ? '用户设为工作日'
    : manualOverride === 'rest'
      ? '用户设为休息日'
      : systemOverride === 'work'
        ? '系统调休工作日'
        : systemOverride === 'rest'
          ? '系统节假休息日'
          : rest
            ? '默认休息日'
            : '默认工作日';
  els.dayTypeLabel.className = rest ? 'rest' : 'work';
  els.dayTaskCount.textContent = `${tasks.length} 个`;
  renderTaskList(els.dayTaskList, tasks, 'day');
  renderDeliveryEntries();
  els.taskFormCard.classList.toggle('hidden', uiMode === 'view');
}

function renderDeliveryEntries() {
  const entries = (state.deliveryEntries || [])
    .filter((entry) => entry.date === state.selectedDate)
    .sort((a, b) => a.id.localeCompare(b.id));
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  els.deliveryDayTotal.textContent = formatWeight(total);
  els.deliveryList.innerHTML = '';

  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state compact';
    empty.textContent = '当天暂无递交权值';
    els.deliveryList.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'delivery-item';
    item.innerHTML = `
      <strong>${formatWeight(entry.weight)}</strong>
      <span>${entry.note ? escapeHTML(entry.note) : '无备注'}</span>
      <button type="button" data-delivery-delete="${entry.id}">删除</button>
    `;
    els.deliveryList.append(item);
  });
}

function renderTaskList(container, tasks, source) {
  container.innerHTML = '';
  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = source === 'day' ? '当天暂无任务' : '没有符合条件的任务';
    container.append(empty);
    return;
  }

  tasks.forEach((task) => {
    const item = document.createElement('article');
    item.className = `task-item${task.completed ? ' completed' : ''}`;
    item.draggable = true;
    item.dataset.taskId = task.id;
    item.style.setProperty('--task-color', taskColor(task));
    item.addEventListener('dragstart', (event) => {
      setDragPayload(event, task.id, 0);
    });
    item.innerHTML = `
      <div class="task-item-head">
        <h4>${escapeHTML(task.title)}</h4>
        <span class="status-pill ${task.completed ? 'done' : ''}">${task.completed ? '已完成' : '未处理'}</span>
      </div>
      ${task.note ? `<p class="task-note">${escapeHTML(task.note)}</p>` : ''}
      <div class="task-meta">
        <span>${formatRange(task)}</span>
        <span>${task.duration} 个工作日</span>
        <span>初稿 ${formatWeight(task.draftWeight)}</span>
        ${task.completedDate ? `<span>完成于 ${formatDate(task.completedDate)}</span>` : ''}
      </div>
      <div class="task-actions">
        ${task.completed ? `<button data-action="undo" data-id="${task.id}">撤回完成</button>` : `<button class="primary" data-action="complete" data-id="${task.id}">完成</button>`}
        <button data-action="edit" data-id="${task.id}">编辑</button>
        <button class="danger" data-action="delete" data-id="${task.id}">删除</button>
      </div>
    `;
    container.append(item);
  });
}

function renderStats() {
  els.monthStatsLabel.textContent = `${state.viewMonth + 1}月`;
  const currentMonth = `${state.viewYear}-${String(state.viewMonth + 1).padStart(2, '0')}`;
  const completed = state.tasks.filter((task) => task.completed && task.completedDate);
  const total = completed.reduce((sum, task) => sum + task.draftWeight, 0);
  const month = completed
    .filter((task) => task.completedDate.startsWith(currentMonth))
    .reduce((sum, task) => sum + task.draftWeight, 0);
  const day = completed
    .filter((task) => task.completedDate === state.selectedDate)
    .reduce((sum, task) => sum + task.draftWeight, 0);

  const delivery = state.deliveryEntries || [];
  const deliveryTotal = delivery.reduce((sum, entry) => sum + entry.weight, 0);
  const deliveryMonth = delivery
    .filter((entry) => entry.date.startsWith(currentMonth))
    .reduce((sum, entry) => sum + entry.weight, 0);
  const deliveryDay = delivery
    .filter((entry) => entry.date === state.selectedDate)
    .reduce((sum, entry) => sum + entry.weight, 0);

  els.totalPoints.textContent = formatWeight(total);
  els.monthPoints.textContent = formatWeight(month);
  els.todayPoints.textContent = formatWeight(day);
  els.totalDeliveryWeight.textContent = formatWeight(deliveryTotal);
  els.monthDeliveryWeight.textContent = formatWeight(deliveryMonth);
  els.todayDeliveryWeight.textContent = formatWeight(deliveryDay);
}

function renderOverview() {
  const tasks = state.tasks.filter((task) => {
    if (overviewFilter === 'todo') return !task.completed;
    if (overviewFilter === 'done') return task.completed;
    return true;
  });
  renderTaskList(els.overviewList, tasks, 'overview');
}

function selectDate(iso) {
  state.selectedDate = iso;
  const date = parseISO(iso);
  state.viewYear = date.getFullYear();
  state.viewMonth = date.getMonth();
  uiMode = 'view';
  render();
}

function startCreate() {
  uiMode = 'create';
  els.formTitle.textContent = '新建任务';
  fillTaskForm(null);
  renderSelectedDay();
  els.taskTitle.focus();
}

function startEdit(id) {
  const task = findTask(id);
  if (!task) return;
  uiMode = 'edit';
  state.selectedDate = taskDates(task)[0];
  const date = parseISO(state.selectedDate);
  state.viewYear = date.getFullYear();
  state.viewMonth = date.getMonth();
  els.formTitle.textContent = '编辑任务';
  fillTaskForm(task);
  render();
  els.taskTitle.focus();
}

function fillTaskForm(task) {
  els.taskId.value = task?.id || '';
  els.taskTitle.value = task?.title || '';
  els.taskNote.value = task?.note || '';
  els.taskStart.value = task?.start || normalizeWorkStart(state.selectedDate);
  els.taskDuration.value = task?.duration || 1;
  els.taskPoints.value = formatWeight(task?.draftWeight ?? 1);
  els.taskCompleted.value = String(task?.completed || false);
  els.taskColor.value = isValidColor(task?.customColor) ? task.customColor : DEFAULT_TODO_COLOR;
  els.completeTodayBtn.disabled = !task || task.completed;
  els.deleteTaskBtn.disabled = !task;
}

function upsertTask(event) {
  event.preventDefault();
  const id = els.taskId.value || crypto.randomUUID();
  const oldTask = findTask(id);
  const start = normalizeWorkStart(els.taskStart.value);
  const duration = Math.max(1, Number(els.taskDuration.value) || 1);
  const completed = els.taskCompleted.value === 'true';
  const nextTask = {
    id,
    title: els.taskTitle.value.trim(),
    note: els.taskNote.value.trim(),
    start,
    duration,
    draftWeight: normalizeWeight(els.taskPoints.value),
    customColor: isValidColor(els.taskColor.value) ? els.taskColor.value : '',
    completed,
    completedDate: completed ? oldTask?.completedDate || start : null
  };

  if (!nextTask.title) {
    showToast('请先填写任务名称');
    return;
  }

  recordUndo(oldTask ? '编辑任务' : '新建任务');
  if (oldTask) {
    Object.assign(oldTask, nextTask);
    showToast('任务已保存');
  } else {
    state.tasks.push(nextTask);
    showToast(`已插入任务，后续任务顺延 ${nextTask.duration} 个工作日`);
  }

  resolveSingleThreadOverlaps(new Set([nextTask.id]));

  uiMode = 'view';
  selectDate(nextTask.start);
}

function completeTask(id, completedDate = state.selectedDate) {
  const task = findTask(id);
  if (!task || task.completed) return;

  recordUndo('完成任务');
  const dates = taskDates(task);
  const finishISO = dates.includes(completedDate) ? completedDate : dates.at(-1);
  task.completed = true;
  task.completedDate = finishISO;
  showToast('任务已完成，初稿权值已记录');
  uiMode = 'view';
  render();
}

function undoCompleteTask(id) {
  const task = findTask(id);
  if (!task) return;
  recordUndo('撤回完成');
  task.completed = false;
  task.completedDate = null;
  showToast('已撤回完成状态');
  render();
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task) return;
  recordUndo('删除任务');
  state.tasks = state.tasks.filter((item) => item.id !== id);
  if (els.taskId.value === id) uiMode = 'view';
  showToast('任务已删除');
  render();
}

function moveTaskToDate(payload, dateISO) {
  const { taskId, draggedOffset } = parseDragPayload(payload);
  const task = findTask(taskId);
  if (!task) return;
  recordUndo('拖拽移动任务');
  const dropAnchor = normalizeWorkStart(dateISO);
  const targetStart = alignTaskStartToDraggedDate(dropAnchor, draggedOffset);
  const targetDates = getPlannedDates(targetStart, task.duration);
  const shouldInsert = state.singleThread && hasTaskInDates(targetDates, task.id);
  task.start = targetStart;
  resolveSingleThreadOverlaps(new Set([task.id]));
  state.selectedDate = targetStart;
  const date = parseISO(targetStart);
  state.viewYear = date.getFullYear();
  state.viewMonth = date.getMonth();
  uiMode = 'view';
  showToast(shouldInsert ? `已插入到 ${formatDate(dropAnchor)}，后续任务已顺延` : `已移动到 ${formatDate(targetStart)}`);
  render();
}

function setDayOverride(value) {
  recordUndo('调整日期类型');
  if (!state.manualDayOverrides) state.manualDayOverrides = {};
  if (value) {
    state.manualDayOverrides[state.selectedDate] = value;
  } else {
    delete state.manualDayOverrides[state.selectedDate];
  }
  normalizeAllTaskStarts();
  showToast(value === 'work' ? '已设为工作日' : value === 'rest' ? '已设为休息日' : '已恢复默认日历设置');
  render();
}

function addDeliveryEntry(event) {
  event.preventDefault();
  const weight = normalizeWeight(els.deliveryWeight.value);
  if (weight <= 0) {
    showToast('递交权值需要大于 0');
    return;
  }
  recordUndo('添加递交权值');
  if (!state.deliveryEntries) state.deliveryEntries = [];
  state.deliveryEntries.push({
    id: crypto.randomUUID(),
    date: state.selectedDate,
    weight,
    note: els.deliveryNote.value.trim()
  });
  els.deliveryWeight.value = '1.00';
  els.deliveryNote.value = '';
  showToast('递交权值已添加');
  render();
}

function deleteDeliveryEntry(id) {
  recordUndo('删除递交权值');
  state.deliveryEntries = (state.deliveryEntries || []).filter((entry) => entry.id !== id);
  showToast('递交权值已删除');
  render();
}

async function syncCurrentYearHolidays(options = {}) {
  const silent = Boolean(options.silent);
  const year = options.year || state.viewYear;
  els.syncHolidayBtn.disabled = true;
  if (!silent) els.syncHolidayBtn.textContent = '同步中...';
  try {
    const response = await fetch(`https://timor.tech/api/holiday/year/${year}/`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const holidays = payload.holiday || {};
    let count = 0;

    if (!silent) recordUndo('同步节假日');
    Object.values(holidays).forEach((item) => {
      const iso = item.date || (item.year && item.date ? `${item.year}-${item.date}` : null);
      if (!iso) return;
      if (!state.systemDayOverrides) state.systemDayOverrides = {};
      if (item.holiday === true || item.type === 1) {
        state.systemDayOverrides[iso] = 'rest';
        count += 1;
      } else if (item.holiday === false || item.type === 0) {
        state.systemDayOverrides[iso] = 'work';
        count += 1;
      }
    });

    if (!state.holidaySyncYears) state.holidaySyncYears = {};
    state.holidaySyncYears[year] = new Date().toISOString();
    normalizeAllTaskStarts();
    if (!silent) showToast(`已同步 ${year} 年节假日/调休 ${count} 天`);
    render();
  } catch {
    if (!silent) showToast('节假日同步失败，请检查网络后重试');
  } finally {
    els.syncHolidayBtn.disabled = false;
    els.syncHolidayBtn.textContent = '同步本年节假日';
  }
}

function autoSyncHolidaysOnce() {
  const year = today.getFullYear();
  if (state.holidaySyncYears?.[year]) return;
  syncCurrentYearHolidays({ silent: true, year });
}

function getActiveMoveTasks() {
  return getTasksOnDate(state.selectedDate);
}

function moveActiveTasks(direction) {
  const tasks = getActiveMoveTasks();
  if (!tasks.length) {
    showToast('当前日期没有可移动的任务');
    return;
  }

  recordUndo(direction > 0 ? '任务后移' : '任务前移');
  const movingIds = new Set(tasks.map((task) => task.id));
  const orderedTasks = [...tasks].sort((a, b) => taskDates(a)[0].localeCompare(taskDates(b)[0]));
  if (direction > 0) orderedTasks.reverse();

  orderedTasks.forEach((task) => {
    const targetStart = addWorkdays(taskDates(task)[0], direction);
    task.start = targetStart;
  });
  resolveSingleThreadOverlaps(movingIds);

  state.selectedDate = direction > 0
    ? taskDates(orderedTasks.at(-1))[0]
    : taskDates(orderedTasks[0])[0];
  const date = parseISO(state.selectedDate);
  state.viewYear = date.getFullYear();
  state.viewMonth = date.getMonth();
  showToast(`已移动 ${tasks.length} 个任务`);
  render();
}

function handleTaskAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'complete') completeTask(id);
  if (action === 'undo') undoCompleteTask(id);
  if (action === 'edit') startEdit(id);
  if (action === 'delete') deleteTask(id);
}

function openOverview() {
  els.overviewDrawer.classList.remove('hidden');
  renderOverview();
}

function closeOverview() {
  els.overviewDrawer.classList.add('hidden');
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

els.prevYear.addEventListener('click', () => {
  state.viewYear -= 1;
  uiMode = 'view';
  render();
});

els.nextYear.addEventListener('click', () => {
  state.viewYear += 1;
  uiMode = 'view';
  render();
});

els.singleThreadToggle.addEventListener('change', () => {
  state.singleThread = els.singleThreadToggle.checked;
  render();
});
els.syncHolidayBtn.addEventListener('click', syncCurrentYearHolidays);

els.todayBtn.addEventListener('click', () => selectDate(toISO(today)));
els.newTaskBtn.addEventListener('click', startCreate);
els.newTaskForDayBtn.addEventListener('click', startCreate);
els.cancelEditBtn.addEventListener('click', () => {
  uiMode = 'view';
  render();
});
els.taskForm.addEventListener('submit', upsertTask);
els.deliveryForm.addEventListener('submit', addDeliveryEntry);
els.deliveryList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-delivery-delete]');
  if (button) deleteDeliveryEntry(button.dataset.deliveryDelete);
});
els.completeTodayBtn.addEventListener('click', () => completeTask(els.taskId.value));
els.deleteTaskBtn.addEventListener('click', () => deleteTask(els.taskId.value));
els.dayTaskList.addEventListener('click', handleTaskAction);
els.overviewList.addEventListener('click', handleTaskAction);
els.setDefaultDay.addEventListener('click', () => setDayOverride(null));
els.setWorkDay.addEventListener('click', () => setDayOverride('work'));
els.setRestDay.addEventListener('click', () => setDayOverride('rest'));

els.shiftBack.addEventListener('click', () => {
  moveActiveTasks(-1);
});

els.shiftForward.addEventListener('click', () => {
  moveActiveTasks(1);
});

els.overviewBtn.addEventListener('click', openOverview);
els.overviewBackdrop.addEventListener('click', closeOverview);
els.closeOverviewBtn.addEventListener('click', closeOverview);

document.querySelectorAll('.filter').forEach((button) => {
  button.addEventListener('click', () => {
    overviewFilter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
    renderOverview();
  });
});

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z' || event.shiftKey || event.altKey) return;
  if (isEditingText(event)) return;
  event.preventDefault();
  undoLastChange();
});

render();
autoSyncHolidaysOnce();
