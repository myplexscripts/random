(function(){
'use strict';

var ANCHOR_PAYDAY = new Date(2026,8,18,12);
var ANCHOR_PERIOD_START = new Date(2026,7,31,12);
var KNOWN_LATEST_PAYDAY = new Date(2026,8,18,23,59);

var $ = function(id){return document.getElementById(id);};
var money = function(n){return new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(Number.isFinite(n)?n:0);};

function parseDate(v){
  if(!v)return null;
  var p=v.split('-').map(Number);
  return new Date(p[0],p[1]-1,p[2],12);
}
function fmt(d){
  return new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',year:d.getFullYear()!==2026?'numeric':undefined}).format(d);
}
function addDays(d,n){
  var x=new Date(d.getTime());
  x.setDate(x.getDate()+n);
  return x;
}
function diffDays(a,b){return Math.round((b-a)/86400000);}
function selected(name){
  var el=document.querySelector('input[name="'+name+'"]:checked');
  return el?el.value:'';
}
function num(id){
  var el=$(id);
  if(!el)return 0;
  var v=el.value;
  return v===''?0:Math.max(0,Number(v)||0);
}
function fullMonths(a,b){
  var m=(b.getFullYear()-a.getFullYear())*12+(b.getMonth()-a.getMonth());
  if(b.getDate()<a.getDate())m--;
  return Math.max(0,m);
}
function noticeWeeks(months){
  if(months<3)return 0;
  if(months<12)return 1;
  var y=Math.floor(months/12);
  if(y<3)return 2;
  if(y<4)return 3;
  if(y<5)return 4;
  if(y<6)return 5;
  if(y<7)return 6;
  if(y<8)return 7;
  return 8;
}
function mondayOnOrBefore(d){
  var x=new Date(d.getTime());
  var day=x.getDay();
  var back=day===0?6:day-1;
  x.setDate(x.getDate()-back);
  return x;
}
function periodForDate(d){
  var days=diffDays(ANCHOR_PERIOD_START,d);
  var block=Math.floor(days/14);
  var start=addDays(ANCHOR_PERIOD_START,block*14);
  var end=addDays(start,13);
  var payday=addDays(ANCHOR_PAYDAY,block*14);
  return {start:start,end:end,payday:payday};
}
function periodKey(period){
  return period.start.getFullYear()+'-'+String(period.start.getMonth()+1).padStart(2,'0')+'-'+String(period.start.getDate()).padStart(2,'0');
}
function buildReferencePeriods(referenceDate){
  if(!referenceDate)return [];
  var lastDate=addDays(referenceDate,-1);
  var firstWeekStart=mondayOnOrBefore(lastDate);
  var weeks=[];
  for(var i=0;i<12;i++){
    var start=addDays(firstWeekStart,-7*i);
    weeks.push({start:start,period:periodForDate(start)});
  }
  weeks.reverse();

  var groups=[];
  weeks.forEach(function(w){
    var key=periodKey(w.period);
    var group=groups.find(function(g){return g.key===key;});
    if(!group){
      group={key:key,period:w.period,weeks:0};
      groups.push(group);
    }
    group.weeks+=1;
  });
  return groups;
}
function periodInputValue(prefix,key,part){
  var el=document.querySelector('[data-prefix="'+prefix+'"][data-key="'+key+'"][data-part="'+part+'"]');
  if(!el)return 0;
  return Math.max(0,Number(el.value)||0);
}
function weeksWorkedValue(prefix,key){
  var el=document.querySelector('input[name="'+prefix+'Weeks'+key.replace(/-/g,'')+'"]:checked');
  return el?Number(el.value):2;
}
function periodEarnings(prefix,group){
  var paid=group.period.payday<=KNOWN_LATEST_PAYDAY;
  if(paid){
    return periodInputValue(prefix,group.key,'regular')+periodInputValue(prefix,group.key,'training');
  }
  var rate=num('rate');
  var hours=periodInputValue(prefix,group.key,'regularHours')+periodInputValue(prefix,group.key,'trainingHours');
  return hours*rate;
}
function buildPeriodCards(containerId,referenceDate,prefix){
  var box=$(containerId);
  box.innerHTML='';
  var groups=buildReferencePeriods(referenceDate);
  if(!groups.length){
    box.innerHTML='<p class="small">Enter the date above first.</p>';
    return;
  }

  groups.forEach(function(group){
    var paid=group.period.payday<=KNOWN_LATEST_PAYDAY;
    var name=prefix+'Weeks'+group.key.replace(/-/g,'');
    var card=document.createElement('div');
    card.className='pay-period';

    var status=paid?'Paid '+fmt(group.period.payday):'No paystub yet';
    var fields=paid
      ? '<label><span>Regular Wage <small>Current $</small></span><div class="money"><b>$</b><input data-prefix="'+prefix+'" data-key="'+group.key+'" data-part="regular" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div></label>'+
        '<label><span>Training <small>Current $</small></span><div class="money"><b>$</b><input data-prefix="'+prefix+'" data-key="'+group.key+'" data-part="training" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div></label>'
      : '<label><span>Regular Wage <small>hours</small></span><input data-prefix="'+prefix+'" data-key="'+group.key+'" data-part="regularHours" type="number" min="0" step="0.25" inputmode="decimal" placeholder="0"></label>'+
        '<label><span>Training <small>hours</small></span><input data-prefix="'+prefix+'" data-key="'+group.key+'" data-part="trainingHours" type="number" min="0" step="0.25" inputmode="decimal" placeholder="0"></label>';

    var maxWeeks=group.weeks;
    var buttons='';
    for(var n=maxWeeks;n>=0;n--){
      var label=n===0?'0':String(n);
      buttons+='<label><input type="radio" name="'+name+'" value="'+n+'" '+(n===maxWeeks?'checked':'')+'><span>'+label+'</span></label>';
    }

    card.innerHTML=
      '<div class="period-title"><strong>'+fmt(group.period.start)+' to '+fmt(group.period.end)+'</strong><span>'+status+'</span></div>'+
      '<div class="period-fields '+(paid?'':'current')+'">'+
        fields+
        '<div class="weeks-worked"><span>Weeks you actually worked</span><div class="week-buttons">'+buttons+'</div></div>'+
      '</div>'+
      (paid
        ? '<p class="period-note">Copy the Current amounts exactly from this paystub. Leave Training blank if there is no Training line.</p>'
        : '<p class="period-note">This period has not been paid yet. Enter Regular Wage and Training hours instead, and we will use your current hourly rate.</p>');

    box.appendChild(card);
  });

  box.querySelectorAll('input').forEach(function(input){
    input.addEventListener('input',updateAverages);
    input.addEventListener('change',updateAverages);
  });
}
function averageFor(prefix,referenceDate){
  var groups=buildReferencePeriods(referenceDate);
  var totalWages=0;
  var totalWorkedWeeks=0;

  groups.forEach(function(group){
    var workedWeeks=weeksWorkedValue(prefix,group.key);
    var earnings=periodEarnings(prefix,group);
    totalWages+=earnings;
    totalWorkedWeeks+=workedWeeks;
  });

  return {
    pay:totalWorkedWeeks?totalWages/totalWorkedWeeks:0,
    totalWages:totalWages,
    count:totalWorkedWeeks
  };
}
function currentAverages(){
  var last=parseDate($('lastDay').value);
  var notice=parseDate($('noticeDate').value);
  return {
    main:averageFor('main',last),
    notice:averageFor('notice',notice)
  };
}
function updateAverages(){
  var avgs=currentAverages();
  $('avgPay').textContent=money(avgs.main.pay);
  $('noticeAvgPay').textContent=money(avgs.notice.pay);
}
function rebuild(){
  var last=parseDate($('lastDay').value);
  var notice=parseDate($('noticeDate').value);
  buildPeriodCards('periods',last,'main');
  if(selected('notice')==='yes'&&notice)buildPeriodCards('noticePeriods',notice,'notice');
  updateAverages();
}
function toggleNotice(){
  var yes=selected('notice')==='yes';
  $('noticeDateWrap').classList.toggle('hidden',!yes);
  $('noticeHoursCard').classList.toggle('hidden',!yes);
  if(yes&&parseDate($('noticeDate').value)){
    buildPeriodCards('noticePeriods',parseDate($('noticeDate').value),'notice');
  }
  updateAverages();
}
function warn(type,title,body){
  return '<div class="warning '+type+'"><strong>'+title+'</strong>'+body+'</div>';
}
function validatePeriodEntries(prefix,referenceDate){
  var groups=buildReferencePeriods(referenceDate);
  for(var i=0;i<groups.length;i++){
    var group=groups[i];
    var worked=weeksWorkedValue(prefix,group.key);
    var earnings=periodEarnings(prefix,group);
    if(worked>0&&earnings<=0){
      return 'You said you worked during '+fmt(group.period.start)+' to '+fmt(group.period.end)+' but did not enter any Regular Wage or Training for that period.';
    }
    if(worked===0&&earnings>0){
      return 'You entered Regular Wage or Training for '+fmt(group.period.start)+' to '+fmt(group.period.end)+' but selected 0 weeks worked.';
    }
  }
  return '';
}
function calculate(e){
  e.preventDefault();

  var hire=parseDate($('hireDate').value);
  var last=parseDate($('lastDay').value);
  var rate=num('rate');

  if(!hire||!last||last<hire||rate<=0){
    alert('Please enter your start date, last day and current hourly wage.');
    return;
  }

  var mainError=validatePeriodEntries('main',last);
  if(mainError){
    alert(mainError);
    return;
  }

  var mainAvg=averageFor('main',last);
  if(!mainAvg.count){
    alert('Enter your recent pay statement information first.');
    return;
  }

  var hasNotice=selected('notice')==='yes';
  var noticeDate=parseDate($('noticeDate').value);
  var terminationAvg=mainAvg;
  var workingNotice=0;

  if(hasNotice){
    if(!noticeDate||noticeDate>last){
      alert('Please enter the date Starbucks gave you written notice.');
      return;
    }
    var noticeError=validatePeriodEntries('notice',noticeDate);
    if(noticeError){
      alert(noticeError);
      return;
    }
    terminationAvg=averageFor('notice',noticeDate);
    if(!terminationAvg.count){
      alert('Enter the earlier pay statement information shown under Step 2.');
      return;
    }
    workingNotice=diffDays(noticeDate,last)/7;
  }

  var months=fullMonths(hire,last);
  var required=noticeWeeks(months);
  var missing=Math.max(0,required-workingNotice);
  var terminationPay=terminationAvg.pay*missing;
  var vacRate=months>=60?0.06:0.04;
  var vacPay=terminationPay*vacRate;

  var adjustedEnd=addDays(last,Math.round(missing*7));
  var adjustedMonths=fullMonths(hire,adjustedEnd);
  var severanceEligible=adjustedMonths>=60;
  var sevWeeks=Math.min(26,Math.floor(adjustedMonths/12)+(adjustedMonths%12)/12);
  var severance=severanceEligible?mainAvg.pay*sevWeeks:0;
  var total=terminationPay+vacPay+severance;

  var offer=num('offerTermination')+num('offerVacation')+num('offerSeverance')+num('offerExtra')+num('offerOther');

  $('esaTotal').textContent=money(total);
  $('offerTotal').textContent=money(offer);
  $('extraPay').textContent=money(num('offerExtra'));

  var serviceYears=Math.floor(months/12);
  var serviceExtraMonths=months%12;

  $('averageEquation').textContent=money(terminationAvg.totalWages)+' ÷ '+terminationAvg.count+' worked week'+(terminationAvg.count===1?'':'s')+' = '+money(terminationAvg.pay);
  $('noticeEquation').textContent=serviceYears+' years, '+serviceExtraMonths+' months of service = '+required+' week'+(required===1?'':'s');
  $('terminationEquation').textContent=money(terminationAvg.pay)+' × '+missing.toFixed(2).replace('.00','')+' weeks = '+money(terminationPay);
  $('terminationEquationDetail').textContent=required+' required week'+(required===1?'':'s')+' minus '+workingNotice.toFixed(2).replace('.00','')+' week'+(workingNotice===1?'':'s')+' of working notice already given.';
  $('vacationEquation').textContent=money(terminationPay)+' × '+Math.round(vacRate*100)+'% = '+money(vacPay);
  $('severanceEquation').textContent=money(mainAvg.pay)+' × '+sevWeeks.toFixed(2).replace('.00','')+' = '+money(severance);
  $('severanceEquationDetail').textContent=severanceEligible
    ? 'Your completed years and months of service equal '+sevWeeks.toFixed(2).replace('.00','')+' weeks for ESA severance.'
    : 'You have less than 5 years of service, so ESA severance is not included.';
  $('totalEquation').textContent=money(terminationPay)+' + '+money(vacPay)+' + '+money(severance)+' = '+money(total);

  var warnings=[];

  if($('hadSickPay').checked){
    warnings.push(warn('warn','You had Sick and Fam pay','The simple paystub shortcut does not automatically add Sick and Fam. Because Ontario averages regular wages over weeks actually worked, a pay period containing sick pay may need a closer review.'));
  }
  if(selected('transfer')==='declined'){
    warnings.push(warn('danger','You turned down another Starbucks job','That can affect ESA entitlement if the other job was considered reasonable alternative employment. The number below may not apply exactly.'));
  }
  if(selected('transfer')==='accepted'){
    warnings.push(warn('info','You accepted another Starbucks job','If your employment continued, termination or severance may not have been triggered in the way this calculator assumes.'));
  }
  if(selected('release')==='yes'){
    warnings.push(warn('warn','Your package includes a Full and Final Release','The ESA amounts are minimum employment standards. Check exactly how much extra money Starbucks is offering specifically for signing the release.'));
  }
  if(selected('release')==='unknown'){
    warnings.push(warn('warn','Look for “Full and Final Release”','If you see those words, read that section carefully before signing.'));
  }
  if(offer>0&&offer<total){
    warnings.push(warn('danger','The cash amounts you entered are below this ESA estimate','Double-check the paperwork and your entries. There may be amounts listed somewhere else, but the difference deserves a closer look.'));
  }
  if(severanceEligible){
    warnings.push(warn('info','ESA severance is included','This tool assumes Starbucks Coffee Canada, Inc. meets Ontario’s employer-size test for ESA severance pay.'));
  }

  $('warnings').innerHTML=warnings.join('');
  $('results').classList.remove('hidden');
  $('results').scrollIntoView({behavior:'smooth',block:'start'});
}

document.querySelectorAll('input[name="notice"]').forEach(function(input){
  input.addEventListener('change',function(){
    toggleNotice();
    rebuild();
  });
});
$('lastDay').addEventListener('change',rebuild);
$('noticeDate').addEventListener('change',rebuild);
$('rate').addEventListener('input',updateAverages);
$('form').addEventListener('submit',calculate);

$('lastDay').value='2026-09-27';
rebuild();
toggleNotice();
}());