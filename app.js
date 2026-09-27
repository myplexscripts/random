(function () {
  'use strict';

  var form = document.getElementById('severanceForm');
  var results = document.getElementById('results');
  var terminationWeeks = document.getElementById('terminationWeeks');
  var severanceWeeks = document.getElementById('severanceWeeks');
  var terminationAverage = document.getElementById('terminationAverage');
  var severanceAverage = document.getElementById('severanceAverage');
  var massDetails = document.getElementById('massDetails');

  function money(value) {
    var amount = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  }

  function numberValue(id) {
    var raw = document.getElementById(id).value;
    return raw === '' ? 0 : Math.max(0, Number(raw) || 0);
  }

  function selected(name) {
    var item = document.querySelector('input[name="' + name + '"]:checked');
    return item ? item.value : '';
  }

  function parseDate(value) {
    if (!value) return null;
    var parts = value.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function formatDate(date) {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function dateInputValue(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function addDays(date, days) {
    var next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }

  function daysBetween(start, end) {
    if (!start || !end || end <= start) return 0;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  }

  function fullMonthsBetween(start, end) {
    if (!start || !end || end < start) return 0;
    var months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) months -= 1;
    return Math.max(0, months);
  }

  function individualNoticeWeeks(months) {
    if (months < 3) return 0;
    if (months < 12) return 1;
    var years = Math.floor(months / 12);
    if (years < 3) return 2;
    if (years < 4) return 3;
    if (years < 5) return 4;
    if (years < 6) return 5;
    if (years < 7) return 6;
    if (years < 8) return 7;
    return 8;
  }

  function createWeekRows(container, prefix) {
    var rows = '';
    for (var i = 1; i <= 12; i += 1) {
      rows += '<div class="week-row">' +
        '<label for="' + prefix + i + '">Week ' + i +
        '<small id="' + prefix + 'Label' + i + '">Worked week</small></label>' +
        '<input id="' + prefix + i + '" class="' + prefix + '-entry" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="Week ' + i + '">' +
        '</div>';
    }
    container.innerHTML = rows;
  }

  createWeekRows(terminationWeeks, 'termWeek');
  createWeekRows(severanceWeeks, 'sevWeek');

  function updateWeekLabels(prefix, referenceDate, mode) {
    var unit = mode === 'hours' ? 'hours' : 'regular wages';
    for (var i = 1; i <= 12; i += 1) {
      var label = document.getElementById(prefix + 'Label' + i);
      var input = document.getElementById(prefix + i);
      input.placeholder = mode === 'hours' ? '0' : '0.00';
      input.step = mode === 'hours' ? '0.25' : '0.01';
      if (referenceDate) {
        var end = addDays(referenceDate, -7 * (i - 1) - 1);
        var start = addDays(end, -6);
        label.textContent = formatDate(start) + ' to ' + formatDate(end) + ' · ' + unit;
      } else {
        label.textContent = unit;
      }
    }
  }

  function averageFromWeeks(prefix, mode) {
    var rate = numberValue('hourlyRate');
    var values = [];
    for (var i = 1; i <= 12; i += 1) {
      var value = numberValue(prefix + i);
      if (value > 0) values.push(value);
    }
    if (!values.length) return { average: 0, count: 0, rawAverage: 0 };
    var rawAverage = values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
    return {
      average: mode === 'hours' ? rawAverage * rate : rawAverage,
      count: values.length,
      rawAverage: rawAverage
    };
  }

  function updateAverages() {
    var t = averageFromWeeks('termWeek', selected('terminationMode'));
    var s = averageFromWeeks('sevWeek', selected('severanceMode'));
    terminationAverage.textContent = money(t.average);
    severanceAverage.textContent = money(s.average);
  }

  function updateReferencePeriods() {
    var terminationDate = parseDate(document.getElementById('terminationDate').value);
    var noticeDate = parseDate(document.getElementById('noticeDate').value);
    var terminationReference = noticeDate || terminationDate;
    var severanceReference = terminationDate;

    document.getElementById('terminationReferenceLabel').textContent = terminationReference
      ? '12 weeks before ' + formatDate(terminationReference)
      : 'Reference period';

    document.getElementById('severanceReferenceLabel').textContent = severanceReference
      ? '12 weeks before ' + formatDate(severanceReference)
      : 'Reference period';

    updateWeekLabels('termWeek', terminationReference, selected('terminationMode'));
    updateWeekLabels('sevWeek', severanceReference, selected('severanceMode'));
  }

  function updateMassVisibility() {
    massDetails.classList.toggle('hidden', selected('mass') !== 'yes');
  }

  function setRadio(name, value) {
    var item = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (item) item.checked = true;
  }

  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }

  function offerTotal() {
    return [
      'offerTermination',
      'offerTerminationVacation',
      'offerSeverance',
      'offerVacation',
      'offerWages',
      'offerEnhanced',
      'offerOther'
    ].reduce(function (sum, id) { return sum + numberValue(id); }, 0);
  }

  function addFlag(list, type, title, body) {
    list.push('<div class="flag ' + type + '"><strong>' + title + '</strong>' + body + '</div>');
  }

  function buildChecklist() {
    var items = [
      'Full and Final Release',
      'Signing deadline',
      'Termination pay',
      'ESA severance pay',
      'Vacation payout',
      'Benefits end date',
      'RRSP / DPSP treatment',
      'Bean Stock or equity treatment',
      'Rehire language',
      'Confidentiality',
      'Non-disparagement',
      'Record of Employment information',
      'Legal-fee reimbursement'
    ];
    return items.map(function (item) {
      return '<div class="check-item"><span class="check-box" aria-hidden="true"></span><span>' + item + '</span></div>';
    }).join('');
  }

  function calculate(event) {
    if (event) event.preventDefault();

    var employer = document.getElementById('employer').value;
    var hireDate = parseDate(document.getElementById('hireDate').value);
    var terminationDate = parseDate(document.getElementById('terminationDate').value);
    var noticeDate = parseDate(document.getElementById('noticeDate').value);
    var transfer = selected('transfer');
    var mass = selected('mass');
    var massWeeks = mass === 'yes' ? Number(document.getElementById('massCount').value || 0) : 0;
    var release = selected('release');
    var benefits = selected('benefits');

    if (!hireDate || !terminationDate || terminationDate < hireDate) {
      window.alert('Enter a valid Starbucks hire date and termination date.');
      return;
    }

    if (noticeDate && (noticeDate > terminationDate || noticeDate < hireDate)) {
      window.alert('The written notice date must fall between the hire date and termination date.');
      return;
    }

    var terminationAvg = averageFromWeeks('termWeek', selected('terminationMode'));
    var severanceAvg = averageFromWeeks('sevWeek', selected('severanceMode'));

    if (!terminationAvg.count) {
      window.alert('Enter at least one worked week for the termination-pay reference period.');
      return;
    }

    var employmentMonths = fullMonthsBetween(hireDate, terminationDate);
    var individualWeeks = individualNoticeWeeks(employmentMonths);
    var requiredNoticeWeeks = massWeeks || individualWeeks;

    var workingNoticeDays = noticeDate ? daysBetween(noticeDate, terminationDate) : 0;
    var workingNoticeWeeks = workingNoticeDays / 7;
    var missingNoticeWeeks = Math.max(0, requiredNoticeWeeks - workingNoticeWeeks);

    var terminationPay = terminationAvg.average * missingNoticeWeeks;
    var vacationRate = employmentMonths >= 60 ? 0.06 : 0.04;
    var terminationVacation = terminationPay * vacationRate;

    var adjustedServiceEnd = addDays(terminationDate, Math.round(missingNoticeWeeks * 7));
    var adjustedServiceMonths = fullMonthsBetween(hireDate, adjustedServiceEnd);
    var severanceServiceWeeks = Math.min(26, Math.floor(adjustedServiceMonths / 12) + (adjustedServiceMonths % 12) / 12);

    var starbucksCorporate = employer === 'starbucks';
    var severanceThresholdAssumed = starbucksCorporate;
    var severanceEligibleByService = adjustedServiceMonths >= 60;
    var severanceIncluded = severanceEligibleByService && severanceThresholdAssumed;
    var severancePay = severanceIncluded && severanceAvg.count ? severanceAvg.average * severanceServiceWeeks : 0;

    var estimatedFloor = terminationPay + terminationVacation + severancePay;
    var packageTotal = offerTotal();
    var enhanced = numberValue('offerEnhanced');

    setText('estimatedFloor', money(estimatedFloor));
    setText('estimatedFloorDetail', missingNoticeWeeks.toFixed(2) + ' weeks of termination pay, vacation pay on that amount, and ' + (severanceIncluded ? 'estimated ESA severance.' : 'no ESA severance included in this estimate.'));
    setText('starbucksTotal', money(packageTotal));
    setText('enhancedAmount', money(enhanced));
    setText('enhancedDetail', release === 'yes'
      ? 'Your answers indicate the additional payment is tied to a Full and Final Release.'
      : 'Check the paperwork to see whether this amount is conditional on signing.');

    setText('resultTerminationWeekly', money(terminationAvg.average));
    setText('resultNoticeWeeks', requiredNoticeWeeks.toFixed(2).replace('.00', '') + ' weeks');
    setText('resultWorkingNotice', workingNoticeWeeks.toFixed(2).replace('.00', '') + ' weeks');
    setText('resultTerminationPay', money(terminationPay));
    setText('resultTerminationVacation', money(terminationVacation));
    setText('resultSeveranceWeekly', money(severanceAvg.average));
    setText('resultService', (Math.floor(adjustedServiceMonths / 12)) + ' years, ' + (adjustedServiceMonths % 12) + ' months');
    setText('resultSeverancePay', money(severancePay));
    setText('withoutSigning', money(estimatedFloor));
    setText('withSigning', money(packageTotal));
    setText('withSigningNote', release === 'yes'
      ? 'The package indicates at least some additional compensation requires a release. Compare the conditional amount with rights being released.'
      : 'Review the package to identify whether any amount is conditional on signing.');

    var flags = [];

    if (employer === 'licensed') {
      addFlag(flags, 'warn', 'Your employer is not Starbucks Coffee Canada, Inc.', 'This calculator can still illustrate Ontario ESA rules, but do not assume Starbucks-specific package practices or the employer payroll threshold apply.');
    }

    if (employer === 'unknown') {
      addFlag(flags, 'warn', 'Confirm who employs you', 'Look at your pay statement or Record of Employment. A licensed Starbucks may be operated by another employer.');
    }

    if (transfer === 'declined') {
      addFlag(flags, 'danger', 'You declined another position', 'Ontario has exemptions where an employee refuses reasonable alternative employment with the employer. Whether the offer was legally reasonable depends on the facts, so this estimate may not apply as shown.');
    }

    if (transfer === 'accepted') {
      addFlag(flags, 'info', 'You accepted another position', 'A continued employment relationship can change whether a termination or severance entitlement has actually been triggered.');
    }

    if (mass === 'unknown') {
      addFlag(flags, 'warn', 'Mass termination is unclear', 'If many Ontario partners are being terminated, check whether Starbucks provided a Form 1 mass-termination notice. Do not assume the rule applies only because many stores closed.');
    }

    if (mass === 'yes' && !massWeeks) {
      addFlag(flags, 'warn', 'Mass termination selected, but no employee range chosen', 'The calculator used your normal individual notice period because the mass-termination notice period was not confirmed.');
    }

    if (massWeeks) {
      addFlag(flags, 'info', 'Mass-termination notice included', 'The calculation uses ' + massWeeks + ' weeks of statutory notice because you indicated the paperwork confirms Ontario mass-termination rules apply.');

      if (noticeDate && requiredNoticeWeeks > 0 && workingNoticeWeeks > requiredNoticeWeeks * 0.25) {
        addFlag(flags, 'info', 'Job-seeking leave may apply', 'Ontario provides up to three unpaid, job-protected days for eligible employees who receive mass-termination notice and use the leave for job-seeking activities.');
      }
    }

    if (!severanceAvg.count && severanceEligibleByService) {
      addFlag(flags, 'warn', 'Severance-pay average is missing', 'Enter at least one worked week in the severance reference period to estimate ESA severance pay.');
    }

    if (employer === 'starbucks' && severanceEligibleByService) {
      addFlag(flags, 'info', 'ESA severance has been included', 'For this Starbucks Coffee Canada, Inc. workflow, the calculator assumes the ESA employer payroll condition is met. This is a calculator assumption, not a legal determination.');
    }

    if (employer !== 'starbucks' && severanceEligibleByService) {
      addFlag(flags, 'warn', 'ESA severance is not included automatically', 'You have at least five years of service, but this calculator does not assume a different employer meets Ontario’s payroll or closure test.');
    }

    if (benefits !== 'yes' && missingNoticeWeeks > 0) {
      addFlag(flags, 'warn', 'Check the benefits end date', 'During the statutory notice period, an employer generally must continue the contributions required to maintain applicable benefit plans.');
    }

    if (release === 'yes') {
      addFlag(flags, 'warn', 'A Full and Final Release is involved', 'Identify exactly which dollars are statutory amounts and which dollars are additional compensation offered in exchange for the release.');
    }

    if (packageTotal > 0 && packageTotal < estimatedFloor) {
      addFlag(flags, 'danger', 'The entered package total is below this ESA estimate', 'Recheck your entries and the paperwork. Working notice, benefits, or separately paid amounts may explain a difference, but this deserves closer review.');
    }

    if (packageTotal > 0 && enhanced === 0 && release === 'yes') {
      addFlag(flags, 'warn', 'No enhanced amount was entered', 'If Starbucks requires a release, look for an additional or enhanced payment that is specifically conditional on signing.');
    }

    document.getElementById('criticalFlags').innerHTML = flags.join('');

    document.getElementById('checklist').innerHTML = buildChecklist();

    var questions = [];
    questions.push('How did Starbucks calculate my regular weekly wage and statutory notice period?');
    if (severanceEligibleByService) {
      questions.push('What service period and regular weekly wage did Starbucks use for my ESA severance calculation?');
    }
    if (missingNoticeWeeks > 0) {
      questions.push('Exactly which benefits continue during my statutory notice period, and what is the final coverage date?');
    }
    if (release === 'yes') {
      questions.push('How much of this package am I already entitled to without signing the release, and how much is additional consideration for signing?');
      questions.push('What claims, rehire rights, confidentiality obligations, and non-disparagement obligations does the release cover?');
    }
    if (transfer === 'declined') {
      questions.push('Does Starbucks say the position I declined was reasonable alternative employment under the ESA, and why?');
    }
    if (mass !== 'no') {
      questions.push('Do Ontario mass-termination rules apply to me, and was a Form 1 provided to the Director and affected employees?');
    }
    questions.push('Does my Starbucks employment agreement contain a termination clause that affects rights beyond ESA minimums?');

    document.getElementById('questionsList').innerHTML = questions.map(function (question) {
      return '<div class="question">' + question + '</div>';
    }).join('');

    results.classList.remove('hidden');
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.querySelectorAll('input[name="mass"]').forEach(function (input) {
    input.addEventListener('change', updateMassVisibility);
  });

  document.querySelectorAll('input[name="terminationMode"], input[name="severanceMode"]').forEach(function (input) {
    input.addEventListener('change', function () {
      updateReferencePeriods();
      updateAverages();
    });
  });

  document.querySelectorAll('#terminationDate, #noticeDate').forEach(function (input) {
    input.addEventListener('change', updateReferencePeriods);
  });

  document.getElementById('hourlyRate').addEventListener('input', updateAverages);

  document.querySelectorAll('.termWeek-entry, .sevWeek-entry').forEach(function (input) {
    input.addEventListener('input', updateAverages);
  });

  document.getElementById('copyTerminationWeeks').addEventListener('click', function () {
    setRadio('severanceMode', selected('terminationMode'));
    for (var i = 1; i <= 12; i += 1) {
      document.getElementById('sevWeek' + i).value = document.getElementById('termWeek' + i).value;
    }
    updateReferencePeriods();
    updateAverages();
  });

  document.getElementById('exampleButton').addEventListener('click', function () {
    var end = new Date();
    end.setHours(12, 0, 0, 0);
    var start = new Date(end.getTime());
    start.setFullYear(start.getFullYear() - 10);

    document.getElementById('employer').value = 'starbucks';
    document.getElementById('hireDate').value = dateInputValue(start);
    document.getElementById('terminationDate').value = dateInputValue(end);
    document.getElementById('noticeDate').value = '';
    document.getElementById('hourlyRate').value = '27.69';
    setRadio('transfer', 'no');
    setRadio('mass', 'unknown');
    setRadio('terminationMode', 'hours');
    setRadio('severanceMode', 'hours');
    setRadio('release', 'yes');
    setRadio('benefits', 'unknown');

    var hours = [22, 23, 20, 24, 21, 0, 22, 25, 19, 23, 22, 21];
    for (var i = 1; i <= 12; i += 1) {
      document.getElementById('termWeek' + i).value = hours[i - 1] || '';
      document.getElementById('sevWeek' + i).value = hours[i - 1] || '';
    }

    document.getElementById('offerTermination').value = '';
    document.getElementById('offerTerminationVacation').value = '';
    document.getElementById('offerSeverance').value = '';
    document.getElementById('offerVacation').value = '';
    document.getElementById('offerWages').value = '';
    document.getElementById('offerEnhanced').value = '';
    document.getElementById('offerOther').value = '';

    updateMassVisibility();
    updateReferencePeriods();
    updateAverages();
  });

  document.getElementById('printButton').addEventListener('click', function () {
    window.print();
  });

  form.addEventListener('submit', calculate);

  updateMassVisibility();
  updateReferencePeriods();
  updateAverages();
}());