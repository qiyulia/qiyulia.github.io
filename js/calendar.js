/* 日历：待办、连续经期/排卵期记录与预测 */
(function () {
  const App = window.App;
  const el = function (sel) { return document.querySelector(sel); };
  const CYCLE_DAYS = 5;

  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = keyOf(today);

  function keyOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fromKey(key) {
    const p = key.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function addDays(key, n) {
    const d = fromKey(key);
    d.setDate(d.getDate() + n);
    return keyOf(d);
  }

  function rangeDays(start, count) {
    const days = [];
    for (let i = 0; i < count; i++) days.push(addDays(start, i));
    return days;
  }

  function calendar() {
    if (!App.state.calendar || typeof App.state.calendar !== 'object') App.state.calendar = {};
    return App.state.calendar;
  }

  function closeCyclePanel() {
    const panel = el('#cal-cycle-dialog');
    if (panel.open) panel.close();
    panel.hidden = true;
  }

  function openCyclePanel() {
    const panel = el('#cal-cycle-dialog');
    renderMarkState();
    panel.hidden = false;
    if (!panel.open) panel.showModal();
  }

  function groupStarts(type) {
    const cal = calendar();
    const days = Object.keys(cal).filter(function (key) {
      return cal[key] && cal[key][type];
    }).sort();
    const starts = [];
    let previous = null;
    days.forEach(function (key) {
      if (!previous || addDays(previous, 1) !== key) starts.push(key);
      previous = key;
    });
    return starts;
  }

  function predictions() {
    const periodStarts = groupStarts('period').sort();
    const ovulationStarts = groupStarts('ovulation').sort();
    const lastPeriod = periodStarts.length ? periodStarts[periodStarts.length - 1] : null;
    const lastOvulation = ovulationStarts.length ? ovulationStarts[ovulationStarts.length - 1] : null;
    let cycle = 28;

    if (periodStarts.length > 1) {
      const gaps = [];
      for (let i = 1; i < periodStarts.length; i++) {
        const gap = Math.round((fromKey(periodStarts[i]) - fromKey(periodStarts[i - 1])) / 86400000);
        if (gap >= 21 && gap <= 35) gaps.push(gap);
      }
      if (gaps.length) {
        const recent = gaps.slice(-4);
        cycle = Math.round(recent.reduce(function (a, b) { return a + b; }, 0) / recent.length);
      }
    }

    const fallback = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const periodStart = lastPeriod ? addDays(lastPeriod, cycle) : keyOf(new Date(fallback.getFullYear(), fallback.getMonth(), 10));
    const ovulationStart = lastPeriod
      ? addDays(periodStart, -14)
      : (lastOvulation ? addDays(lastOvulation, cycle) : keyOf(new Date(fallback.getFullYear(), fallback.getMonth(), 12)));

    return {
      period: rangeDays(periodStart, CYCLE_DAYS),
      ovulation: rangeDays(ovulationStart, CYCLE_DAYS),
      periodStart: periodStart,
      ovulationStart: ovulationStart,
      cycle: cycle,
    };
  }

  /* 首页经期小窗用：正在经期返回第几天，否则返回下一次经期的开始日期 */
  App.periodBrief = function () {
    const cal = calendar();
    const todayKey = keyOf(new Date());
    if (cal[todayKey] && cal[todayKey].period) {
      let day = 1;
      let key = todayKey;
      while (day < 15) {
        key = addDays(key, -1);
        if (!(cal[key] && cal[key].period)) break;
        day++;
      }
      return { inPeriod: true, day: day };
    }
    const periodStarts = groupStarts('period').sort();
    if (!periodStarts.length) return null;
    const pred = predictions();
    let start = pred.periodStart;
    /* 上次预测的经期已经过去时，按周期往后推到下一次 */
    let guard = 0;
    while (start < todayKey && guard < 24) {
      start = addDays(start, pred.cycle);
      guard++;
    }
    const days = Math.round((fromKey(start) - fromKey(todayKey)) / 86400000);
    return { inPeriod: false, start: start, days: days };
  };

  App.calendarDayClass = function (key) {
    const d = calendar()[key];
    const predicted = predictions();
    const cls = [];
    if (d && d.period) cls.push('cal-period');
    else if (predicted.period.indexOf(key) >= 0) cls.push('cal-period-predicted');
    if (d && d.ovulation) cls.push('cal-ovulation');
    else if (predicted.ovulation.indexOf(key) >= 0) cls.push('cal-ovulation-predicted');
    if (d && d.todo) cls.push('cal-has-todo');
    return cls.join(' ');
  };

  function fmtRange(start, end) {
    const a = fromKey(start);
    const b = fromKey(end);
    const left = (a.getMonth() + 1) + '月' + a.getDate() + '日';
    const right = a.getMonth() === b.getMonth()
      ? b.getDate() + '日'
      : (b.getMonth() + 1) + '月' + b.getDate() + '日';
    return left + '–' + right;
  }

  function renderMarkState() {
    const cal = calendar();
    const days = rangeDays(selected, CYCLE_DAYS);
    const periodMarked = days.every(function (key) { return cal[key] && cal[key].period; });
    const ovulationMarked = days.every(function (key) { return cal[key] && cal[key].ovulation; });
    el('#cal-mark-period').textContent = periodMarked ? '取消经期' : '记录经期';
    el('#cal-mark-ovulation').textContent = ovulationMarked ? '取消排卵期' : '记录排卵期';
    el('#cal-mark-period').classList.toggle('is-marked', periodMarked);
    el('#cal-mark-ovulation').classList.toggle('is-marked', ovulationMarked);
    el('#cal-cycle-title').textContent = fromKey(selected).getMonth() + 1 + '月' + fromKey(selected).getDate() + '日';
    el('#cal-cycle-range').textContent = '从 ' + selected.replace(/-/g, '.') + ' 开始，连续记录或取消 5 天。';
  }

  function render() {
    closeCyclePanel();
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    el('#cal-title').textContent = year + '年' + (month + 1) + '月';
    const cal = calendar();

    el('#cal-selected-title').textContent = '已选 ' + selected.replace(/-/g, '.');
    el('#cal-todo').value = (cal[selected] && cal[selected].todo) || '';
    renderMarkState();

    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < firstDay; i++) html += '<span class="cal-day is-outside"></span>';
    for (let day = 1; day <= total; day++) {
      const key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      const cls = ['cal-day'];
      if (key === keyOf(new Date())) cls.push('is-today');
      if (key === selected) cls.push('is-selected');
      const extra = App.calendarDayClass(key);
      if (extra) cls.push(extra);
      html += '<button type="button" class="' + cls.join(' ') + '" data-day="' + key + '">' + day + '</button>';
    }
    el('#cal-grid').innerHTML = html;

    const p = predictions();
    el('#cal-prediction').textContent = '下次预计：经期 ' + fmtRange(p.periodStart, p.period[p.period.length - 1]) +
      ' · 排卵期 ' + fmtRange(p.ovulationStart, p.ovulation[p.ovulation.length - 1]) +
      '（每次连续 5 天，按 ' + p.cycle + ' 天周期估算，仅供参考）';
  }

  function toggleRange(type) {
    const cal = calendar();
    const days = rangeDays(selected, CYCLE_DAYS);
    const shouldMark = !days.every(function (key) { return cal[key] && cal[key][type]; });
    days.forEach(function (key) {
      const d = cal[key] || {};
      d[type] = shouldMark;
      if (!d.todo && !d.period && !d.ovulation) delete cal[key];
      else cal[key] = d;
    });
    App.save();
    closeCyclePanel();
    render();
    if (App.renderDesktop) App.renderDesktop();
    App.toast((type === 'period' ? '经期' : '排卵期') + (shouldMark ? '已记录连续 5 天' : '已取消连续 5 天'));
  }

  App.renderCalendar = function () {
    render();
  };

  App.initCalendar = function () {
    el('#cal-prev').addEventListener('click', function () {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      render();
    });
    el('#cal-next').addEventListener('click', function () {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      render();
    });

    el('#cal-grid').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-day]');
      if (!btn) return;
      selected = btn.dataset.day;
      render();
      openCyclePanel();
    });

    el('#cal-mark-period').addEventListener('click', function () { toggleRange('period'); });
    el('#cal-mark-ovulation').addEventListener('click', function () { toggleRange('ovulation'); });
    el('#cal-cycle-dialog [data-close]').addEventListener('click', closeCyclePanel);
    el('#cal-cycle-dialog').addEventListener('cancel', function (e) {
      e.preventDefault();
      closeCyclePanel();
    });
    el('#cal-cycle-dialog').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeCyclePanel();
    });

    el('#cal-todo').addEventListener('input', function (e) {
      const cal = calendar();
      const d = cal[selected] || {};
      d.todo = e.target.value;
      if (!d.todo && !d.period && !d.ovulation) delete cal[selected];
      else cal[selected] = d;
      App.save();
      const btn = el('[data-day="' + selected + '"]');
      if (btn) btn.classList.toggle('cal-has-todo', !!d.todo);
      if (App.renderDesktop) App.renderDesktop();
    });

    render();
  };
})();
