const STORAGE_KEY = 'calendar4xd-state-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const els = {
  yearLabel: document.querySelector('#yearLabel'),
  prevYear: document.querySelector('#prevYear'),
  nextYear: document.querySelector('#nextYear'),
  monthList: document.querySelector('#monthList'),
  singleThreadToggle: document.querySelector('#singleThreadToggle'),
  shiftBack: document.querySelector('#shiftBack'),
  shiftForward: document.querySelector('#shiftForward'),
  monthTitle: document.querySelector('#monthTitle'),
  todayBtn: document.querySelector('#todayBtn'),
  newTaskBtn: document.querySelector('#newTaskBtn'),
  calendarGrid: document.querySelector('#calendarGrid'),
  selectedDateTitle: document.querySelector('#selectedDateTitle'),
  selectedDateHint: document.querySelector('#selectedDateHint'),
  taskStatusBadge: document.querySelector('#taskStatusBadge'),
  taskForm: document.querySelector('#taskForm'),
  taskId: document.querySelector('#taskId'),
  taskTitle: document.querySelector('#taskTitle'),
  taskNote: document.querySelector('#taskNote'),
  taskStart: document.querySelector('#taskStart'),
  taskDuration: document.querySelector('#taskDuration'),
  taskPoints: document.querySelector('#taskPoints'),
  taskCompleted: document.querySelector('#taskCompleted'),
  completeTodayBtn: document.querySelector('#completeTodayBtn'),
  deleteTaskBtn: document.querySelector('#deleteTaskBtn'),
  pushFromSelected: document.querySelector('#pushFromSelected'),
  pullFromSelected: document.querySelector('#pullFromSelected'),
  monthStatsLabel: document.querySelector('#monthStatsLabel'),
  totalPoints: document.querySelector('#totalPoints'),
  monthPoints: document.querySelector('#monthPoints'),
  todayPoints: document.querySelector('#todayPoints'),
  statsBars: document.querySelector('#statsBars'),
  toast: document.querySelector('#toast')
};

