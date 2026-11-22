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

  /* 每种类型只记「最近一次连记 5 天」的撤销批次。
     added 只存这次真正从无到有的日子：一键取消时只删这些，
     之前已有的记录（哪怕正好落在这 5 天里）一律保留。 */
  function undoStore() {
    if (!App.state.calendarUndo || typeof App.state.calendarUndo !== 'object') App.state.calendarUndo = {};
    return App.state.calendarUndo;
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
    /* 只看选中的这一天：有记录就变成「取消」，按钮染上经期粉 / 排卵期蓝。
       不再要求连续 5 天全部标记，这样提前结束时能单独关掉其中某一天。 */
    const d = cal[selected] || {};
    const periodMarked = !!d.period;
    const ovulationMarked = !!d.ovulation;
    el('#cal-mark-period').textContent = periodMarked ? '取消经期' : '记录经期';
    el('#cal-mark-ovulation').textContent = ovulationMarked ? '取消排卵期' : '记录排卵期';
    el('#cal-mark-period').classList.toggle('is-marked', periodMarked);
    el('#cal-mark-ovulation').classList.toggle('is-marked', ovulationMarked);
    el('#cal-cycle-title').textContent = fromKey(selected).getMonth() + 1 + '月' + fromKey(selected).getDate() + '日';
    el('#cal-cycle-range').textContent = '选中 ' + selected.replace(/-/g, '.') +
      '：点「记录」从这天起连记 5 天；点「取消」只关掉这一天。';
  }

  function renderUndoBar() {
    const u = undoStore();
    const bar = el('#cal-undo-bar');
    const note = el('#cal-undo-note');
    const show = function (node, batch, label) {
      if (!batch || !batch.added || !batch.added.length || !batch.days || !batch.days.length) {
        node.hidden = true;
        return false;
      }
      node.textContent = '一键取消本次' + label + ' · ' + fmtRange(batch.start, batch.days[batch.days.length - 1]);
      node.hidden = false;
      return true;
    };
    const a = show(el('#cal-undo-period'), u.period, '经期');
    const b = show(el('#cal-undo-ovulation'), u.ovulation, '排卵期');
    bar.hidden = !(a || b);
    if (note) note.textContent = '一键取消只清掉最近一次新建时新加的那几天，更早的记录、已单独关掉的日子都不受影响。';
  }

  function undoBatch(type) {
    const u = undoStore();
    const batch = u[type];
    if (!batch || !batch.added || !batch.added.length) return;
    const cal = calendar();
    let removed = 0;
    batch.added.forEach(function (key) {
      const d = cal[key];
      if (!d || !d[type]) return;
      delete d[type];
      if (!d.todo && !d.period && !d.ovulation) delete cal[key];
      else cal[key] = d;
      removed++;
    });
    delete u[type];
    App.save();
    closeCyclePanel();
    render();
    if (App.renderDesktop) App.renderDesktop();
    App.toast('已取消本次新建的' + (type === 'period' ? '经期' : '排卵期') +
      ' ' + removed + ' 天，原有记录保留');
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
    renderUndoBar();

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
    const label = type === 'period' ? '经期' : '排卵期';
    const current = cal[selected] || {};

    if (current[type]) {
      /* 提前结束：只关掉选中的这一天，前后几天保持原样，也不往后补。
         按钮已经变成「取消」，不用先添加新记录才能关。 */
      const d = cal[selected] || {};
      delete d[type];
      if (!d.todo && !d.period && !d.ovulation) delete cal[selected];
      else cal[selected] = d;
      App.save();
      closeCyclePanel();
      render();
      if (App.renderDesktop) App.renderDesktop();
      App.toast('已取消 ' + selected.replace(/-/g, '.') + ' 的' + label);
      return;
    }

    /* 未记录：沿用原来的「从这天起连续 5 天」。
       同时存一份撤销批次，只记这次真正新加的日子，供一键取消使用。 */
    const days = rangeDays(selected, CYCLE_DAYS);
    const added = [];
    days.forEach(function (key) {
      const d = cal[key] || {};
      if (!d[type]) added.push(key);
      d[type] = true;
      if (!d.todo && !d.period && !d.ovulation) delete cal[key];
      else cal[key] = d;
    });
    if (added.length) {
      undoStore()[type] = { start: selected, days: days.slice(), added: added, at: Date.now() };
    }
    App.save();
    closeCyclePanel();
    render();
    if (App.renderDesktop) App.renderDesktop();
    App.toast(label + '已记录连续 5 天');
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
    el('#cal-undo-period').addEventListener('click', function () { undoBatch('period'); });
    el('#cal-undo-ovulation').addEventListener('click', function () { undoBatch('ovulation'); });
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
