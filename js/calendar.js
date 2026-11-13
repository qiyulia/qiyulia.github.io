/* 日历应用：待办、经期、排卵期标记与次月预测（全部本机保存） */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };

  const cursor = new Date();
  cursor.setDate(1);

  function keyOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function shiftKey(key, days) {
    const parts = key.split('-').map(Number);
    return keyOf(new Date(parts[0], parts[1] - 1, parts[2] + days));
  }

  function shortDate(key) {
    const parts = key.split('-').map(Number);
    return parts[1] + '月' + parts[2] + '日';
  }

  let selected = keyOf(new Date());
  let cycleVisible = false;
  let hasPickedDay = false;

  function dayData(key) {
    return (App.state.calendar && App.state.calendar[key]) || null;
  }

  /* 连续经期只取第一天；有多个周期时使用近几次的平均间隔，否则按 28 天估算。 */
  function predictions() {
    const calendar = App.state.calendar || {};
    const periodDays = Object.keys(calendar).filter(function (key) {
      return calendar[key] && calendar[key].period;
    }).sort();
    const starts = periodDays.filter(function (key) {
      const previous = dayData(shiftKey(key, -1));
      return !(previous && previous.period);
    });
    const ovulationDays = Object.keys(calendar).filter(function (key) {
      return calendar[key] && calendar[key].ovulation;
    }).sort();

    let cycle = 28;
    if (starts.length > 1) {
      const recent = starts.slice(-4);
      const intervals = [];
      for (let i = 1; i < recent.length; i++) {
        const from = new Date(recent[i - 1] + 'T00:00:00');
        const to = new Date(recent[i] + 'T00:00:00');
        intervals.push(Math.round((to - from) / 86400000));
      }
      if (intervals.length) {
        cycle = Math.round(intervals.reduce(function (sum, n) { return sum + n; }, 0) / intervals.length);
        cycle = Math.max(21, Math.min(35, cycle));
      }
    }

    const today = keyOf(new Date());
    let period = '';
    let ovulation = '';
    if (starts.length) {
      period = shiftKey(starts[starts.length - 1], cycle);
      while (period < today) period = shiftKey(period, cycle);
      ovulation = shiftKey(period, -14);
    } else if (ovulationDays.length) {
      ovulation = shiftKey(ovulationDays[ovulationDays.length - 1], cycle);
      while (ovulation < today) ovulation = shiftKey(ovulation, cycle);
    }
    return { period: period, ovulation: ovulation, cycle: cycle };
  }

  // 桌面小组件与日历共用实际记录和预测颜色。
  App.calendarDayClass = function (key) {
    const d = dayData(key) || {};
    const predicted = predictions();
    const cls = [];
    if (d.period) cls.push('cal-period');
    else if (key === predicted.period) cls.push('cal-period-predicted');
    if (d.ovulation) cls.push('cal-ovulation');
    else if (key === predicted.ovulation) cls.push('cal-ovulation-predicted');
    if (d.todo && d.todo.trim()) cls.push('cal-has-todo');
    return cls.join(' ');
  };

  function renderGrid() {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    el('#cal-title').textContent = year + '年' + (month + 1) + '月';

    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const todayKey = keyOf(new Date());

    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<span class="cal-cell is-outside"></span>';
    for (let day = 1; day <= total; day++) {
      const key = keyOf(new Date(year, month, day));
      const cls = ['cal-cell'];
      const extra = App.calendarDayClass(key);
      if (extra) cls.push(extra);
      if (key === todayKey) cls.push('is-today');
      if (key === selected) cls.push('is-selected');
      html += '<button type="button" class="' + cls.join(' ') + '" data-cal-day="' + key + '">' + day + '</button>';
    }
    el('#cal-grid').innerHTML = html;
  }

  function renderSelected() {
    el('#cal-selected-title').textContent = selected.split('-').join(' / ');
    const d = dayData(selected) || {};
    const todo = d.todo || '';
    if (el('#cal-todo').value !== todo) el('#cal-todo').value = todo;
    el('#cal-cycle-panel').hidden = !cycleVisible;
    el('#cal-mark-period').classList.toggle('is-on', !!d.period);
    el('#cal-mark-ovulation').classList.toggle('is-on', !!d.ovulation);
    el('#cal-mark-period').textContent = d.period ? '取消经期' : '标记经期';
    el('#cal-mark-ovulation').textContent = d.ovulation ? '取消排卵期' : '标记排卵期';
  }

  function renderPrediction() {
    const predicted = predictions();
    const parts = [];
    if (predicted.period) parts.push('经期 ' + shortDate(predicted.period));
    if (predicted.ovulation) parts.push('排卵期 ' + shortDate(predicted.ovulation));
    el('#cal-prediction').textContent = parts.length
      ? '下次预计：' + parts.join(' · ') + '（按 ' + predicted.cycle + ' 天周期估算，仅供参考）'
      : '记录经期或排卵期后，会自动估算下次日期。';
  }

  App.renderCalendarApp = function () {
    cycleVisible = false;
    hasPickedDay = false;
    renderGrid();
    renderSelected();
    renderPrediction();
  };

  function mutate(fn) {
    const data = Object.assign({ todo: '', period: false, ovulation: false }, dayData(selected) || {});
    fn(data);
    if (!data.todo && !data.period && !data.ovulation) {
      delete App.state.calendar[selected];
    } else {
      App.state.calendar[selected] = data;
    }
    App.save();
    renderGrid();
    renderSelected();
    renderPrediction();
  }

  App.initCalendar = function () {
    el('#cal-prev').addEventListener('click', function () {
      cursor.setMonth(cursor.getMonth() - 1);
      cycleVisible = false;
      hasPickedDay = false;
      renderGrid();
      renderSelected();
    });
    el('#cal-next').addEventListener('click', function () {
      cursor.setMonth(cursor.getMonth() + 1);
      cycleVisible = false;
      hasPickedDay = false;
      renderGrid();
      renderSelected();
    });

    el('#cal-grid').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cal-day]');
      if (!btn) return;
      const key = btn.dataset.calDay;
      if (selected === key && hasPickedDay) {
        cycleVisible = true;
      } else {
        selected = key;
        cycleVisible = false;
      }
      hasPickedDay = true;
      renderGrid();
      renderSelected();
    });

    el('#cal-todo').addEventListener('input', function (e) {
      const value = e.target.value;
      mutate(function (d) { d.todo = value; });
    });

    el('#cal-mark-period').addEventListener('click', function () {
      mutate(function (d) { d.period = !d.period; });
    });
    el('#cal-mark-ovulation').addEventListener('click', function () {
      mutate(function (d) { d.ovulation = !d.ovulation; });
    });
  };
})();