const today = stripTime(new Date());
let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved);
  }

  const base = toISO(today);
  return {
    viewYear: today.getFullYear(),
    viewMonth: today.getMonth(),
    selectedDate: base,
    singleThread: true,
    tasks: [
      {
        id: crypto.randomUUID(),
        title: '整理本周工作计划',
        note: '明确每天只推进一个重点任务。',
        start: base,
        duration: 1,
        points: 20,
        completed: false,
        completedDate: null
      },
      {
        id: crypto.randomUUID(),
        title: '完成项目复盘文档',
        note: '写清楚问题、收益和后续行动。',
        start: toISO(addDays(today, 1)),
        duration: 2,
        points: 45,
        completed: false,
        completedDate: null
      }
    ]
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function taskEnd(task) {
  return addDays(parseISO(task.start), task.duration - 1);
}

function isTaskOnDate(task, iso) {
  const date = parseISO(iso);
  return date >= parseISO(task.start) && date <= taskEnd(task);
}

function getTasksOnDate(iso) {
  return state.tasks
    .filter((task) => isTaskOnDate(task, iso))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function shiftTask(task, days) {
  task.start = toISO(addDays(parseISO(task.start), days));
}

function shiftTasksFrom(dateISO, days, exceptId = null) {
  const anchor = parseISO(dateISO);
  state.tasks.forEach((task) => {
    if (task.id !== exceptId && parseISO(task.start) >= anchor) {
      shiftTask(task, days);
    }
  });
}

function shiftBlockingTasks(dateISO, days, exceptId = null) {
  const anchor = parseISO(dateISO);
  state.tasks.forEach((task) => {
    if (task.id !== exceptId && taskEnd(task) >= anchor) {
      shiftTask(task, days);
    }
  });
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortTasks() {
  state.tasks.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

function render() {
  saveState();
  sortTasks();
  renderMonths();
  renderCalendar();
  renderSelectedDay();
  renderStats();
}

function renderMonths() {
  els.yearLabel.textContent = state.viewYear;
  els.monthList.innerHTML = '';
  for (let index = 0; index < 12; index += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `month-pill${index === state.viewMonth ? ' active' : ''}`;
    button.textContent = `${index + 1}月`;
    button.addEventListener('click', () => {
      state.viewMonth = index;
      state.selectedDate = toISO(new Date(state.viewYear, index, 1));
      render();
    });
    els.monthList.append(button);
  }
  els.singleThreadToggle.checked = state.singleThread;
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
    const completedPoints = tasks
      .filter((task) => task.completed && task.completedDate === iso)
      .reduce((sum, task) => sum + task.points, 0);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day-cell';
    if (date.getMonth() !== state.viewMonth) cell.classList.add('outside');
    if (iso === state.selectedDate) cell.classList.add('selected');
    if (iso === toISO(today)) cell.classList.add('today');
    cell.addEventListener('click', () => {
      state.selectedDate = iso;
      if (date.getMonth() !== state.viewMonth) {
        state.viewYear = date.getFullYear();
        state.viewMonth = date.getMonth();
      }
      render();
    });

    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML = `<span class="day-number">${date.getDate()}</span><span class="day-points">${completedPoints ? `+${completedPoints}` : ''}</span>`;
    cell.append(head);

    tasks.slice(0, state.singleThread ? 1 : 2).forEach((task) => {
      const chip = document.createElement('div');
      chip.className = `task-chip${task.completed ? ' completed' : ''}`;
      const dayIndex = diffDays(date, parseISO(task.start)) + 1;
      chip.innerHTML = `
        <span class="check">${task.completed ? '✓' : ''}</span>
        <span class="title">${escapeHTML(task.title)}</span>
        <span class="duration">${dayIndex}/${task.duration}</span>
      `;
      cell.append(chip);
    });

    if (tasks.length > (state.singleThread ? 1 : 2)) {
      const more = document.createElement('div');
      more.className = 'task-chip';
      more.innerHTML = `<span></span><span class="title">还有 ${tasks.length - 1} 个任务</span><span></span>`;
      cell.append(more);
    }

    if (tasks.length > 0) {
      const mark = document.createElement('div');
      mark.className = 'thread-mark';
      cell.append(mark);
    }

    els.calendarGrid.append(cell);
  }
}

function renderSelectedDay() {
  const date = parseISO(state.selectedDate);
  const activeTask = getTasksOnDate(state.selectedDate)[0];
  els.selectedDateTitle.textContent = `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
  els.selectedDateHint.textContent = activeTask ? `当前任务：${activeTask.title}` : '当天还没有安排任务';
  fillTaskForm(activeTask);
}

function fillTaskForm(task) {
  if (!task) {
    els.taskId.value = '';
    els.taskTitle.value = '';
    els.taskNote.value = '';
    els.taskStart.value = state.selectedDate;
    els.taskDuration.value = 1;
    els.taskPoints.value = 10;
    els.taskCompleted.value = 'false';
    els.taskStatusBadge.textContent = '未安排';
    els.deleteTaskBtn.disabled = true;
    els.completeTodayBtn.disabled = true;
    return;
  }

  els.taskId.value = task.id;
  els.taskTitle.value = task.title;
  els.taskNote.value = task.note || '';
  els.taskStart.value = task.start;
  els.taskDuration.value = task.duration;
  els.taskPoints.value = task.points;
  els.taskCompleted.value = String(task.completed);
  els.taskStatusBadge.textContent = task.completed ? '已完成' : '进行中';
  els.deleteTaskBtn.disabled = false;
  els.completeTodayBtn.disabled = task.completed;
}

function renderStats() {
  els.monthStatsLabel.textContent = `${state.viewMonth + 1}月`;
  const currentMonth = `${state.viewYear}-${String(state.viewMonth + 1).padStart(2, '0')}`;
  const completed = state.tasks.filter((task) => task.completed && task.completedDate);
  const total = completed.reduce((sum, task) => sum + task.points, 0);
  const month = completed
    .filter((task) => task.completedDate.startsWith(currentMonth))
    .reduce((sum, task) => sum + task.points, 0);
  const day = completed
    .filter((task) => task.completedDate === state.selectedDate)
    .reduce((sum, task) => sum + task.points, 0);

  els.totalPoints.textContent = total;
  els.monthPoints.textContent = month;
  els.todayPoints.textContent = day;

  const days = Array.from({ length: 7 }, (_, index) => addDays(parseISO(state.selectedDate), index - 3));
  const values = days.map((date) => {
    const iso = toISO(date);
    return completed
      .filter((task) => task.completedDate === iso)
      .reduce((sum, task) => sum + task.points, 0);
  });
  const max = Math.max(...values, 1);

  els.statsBars.innerHTML = '';
  days.forEach((date, index) => {
    const item = document.createElement('div');
    item.className = 'bar';
    item.title = `${toISO(date)}：${values[index]}分`;
    item.innerHTML = `
      <div class="bar-fill" style="height:${Math.max(6, (values[index] / max) * 72)}px"></div>
      <span>${date.getDate()}</span>
    `;
    els.statsBars.append(item);
  });
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function upsertTask(event) {
  event.preventDefault();
  const id = els.taskId.value || crypto.randomUUID();
  const oldTask = state.tasks.find((task) => task.id === id);
  const start = els.taskStart.value;
  const duration = Math.max(1, normalizeNumber(els.taskDuration.value, 1));
  const completed = els.taskCompleted.value === 'true';
  const task = {
    id,
    title: els.taskTitle.value.trim(),
    note: els.taskNote.value.trim(),
    start,
    duration,
    points: Math.max(0, normalizeNumber(els.taskPoints.value, 0)),
    completed,
    completedDate: completed ? oldTask?.completedDate || state.selectedDate : null
  };

  if (!task.title) {
    showToast('请先填写任务名称');
    return;
  }

  if (!oldTask && state.singleThread) {
    shiftBlockingTasks(task.start, task.duration);
    showToast(`已插入任务，后续任务顺延 ${task.duration} 天`);
  }

  if (oldTask) {
    Object.assign(oldTask, task);
  } else {
    state.tasks.push(task);
  }

  state.selectedDate = task.start;
  state.viewYear = parseISO(task.start).getFullYear();
  state.viewMonth = parseISO(task.start).getMonth();
  render();
}

function completeSelectedTask() {
  const task = state.tasks.find((item) => item.id === els.taskId.value);
  if (!task) return;

  const selected = parseISO(state.selectedDate);
  const end = taskEnd(task);
  const releasedDays = Math.max(0, diffDays(end, selected));
  task.completed = true;
  task.completedDate = state.selectedDate;
  task.duration = Math.max(1, diffDays(selected, parseISO(task.start)) + 1);

  if (state.singleThread && releasedDays > 0) {
    shiftTasksFrom(toISO(addDays(selected, 1)), -releasedDays, task.id);
    showToast(`任务已提前完成，后续任务前移 ${releasedDays} 天`);
  } else {
    showToast('任务已完成，积分已记录');
  }
  render();
}

function deleteSelectedTask() {
  const id = els.taskId.value;
  if (!id) return;
  state.tasks = state.tasks.filter((task) => task.id !== id);
  showToast('任务已删除');
  render();
}

function newTask() {
  els.taskId.value = '';
  els.taskTitle.value = '';
  els.taskNote.value = '';
  els.taskStart.value = state.selectedDate;
  els.taskDuration.value = 1;
  els.taskPoints.value = 10;
  els.taskCompleted.value = 'false';
  els.taskTitle.focus();
  els.taskStatusBadge.textContent = '新任务';
  els.deleteTaskBtn.disabled = true;
  els.completeTodayBtn.disabled = true;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

els.prevYear.addEventListener('click', () => {
  state.viewYear -= 1;
  render();
});

els.nextYear.addEventListener('click', () => {
  state.viewYear += 1;
  render();
});

els.singleThreadToggle.addEventListener('change', () => {
  state.singleThread = els.singleThreadToggle.checked;
  render();
});

els.todayBtn.addEventListener('click', () => {
  state.selectedDate = toISO(today);
  state.viewYear = today.getFullYear();
  state.viewMonth = today.getMonth();
  render();
});

els.newTaskBtn.addEventListener('click', newTask);
els.taskForm.addEventListener('submit', upsertTask);
els.completeTodayBtn.addEventListener('click', completeSelectedTask);
els.deleteTaskBtn.addEventListener('click', deleteSelectedTask);

els.shiftBack.addEventListener('click', () => {
  state.tasks.forEach((task) => shiftTask(task, -1));
  showToast('整体任务线已前移一天');
  render();
});

els.shiftForward.addEventListener('click', () => {
  state.tasks.forEach((task) => shiftTask(task, 1));
  showToast('整体任务线已后移一天');
  render();
});

els.pushFromSelected.addEventListener('click', () => {
  shiftTasksFrom(state.selectedDate, 1);
  showToast('选中日期后的任务已顺延一天');
  render();
});

els.pullFromSelected.addEventListener('click', () => {
  shiftTasksFrom(state.selectedDate, -1);
  showToast('选中日期后的任务已前移一天');
  render();
});

render();
