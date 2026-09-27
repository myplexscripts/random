(function(){
'use strict';

var ANCHOR_PAYDAY = new Date(2026,8,18,12);
var ANCHOR_PERIOD_START = new Date(2026,7,31,12);
var ANCHOR_PERIOD_END = new Date(2026,8,13,12);

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
  var x=new Date(d.getTime());x.setDate(x.getDate()+n);return x;
}
function diffDays(a,b){return Math.round((b-a)/86400000);}
function selected(name){
  var el=document.querySelector('input[name="'+name+'"]:checked');
  return el?el.value:'';
}
function num(id){
  var v=$(id).value;
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
  if(y<3)return 2;if(y<4)return 3;if(y<5)return 4;if(y<6)return 5;if(y<7)return 6;if(y<8)return 7;return 8;
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
function periodLabel(p){
  return fmt(p.start)+' to '+fmt(p.end);
}
function buildWeeks(containerId, referenceDate, prefix){
  var box=$(containerId);
  box.innerHTML='';
  if(!referenceDate){
    box.innerHTML='<p class="small">Enter the date above first.</p>';
    return;
  }

  var lastDate=addDays(referenceDate,-1);
  var firstWeekStart=mondayOnOrBefore(lastDate);
  var weeks=[];
  for(var i=0;i<12;i++){
    var start=addDays(firstWeekStart,-7*i);
    var end=addDays(start,6);
    weeks.push({start:start,end:end,period:periodForDate(start)});
  }
  weeks.reverse();

  var groups=[];
  weeks.forEach(function(w){
    var key=w.period.start.toISOString().slice(0,10);
    var g=groups.find(function(x){return x.key===key;});
    if(!g){g={key:key,period:w.period,weeks:[]};groups.push(g);}
    g.weeks.push(w);
  });

  groups.forEach(function(g,gi){
    var period=document.createElement('div');
    period.className='pay-period';
    var paidText=g.period.payday>new Date(2026,8,27,23,59)?'paid '+fmt(g.period.payday):'payday '+fmt(g.period.payday);
    period.innerHTML='<div class="period-title"><strong>Pay period '+periodLabel(g.period)+'</strong><span>'+paidText+'</span></div><div class="week-grid"></div>';
    var grid=period.querySelector('.week-grid');
    g.weeks.forEach(function(w,wi){
      var index=groups.slice(0,gi).reduce(function(s,x){return s+x.weeks.length;},0)+wi+1;
      var el=document.createElement('div');
      el.className='week';
      el.innerHTML='<label>Week of '+fmt(w.start)+'<small>hours actually worked</small><input id="'+prefix+index+'" class="'+prefix+'Input" type="number" min="0" step="0.25" inputmode="decimal" placeholder="0"></label>';
      grid.appendChild(el);
    });
    box.appendChild(period);
  });

  box.querySelectorAll('input').forEach(function(input){input.addEventListener('input',updateAverages);});
}
function average(prefix){
  var rate=num('rate');
  var vals=[].slice.call(document.querySelectorAll('.'+prefix+'Input')).map(function(x){return Math.max(0,Number(x.value)||0);});
  var worked=vals.filter(function(v){return v>0;});
  if(!worked.length)return {hours:0,pay:0,count:0};
  var avgH=worked.reduce(function(a,b){return a+b;},0)/worked.length;
  return {hours:avgH,pay:avgH*rate,count:worked.length};
}
function updateAverages(){
  $('avgPay').textContent=money(average('main').pay);
  $('noticeAvgPay').textContent=money(average('notice').pay);
}
function rebuild(){
  var last=parseDate($('lastDay').value);
  var notice=parseDate($('noticeDate').value);
  buildWeeks('periods',last,'main');
  if(selected('notice')==='yes'&&notice)buildWeeks('noticePeriods',notice,'notice');
  updateAverages();
}
function toggleNotice(){
  var yes=selected('notice')==='yes';
  $('noticeDateWrap').classList.toggle('hidden',!yes);
  $('noticeHoursCard').classList.toggle('hidden',!yes);
  $('packageStep').textContent=yes?'4. What does your Starbucks paperwork say?':'3. What does your Starbucks paperwork say?';
  if(yes&&parseDate($('noticeDate').value))buildWeeks('noticePeriods',parseDate($('noticeDate').value),'notice');
}
function warn(type,title,body){
  return '<div class="warning '+type+'"><strong>'+title+'</strong>'+body+'</div>';
}
function calculate(e){
  e.preventDefault();
  var hire=parseDate($('hireDate').value);
  var last=parseDate($('lastDay').value);
  var rate=num('rate');
  if(!hire||!last||last<hire||rate<=0){alert('Please enter your start date, last day and hourly wage.');return;}

  var mainAvg=average('main');
  if(!mainAvg.count){alert('Enter your recent weekly hours first.');return;}

  var hasNotice=selected('notice')==='yes';
  var noticeDate=parseDate($('noticeDate').value);
  var terminationAvg=mainAvg;
  var workingNotice=0;

  if(hasNotice){
    if(!noticeDate||noticeDate>last){alert('Please enter the date Starbucks gave you written notice.');return;}
    terminationAvg=average('notice');
    if(!terminationAvg.count){alert('Enter the earlier weekly hours shown in section 3.');return;}
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

  var offer=num('offerTermination')+num('offerSeverance')+num('offerExtra')+num('offerOther');

  $('esaTotal').textContent=money(total);
  $('offerTotal').textContent=money(offer);
  $('extraPay').textContent=money(num('offerExtra'));
  $('rWeekly').textContent=money(terminationAvg.pay);
  $('rNotice').textContent=required+' week'+(required===1?'':'s');
  $('rTermination').textContent=money(terminationPay);
  $('rVacation').textContent=money(vacPay);
  $('rSeverance').textContent=money(severance);

  var warnings=[];
  if(selected('transfer')==='declined')warnings.push(warn('danger','You turned down another Starbucks job','That can affect ESA entitlement if the other job was considered reasonable alternative employment. The number below may not apply exactly.'));
  if(selected('transfer')==='accepted')warnings.push(warn('info','You accepted another Starbucks job','If your employment continued, termination or severance may not have been triggered in the way this calculator assumes.'));
  if(selected('release')==='yes')warnings.push(warn('warn','Your package includes a Full and Final Release','The ESA amounts are minimum employment standards. Check exactly how much extra money Starbucks is offering specifically for signing the release.'));
  if(selected('release')==='unknown')warnings.push(warn('warn','Look for “Full and Final Release”','If you see those words, read that section carefully before signing.'));
  if(offer>0&&offer<total)warnings.push(warn('danger','The cash amounts you entered are below this ESA estimate','Double-check the paperwork and your entries. There may be amounts listed somewhere else, but the difference deserves a closer look.'));
  if(severanceEligible)warnings.push(warn('info','ESA severance is included','This tool assumes Starbucks Coffee Canada, Inc. meets Ontario’s employer-size test for ESA severance pay.'));
  $('warnings').innerHTML=warnings.join('');

  $('results').classList.remove('hidden');
  $('results').scrollIntoView({behavior:'smooth',block:'start'});
}

document.querySelectorAll('input[name="notice"]').forEach(function(x){x.addEventListener('change',function(){toggleNotice();rebuild();});});
$('lastDay').addEventListener('change',rebuild);
$('noticeDate').addEventListener('change',rebuild);
$('rate').addEventListener('input',updateAverages);
$('form').addEventListener('submit',calculate);

var today=new Date(2026,8,27,12);
$('lastDay').value='2026-09-27';
rebuild();
toggleNotice();
}());