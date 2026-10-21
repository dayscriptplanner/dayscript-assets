/* DayScript planner — all page logic. Loaded by planner.html; no inline script so the CSP can stay strict. */
(function(){
"use strict";
var KEY="dayscript.demo.v1";
var MFULL=["january","february","march","april","may","june","july","august","september","october","november","december"];
var MAB=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
var WD=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
var START=new Date(2026,7,1), END=new Date(2027,6,31);
var SMILES=["coffee first. legibility second.","begin where the page begins: anywhere.","we'll call yesterday a rough draft.","the week belongs to whoever writes it first.","your handwriting counts as a font.","a plan is a rumor you tell the morning.","cross it off like you mean it.","today has excellent margins.","the to-do list is not the boss of you. it's the intern.","somewhere, a tuesday is proud of you.","write it down before it becomes a personality.","ambition, but make it legible.","this page has never seen your search history.","small wins compound. so does laundry.","the calendar is a suggestion you made to yourself.","ink dries faster than doubt.","one line is a whole entry if you write it in cursive.","your future self reads this. wave.","nothing here expires except the milk you keep forgetting.","a dot a day keeps the guilt away.","penmanship optional. showing up too, honestly.","the margin is listening.","chapters end. that's what makes them chapters.","you are the main character. act like a narrator.","if it's not written down, it's folklore.","monday has been notified.","dream in years, plan in weeks, forgive in days.","the archive remembers so you don't have to.","circled means real. everything else is weather.","an unwritten goal is just a mood.","this planner runs on ink and mild optimism.","rest is a task. check it off.","the plot thickens daily.","some days the win is the attempt.","half-finished is a place. visit, don't live there.","your goals called. they'd like a date.","eat the frog, but garnish it.","a blank page is not judging you. it can't even see.","hydrate, then dominate, then nap.","the best time to plan was yesterday. the second best is after coffee.","make the list. become the list. transcend the list.","gratitude fits on one line. so does a complaint. choose wisely.","every empty box is a tiny dare.","you can't spell accomplished without a few crossed-out letters.","next week's you is reading this in awe.","the sun rises. the tabs are right there. no excuses.","file it under handled.","the ending is written first. the middle is just commuting."];
function smileFor(k){var h=0;for(var i=0;i<k.length;i++)h=(h*31+k.charCodeAt(i))>>>0;return SMILES[h%48];}

/* ---------- dates ---------- */
function pad(n){return (n<10?"0":"")+n}
function iso(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function parse(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function add(s,n){var d=parse(s);d.setDate(d.getDate()+n);return iso(d)}
function wdi(s){return (parse(s).getDay()+6)%7}
function mon(s){return add(s,-wdi(s))}
function ymOf(s){return s.slice(0,7)}
function clampDay(s){var d=parse(s);if(d<START)return iso(START);if(d>END)return iso(END);return s}
var TODAY=clampDay(iso(new Date()));
var MONTHS=[];for(var m=7;m<19;m++){MONTHS.push((2026+Math.floor(m/12))+"-"+pad(m%12+1))}
function daysIn(ym){var p=ym.split("-");return new Date(+p[0],+p[1],0).getDate()}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}

/* ---------- state ---------- */
var S;
function blank(){return{owner:"",view:"cover",cursor:TODAY,pencil:true,habits:["water","walk","read","stretch"],
  days:{},weeks:{},months:{},lists:[],todo:[],year:{above:"",stories:[]},clearing:[],archive:{},archiveTab:"projects",dismissed:[]}}
function seed(){
  var s=blank(),t=TODAY,y=add(t,-1),w=mon(t);
  s.owner="Katie";
  s.days[t]={plot:"get the proofs out the door before school pickup",lines:[
    {t:"email the printer about proofs",done:true},{t:"dentist tues 3",done:false},
    {t:"30 minutes on storyline one",done:false},{t:"pick up dry cleaning",done:false}],
    grat:["a slow coffee","a sunny walk",""],habits:{water:true,read:true},strokes:[]};
  s.days[y]={plot:"",lines:[{t:"order the birthday card",done:false},{t:"laundry",done:true}],grat:["","",""],habits:{water:true,walk:true,stretch:true},strokes:[]};
  s.days[add(t,-2)]={plot:"",lines:[{t:"grocery run",done:true}],grat:["","",""],habits:{walk:true,read:true},strokes:[]};
  s.days[add(t,2)]={plot:"",lines:[{t:"7pm · school open house",done:false}],grat:["","",""],habits:{},strokes:[]};
  s.weeks[add(w,-7)]={willdo:[{t:"",done:false},{t:"",done:false},{t:"",done:false}],win:"first etsy sale from pinterest"};
  s.weeks[w]={willdo:[{t:"send proofs to the printer",done:true},{t:"book thanksgiving flights",done:false},{t:"",done:false}],win:""};
  s.months[ymOf(t)]={goal:"launch the website waitlist",margin:{}};
  s.months[ymOf(t)].margin[+t.slice(8)-1]="tired but hopeful";
  s.months[ymOf(t)].margin[+t.slice(8)-2]="good, busy";
  s.year={above:"make the planner pay for itself",stories:[
    {end:"the DayScript app has 1,000 people writing in it",ch:[{t:"landing page and waitlist live",date:"2026-10-31",done:false},{t:"phone sync working",date:"2026-11-30",done:false},{t:"app launch",date:"2026-12-31",done:false},{t:"first 100 subscribers",date:"2027-02-28",done:false},{t:"1,000 writers",date:"2027-06-30",done:false}]},
    {end:"run a 10k without stopping",ch:[]},{end:"",ch:[]}]};
  s.clearing=[{t:"renew the car registration",real:true},{t:"try the new pasta place",real:false},{t:"ask about a standing desk",real:false},{t:"fix the porch light",real:false},{t:"call about the gutters",real:false},{t:"learn calligraphy someday",real:false}];
  s.todo=[{t:"call the pediatrician about the flu shot",done:false},{t:"return the library books",done:true},{t:"pick up stamps",done:false}];
  s.lists=[{name:"groceries",items:[{t:"oat milk",done:false},{t:"eggs",done:true},{t:"apples for lunchboxes",done:false},{t:"coffee beans",done:false}]},{name:"before the holidays",items:[{t:"order holiday cards",done:false},{t:"book the cape house for thanksgiving",done:false}]}];
  s.archive={books:[{t:"Four Thousand Weeks",done:true},{t:"Tomorrow, and Tomorrow, and Tomorrow",done:false}],
    money:[{t:"house fund",amt:"250",done:false},{t:"etsy sales, october",amt:"118.40",done:false},{t:"vacation jar",amt:"60",done:false}],
    trips:[{t:"thanksgiving at the cape",done:false}],projects:[{t:"dayscript website",done:false}]};
  return s;
}
function load(){try{var r=localStorage.getItem(KEY);if(r)return JSON.parse(r)}catch(e){}return seed()}
S=load();
S=Object.assign(blank(),S);S._sug=null;S._confirm=false;S._clearInk=false;S._q="";S._delList=null;S.lists=S.lists||[];S.todo=S.todo||[];S._todoOpen=false;if(S.view==="search")S.view="cover";
function persist(){try{localStorage.setItem(KEY,JSON.stringify(S,function(k,v){return k.charAt(0)==="_"?undefined:v}))}catch(e){}}
var saveT;function save(o){var fromSync=o&&o.fromSync;if(!fromSync){S.meta=S.meta||{};S.meta.updatedAt=new Date().toISOString()}
  clearTimeout(saveT);saveT=setTimeout(persist,500);if(!fromSync&&window.sync)window.sync.scheduleSave()}

function day(d){var x=S.days[d]||(S.days[d]={});x.lines=x.lines||[];x.plot=x.plot||"";x.grat=x.grat||["","",""];x.habits=x.habits||{};x.strokes=x.strokes||[];return x}
function week(w){var x=S.weeks[w]||(S.weeks[w]={});x.willdo=x.willdo||[];while(x.willdo.length<3)x.willdo.push({t:"",done:false});x.win=x.win||"";return x}
function month(k){var x=S.months[k]||(S.months[k]={});x.goal=x.goal||"";x.margin=x.margin||{};return x}
function year(){var y=S.year;y.stories=y.stories||[];while(y.stories.length<3)y.stories.push({end:"",ch:[]});y.stories.forEach(function(s){s.ch=s.ch||[]});return y}
function arc(t){return S.archive[t]||(S.archive[t]=[])}
function written(d){var x=S.days[d];return !!(x&&(x.lines.some(function(l){return l.t||(l.ink&&l.ink.length)})||x.plot||(x.strokes&&x.strokes.length)))}

function getPath(p){return p.split(".").reduce(function(o,k){return o==null?o:o[k]},S)}
function setPath(p,v){var ks=p.split("."),o=S;for(var i=0;i<ks.length-1;i++){if(o[ks[i]]==null)o[ks[i]]={};o=o[ks[i]]}o[ks[ks.length-1]]=v;save()}

/* ---------- companion: pencil marks ---------- */
var DAYRX=/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
var DIDX={mon:0,tue:1,tues:1,wed:2,thu:3,thur:3,thurs:3,fri:4,sat:5,sun:6};
var DSHORT=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
function capture(line,from){
  var m=DAYRX.exec(line);if(!m)return null;
  var di=DIDX[m[1].toLowerCase()];var h=+m[2];if(h>12)return null;
  var ap=m[4]?m[4].toLowerCase():(h<8||h===12?"pm":(h<12?"am":"pm"));if(!m[4]&&h>=1&&h<=7)ap="pm";
  var diff=(di-wdi(from)+7)%7;if(diff===0)diff=7;var target=add(from,diff);
  var when=h+(m[3]?":"+m[3]:"")+ap;
  var rest=(line.slice(0,m.index)+line.slice(m.index+m[0].length)).replace(/\s+/g," ").trim()||"appointment";
  return{target:target,label:DSHORT[di]+" "+when+"?",text:when+" · "+rest};
}
function marks(){
  if(!S.pencil)return [];
  var out=[],v=S.view,c=S.cursor;
  function push(id,text,accept){if(S.dismissed.indexOf(id)<0)out.push({id:id,text:text,accept:accept})}
  if(v==="day"){
    var d=day(c);
    d.lines.forEach(function(l,i){if(l.done)return;var cp=capture(l.t,c);if(cp)push("cap:"+c+":"+l.t,cp.label,function(){
      day(cp.target).lines.push({t:cp.text,done:false});d.lines.splice(i,1);toast("filed on "+fmtShort(cp.target))})});
    var yl=(S.days[add(c,-1)]||{lines:[]}).lines.filter(function(l){return (l.t||(l.ink&&l.ink.length))&&!l.done});
    if(yl.length)push("carry:"+c,yl.length+" left from yesterday. carry "+(yl.length>1?"them":"it")+"?",function(){yl.forEach(function(l){d.lines.push(l.ink?{t:"",done:false,ink:JSON.parse(JSON.stringify(l.ink))}:{t:l.t,done:false});l.done=true})});
    if(!d.plot&&d.lines.filter(function(l){return l.t}).length>=2)push("plot:"+c,"what does today turn on?");
  }else if(v==="week"){
    var w=mon(c),wk=week(w);
    if(!wk.willdo.some(function(x){return x.t}))push("three:"+w,"this week's three?");
    var best=null,bn=0;for(var i=0;i<7;i++){var dd=add(w,i),n=(S.days[dd]||{lines:[]}).lines.filter(function(l){return l.t}).length;if(n>bn){bn=n;best=dd}}
    if(best&&bn>=3)push("full:"+w,"fullest day: "+DSHORT[wdi(best)].toLowerCase()+" ("+bn+")");
    if(!wk.win&&wdi(TODAY)>=4&&mon(TODAY)===w)push("win:"+w,"win of the week?");
  }else if(v==="month"){
    var k=ymOf(c),mo=month(k);
    if(!mo.goal)push("goal:"+k,"one goal?");
    var cnt=0;for(var j=1;j<=daysIn(k);j++)if(written(k+"-"+pad(j)))cnt++;
    if(cnt)push("dw:"+k,cnt+" day"+(cnt>1?"s":"")+" written");
  }else if(v==="year"){
    year().stories.forEach(function(s,i){if(s.end&&!s.ch.some(function(x){return x.t}))push("noch:"+i,"an ending with no chapters yet")});
    if(year().stories.some(function(s){return !s.end}))push("noend","one more ending?");
  }else if(v==="clearing"){
    var un=S.clearing.filter(function(x){return !x.real}).length,cr=S.clearing.filter(function(x){return x.real}).length;
    if(un>=5)push("cir:"+un,"circle what's real");
    if(cr)push("rt:"+cr,"route it?");
  }
  return out.slice(0,2);
}
function fmtShort(s){var d=parse(s);return DSHORT[wdi(s)].toLowerCase()+" "+MFULL[d.getMonth()].slice(0,3)+" "+d.getDate()}
var toastMsg="";
function toast(t){toastMsg=t}
function renderMarks(){
  var el=document.getElementById("marks");if(!el)return;
  var ms=marks();
  var h="";
  if(toastMsg){h+='<div class="mark">'+esc(toastMsg)+'</div>';toastMsg=""}
  ms.forEach(function(m,i){h+='<div class="mark"><span>'+esc(m.text)+'</span><span class="acts">'+(m.accept?'<button data-act="mark-ok" data-i="'+i+'">yes</button>':"")+'<button class="no" data-act="mark-no" data-i="'+i+'" aria-label="Dismiss">✕</button></span></div>'});
  if(!h)h='<p class="quiet">'+(S.pencil?"the margin is quiet.":"pencil off.")+'</p>';
  el.innerHTML=h;el._marks=ms;
}

/* ---------- views ---------- */
function addBar(path,label){return '<div class="addbar"><button data-act="line-add" data-path="'+path+'">+ type'+(label?" "+label:"")+'</button><button data-act="ink-add" data-path="'+path+'"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 12l1-3.4L10 1.6a1.3 1.3 0 0 1 1.9 0l.5.5a1.3 1.3 0 0 1 0 1.9L5.4 11z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>+ write by hand</button></div>'}
function lineHTML(path,l,i,ph,act){
  if(l.ink)return '<div class="line inkrow'+(l.done?" done":"")+'"><input type="checkbox" class="box" aria-label="done" '+(l.done?"checked":"")+' data-act="toggle" data-path="'+path+"."+i+'.done">'+
    '<canvas class="strip" data-ink="'+path+"."+i+'" aria-label="Handwritten to-do. Write here with a finger or pencil."></canvas>'+
    '<button class="x" data-act="ink-undo" data-path="'+path+"."+i+'" aria-label="Undo last stroke"'+(l.ink.length?'':' disabled')+'>↺</button>'+
    (act?'<button class="x" data-act="line-del" data-path="'+path+'" data-i="'+i+'" aria-label="Remove line">✕</button>':"")+'</div>';
  return '<div class="line'+(l.done?" done":"")+'"><input type="checkbox" class="box" aria-label="done" '+(l.done?"checked":"")+' data-act="toggle" data-path="'+path+"."+i+'.done">'+
    (timeOf(l.t)&&!l.done?'<span class="time">'+timeOf(l.t).label+'</span>':'')+
    '<input type="text" id="'+path.replace(/\W/g,"_")+"_"+i+'" value="'+esc(l.t)+'" placeholder="'+(ph||"")+'" data-path="'+path+"."+i+'.t" data-enter="'+(act||"")+'">'+
    (act?'<button class="x" data-act="line-del" data-path="'+path+'" data-i="'+i+'" aria-label="Remove line">✕</button>':"")+'</div>';
}
function marginCol(){return '<aside class="margin" id="marks" aria-label="Pencil notes"></aside>'}

var V={};
V.cover=function(){
  var toc=[["01","the method","the system in ninety seconds","method"],["02","the year","twelve months and three storylines","year"],["03","the month","one goal, the margin, rhythms","month"],["04","the week","the three, and the win","week"],["05","today","the plot, the list, the pen","day"],["06","lists","groceries, errands, typed or handwritten","lists"],["07","the clearing & the archive","the brain dump that routes itself","clearing"]];
  return '<div class="cover">'+
   '<svg width="104" height="78" viewBox="0 0 104 78" aria-hidden="true"><path d="M8 58 A44 44 0 0 1 96 58" fill="none" stroke="var(--copper)" stroke-width="3" stroke-linecap="round"/><path d="M22 58 A30 30 0 0 1 82 58" fill="none" stroke="var(--copper)" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="56" r="13" fill="var(--copper)"/></svg>'+
   '<div><p class="wordmark">DayScript</p><svg width="280" height="26" viewBox="0 0 280 26" aria-hidden="true" style="max-width:100%"><path d="M10 14 C90 4 180 4 244 12 C262 15 264 23 252 23 C242 23 246 13 262 10" fill="none" stroke="var(--copper)" stroke-width="2.2" stroke-linecap="round"/></svg></div>'+
   '<div class="tagline">your day, in your own script.</div>'+
   '<div style="width:min(320px,100%)"><div class="lbl">this planner belongs to</div><input class="field under" style="text-align:center;font-family:var(--hand);font-size:28px" id="owner" value="'+esc(S.owner)+'" data-path="owner" aria-label="Owner name"></div>'+
   '<div class="try"><div class="eyebrow">new here? try these three</div>'+
     '<button data-act="try" data-n="1"><span class="num">1</span><span>Open today and look at the margin. The pencil has a note about <em>dentist tues 3</em>. Tap yes.</span><span class="go">today →</span></button>'+
     '<button data-act="try" data-n="2"><span class="num">2</span><span>Turn the pen on and write anywhere on the page with a finger or Apple Pencil.</span><span class="go">pen →</span></button>'+
     '<button data-act="try" data-n="3"><span class="num">3</span><span>In the clearing, circle a thought that\'s real and send it to this week.</span><span class="go">clearing →</span></button></div>'+
   '<div class="toc"><div class="eyebrow" style="padding-bottom:6px">what\'s in the story</div>'+toc.map(function(t){return '<button data-act="view" data-v="'+t[3]+'"><span class="num">'+t[0]+'</span><span class="t">'+t[1]+'</span><span class="s">'+t[2]+'</span></button>'}).join("")+'</div>'+
   '<div class="lbl">dated · weekly · hyperlinked · aug 2026 – jul 2027</div>'+
   '<div id="cover-actions" class="row" style="justify-content:center;min-height:0"></div>'+
   '<div class="confirm" id="reset">'+(S._confirm?'<span class="voice">clear every page?</span><button class="btn copper" data-act="reset-yes">clear</button><button class="btn line-btn" data-act="reset-no">keep</button>':'<button class="btn line-btn" data-act="reset-ask">start fresh</button>')+'</div>'+
  '</div>';
};
V.method=function(){
  var st=[["storylines","Write the ending first. One sentence about where something ends up. Three, because three stories moving beat ten standing still."],["chapters","Make dreams calendar-sized. Work each ending backward into five chapters, each with a date. Chapter one is always small enough to start this week."],["the cascade","Your dream, connected to next Tuesday. Each month gets one goal. Each week gets three things you will get done, usually a piece of that goal."],["rhythms","A habit tracker with no guilt in it. Six habits at most, a dot a day, no streaks. At month's end, one question: what does the pattern say?"],["the margin","A mood tracker in your own voice. One line a day. A word is enough."],["wins & gratitude","A win goes on the week you won it. Thanks goes on the day it happened."],["the re-read","Ten minutes at month's end: wins, lessons, thanks, and next month's one goal."],["the clearing & the archive","A brain-dump page that routes what's real into your week, and storage for projects, trips, books, savings and appointments."]];
  return '<div class="stack"><div><div class="eyebrow">the system in ninety seconds</div><h1>the method</h1></div><div class="steps">'+st.map(function(s,i){return '<div class="step"><span class="num" style="font-size:18px">'+(i+1)+'</span><div><h3>'+s[0]+'</h3><p>'+s[1]+'</p></div></div>'}).join("")+'</div>'+
  '<div class="sage voice" style="text-align:center;color:var(--ink)">none of this asks for more discipline. it asks for less memory.</div>'+
  '<div class="cardp"><div class="eyebrow">the pencil in the margin</div><p style="margin:6px 0 0;max-width:62ch">The planner has a quiet companion that only writes in pencil, in the margin. It never opens a window, shows two notes at most, and a dismissed note never comes back. Write <em>dentist tues 3</em> on a day page and watch the margin. The pencil switch at the top turns it off entirely.</p></div></div>';
};
V.year=function(){
  var y=year();
  var cals=MONTHS.map(function(k){var p=k.split("-"),f=(new Date(+p[0],+p[1]-1,1).getDay()+6)%7,n=daysIn(k),g="";
    for(var i=0;i<f;i++)g+="<span></span>";
    for(var d=1;d<=n;d++){var ds=k+"-"+pad(d);g+='<span class="'+(ds===TODAY?"t":(written(ds)?"w":""))+'">'+d+'</span>'}
    return '<button class="mini" data-act="month" data-k="'+k+'"><div class="mname">'+MFULL[+p[1]-1]+'</div><div class="g">'+g+'</div></button>'}).join("");
  var st=y.stories.map(function(s,i){
    while(s.ch.length<5)s.ch.push({t:"",date:"",done:false});
    return '<div class="cardp stack" style="gap:8px"><div class="head"><h2>storyline '+["one","two","three"][i]+'</h2><span class="lbl" style="margin-left:auto">five chapters</span></div>'+
     '<div class="lbl">the ending</div><input class="field under" id="end'+i+'" value="'+esc(s.end)+'" placeholder="where this story finishes" data-path="year.stories.'+i+'.end">'+
     s.ch.map(function(c,j){return '<div class="line'+(c.done?" done":"")+'"><input type="checkbox" class="box" aria-label="chapter done" '+(c.done?"checked":"")+' data-act="toggle" data-path="year.stories.'+i+'.ch.'+j+'.done"><span class="voice" style="flex:none;font-size:13px">ch '+(j+1)+'</span><input type="text" id="ch'+i+'_'+j+'" value="'+esc(c.t)+'" placeholder="'+(j===0?"small enough to start this week":"")+'" data-path="year.stories.'+i+'.ch.'+j+'.t"><input type="date" id="cd'+i+'_'+j+'" style="border:0;background:transparent;color:var(--copper);font-size:12px;max-width:128px" value="'+esc(c.date)+'" data-path="year.stories.'+i+'.ch.'+j+'.date" aria-label="chapter date"></div>'}).join("")+'</div>';
  }).join("");
  return '<div class="stack"><div class="head"><div><div class="eyebrow">aug 2026 – jul 2027</div><h1>the year at a glance</h1></div></div>'+
   '<div class="sage"><div class="lbl">this year, above all:</div><input class="field under" id="above" value="'+esc(y.above)+'" data-path="year.above"></div>'+
   '<div class="years">'+cals+'</div><div><div class="eyebrow">storylines</div><p class="voice" style="margin:2px 0 0">write the ending first.</p></div>'+st+'</div>';
};
V.month=function(){
  var k=ymOf(S.cursor),mo=month(k),p=k.split("-"),n=daysIn(k),f=(new Date(+p[0],+p[1]-1,1).getDay()+6)%7;
  var g='';["mon","tue","wed","thu","fri","sat","sun"].forEach(function(d){g+='<div class="dow">'+d+'</div>'});
  for(var i=0;i<f;i++)g+='<div class="blank"></div>';
  for(var d=1;d<=n;d++){var ds=k+"-"+pad(d);g+='<button data-act="day" data-d="'+ds+'" class="'+(ds===TODAY?"today":"")+'" aria-label="'+MFULL[+p[1]-1]+' '+d+'">'+d+(written(ds)?'<span class="dot"></span>':'<span></span>')+'</button>'}
  var rh='<table><tr><th class="hn"></th>';for(var a=1;a<=n;a++)rh+='<th>'+(a%5===1||a===n?a:"")+'</th>';rh+='</tr>';
  S.habits.forEach(function(h){rh+='<tr><th class="hn">'+esc(h)+'</th>';for(var b=1;b<=n;b++){var ds2=k+"-"+pad(b),on=S.days[ds2]&&S.days[ds2].habits&&S.days[ds2].habits[h];rh+='<td><button class="d'+(on?" on":"")+'" data-act="habit" data-d="'+ds2+'" data-h="'+esc(h)+'" aria-label="'+esc(h)+' day '+b+'"></button></td>'}rh+='</tr>'});rh+='</table>';
  var mg='';for(var c=1;c<=n;c++){mg+='<div class="line"><span class="num" style="width:22px;font-size:13px">'+pad(c)+'</span><input type="text" id="mg'+c+'" value="'+esc(mo.margin[c]||"")+'" placeholder="'+(c===1?"a word is enough":"")+'" data-path="months.'+k+'.margin.'+c+'"></div>'}
  return '<div class="stack"><div class="head"><h1>'+MFULL[+p[1]-1]+' <span class="num" style="font-size:20px;font-style:normal">'+p[0]+'</span></h1><div class="nav"><button class="btn line-btn" data-act="view" data-v="reread">the re-read</button><button class="arrow" data-act="mstep" data-n="-1" aria-label="Previous month">‹</button><button class="arrow" data-act="mstep" data-n="1" aria-label="Next month">›</button></div></div>'+
   '<div class="sage"><div class="lbl">one goal, this month</div><input class="field under" id="goal" value="'+esc(mo.goal)+'" data-path="months.'+k+'.goal"></div>'+
   '<div><div class="eyebrow" style="margin-bottom:6px">the days</div><div class="cal">'+g+'</div></div>'+
   '<div><div class="eyebrow">rhythms</div><p class="voice" style="margin:2px 0 8px">six habits max. a dot a day. no streaks.</p><div class="rh">'+rh+'</div></div>'+
   '<div><div class="eyebrow">the margin</div><p class="voice" style="margin:2px 0 4px">one line a day.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));column-gap:24px">'+mg+'</div></div></div>';
};
V.week=function(){
  var w=mon(S.cursor),wk=week(w),e=add(w,6),dw=parse(w),de=parse(e);
  var rows='';for(var i=0;i<7;i++){var d=add(w,i),x=S.days[d],ls=x?x.lines.filter(function(l){return l.t||(l.ink&&l.ink.length)}):[];
    var prev=ls.length?ls.slice(0,3).map(function(l){return (l.done?"✓ ":"")+(l.ink?"✎ handwritten":esc(l.t))}).join(" · "):"<em>open page</em>";
    var hd=S.habits.map(function(h){return '<i class="'+(x&&x.habits[h]?"on":"")+'"></i>'}).join("");
    rows+='<button class="wkrow'+(d===TODAY?" today":"")+'" data-act="day" data-d="'+d+'"><span><span class="dn">'+WD[i].slice(0,3)+'</span><br><span class="dd">'+pad(parse(d).getDate())+'</span></span><span class="prev">'+prev+'</span><span class="hd">'+hd+'</span></button>'}
  return '<div class="stack"><div class="head"><div><div class="eyebrow">'+MFULL[dw.getMonth()].slice(0,3)+' '+dw.getDate()+' – '+MFULL[de.getMonth()].slice(0,3)+' '+de.getDate()+'</div><h1>the week of '+MFULL[dw.getMonth()].slice(0,3)+' '+dw.getDate()+'</h1></div><div class="nav"><button class="arrow" data-act="wstep" data-n="-7" aria-label="Previous week">‹</button><button class="arrow" data-act="wstep" data-n="7" aria-label="Next week">›</button></div></div>'+
   '<div class="wk">'+rows+'</div>'+
   '<div class="two"><div><div class="eyebrow">this week, i will get done</div>'+wk.willdo.map(function(l,i){return lineHTML("weeks."+w+".willdo",l,i,i===0?"usually a piece of the month's goal":"")}).join("")+'</div>'+
   '<div><div class="eyebrow">win of the week</div><input class="field under" id="win" value="'+esc(wk.win)+'" placeholder="it counts if it happened" data-path="weeks.'+w+'.win"></div></div></div>';
};
var pen={on:false,color:"ink",tool:"pen"};
function inkColor(c){var cs=getComputedStyle(document.documentElement);if(c==="ink"||c==="#26324B")return cs.getPropertyValue("--ink").trim();if(c==="copper"||c==="#B5713D")return cs.getPropertyValue("--copper").trim();return c}
var TRX=/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
function timeOf(t){var m=TRX.exec(t||"");if(!m)return null;var h=+m[1];if(h<1||h>12)return null;var pm=m[3].toLowerCase()==="pm";var mins=(h%12+(pm?12:0))*60+(m[2]?+m[2]:0);return{label:h+(m[2]?":"+m[2]:"")+m[3].toLowerCase(),mins:mins}}
function comingUp(from,n){var out=[];for(var i=0;i<n;i++){var d=add(from,i),x=S.days[d];if(!x||!x.lines)continue;x.lines.forEach(function(l){var tm=!l.done&&timeOf(l.t);if(tm)out.push({d:d,tm:tm,t:l.t.replace(TRX,"").replace(/^[\s·\-–]+|[\s·\-–]+$/g,"")||"appointment"})})}
  out.sort(function(a,b){return a.d<b.d?-1:a.d>b.d?1:a.tm.mins-b.tm.mins});return out}
V.day=function(){
  var c=S.cursor,d=day(c),dt=parse(c),k=ymOf(c);
  var lines=d.lines.map(function(l,i){return lineHTML("days."+c+".lines",l,i,"",'add')}).join("");
  var hb=S.habits.map(function(h){return '<button class="hb'+(d.habits[h]?" on":"")+'" data-act="habit" data-d="'+c+'" data-h="'+esc(h)+'" aria-pressed="'+(!!d.habits[h])+'"><i></i>'+esc(h)+'</button>'}).join("");
  var sug=S._sug?'<div class="suggest"><div class="row"><span class="eyebrow">a draft of today</span><button class="x" style="margin-left:auto" data-act="sug-close" aria-label="Close">✕</button></div>'+
    (S._sug.length?S._sug.map(function(s,i){return '<label><input type="checkbox" class="box" data-sug="'+i+'" checked>'+esc(s)+'</label>'}).join("")+'<div class="row"><button class="btn copper" data-act="sug-add">add ticked</button></div>':'<p class="voice" style="margin:0">nothing to draft from yet. that\'s fine.</p>')+'</div>':"";
  return '<div class="stack"><div class="head dayhead"><span class="big">'+pad(dt.getDate())+'</span><div><button class="mo" data-act="month" data-k="'+k+'">'+MFULL[dt.getMonth()]+'</button><div class="lbl">'+WD[wdi(c)]+(c===TODAY?" · today":"")+'</div></div><div class="nav"><button class="arrow" data-act="dstep" data-n="-1" aria-label="Previous day">‹</button><button class="arrow" data-act="dstep" data-n="1" aria-label="Next day">›</button></div></div>'+
   '<div><div class="eyebrow">the plot — what today turns on</div><input class="field under" id="plot" value="'+esc(d.plot)+'" data-path="days.'+c+'.plot"></div>'+
   '<div class="two"><div class="paper stack" id="paper" style="gap:6px"><div class="row" style="justify-content:space-between"><span class="eyebrow">today</span><span class="penbar"><button class="pill ghost" data-act="pen" aria-pressed="'+pen.on+'">✎ pen '+(pen.on?"on":"off")+'</button>'+
     (pen.on?'<button class="swatch" style="background:var(--ink)" data-act="pencolor" data-c="ink" aria-label="Navy ink" aria-pressed="'+(pen.tool==="pen"&&pen.color==="ink")+'"></button><button class="swatch" style="background:var(--copper)" data-act="pencolor" data-c="copper" aria-label="Copper ink" aria-pressed="'+(pen.tool==="pen"&&pen.color==="copper")+'"></button>'+
       '<button class="pill ghost" data-act="eraser" aria-pressed="'+(pen.tool==="eraser")+'">eraser</button><button class="pill ghost" data-act="penundo"'+(d.strokes.length?'':' disabled')+'>undo</button>'+
       (S._clearInk?'<button class="pill" data-act="penclear-yes">clear all ink?</button><button class="pill ghost" data-act="penclear-no">keep</button>':'<button class="pill ghost" data-act="penclear">clear</button>'):'')+'</span></div>'+
     lines+addBar("days."+c+".lines")+
     '<div style="min-height:150px"></div><canvas class="ink'+(pen.on?" on":"")+'" id="ink" aria-label="Handwriting area"></canvas></div>'+
   '<div class="stack"><button class="btn line-btn" data-act="suggest" style="align-self:flex-start">draft my day</button>'+sug+
     (function(){var u=comingUp(c,7);if(!u.length)return "";return '<div><div class="eyebrow">coming up</div><div class="up">'+u.slice(0,6).map(function(x){return '<button data-act="day" data-d="'+x.d+'"><span class="wd">'+(x.d===c?"today":(x.d===add(c,1)?"tomorrow":DSHORT[wdi(x.d)]+" "+parse(x.d).getDate()))+'</span><span class="tm">'+x.tm.label+'</span><span class="tx">'+esc(x.t)+'</span></button>'}).join("")+'</div></div>'})()+
     '<div><div class="eyebrow" style="margin-bottom:8px">rhythms</div><div class="habits">'+hb+'</div></div>'+
     '<div><div class="eyebrow">grateful for</div>'+d.grat.map(function(g,i){return '<div class="line"><input type="text" id="gr'+i+'" value="'+esc(g)+'" data-path="days.'+c+'.grat.'+i+'"></div>'}).join("")+'</div>'+
     '<div><div class="eyebrow">the margin</div><div class="line"><input type="text" id="dm" placeholder="today, in a word" value="'+esc(month(k).margin[dt.getDate()]||"")+'" data-path="months.'+k+'.margin.'+dt.getDate()+'"></div></div></div></div></div>';
};
V.reread=function(){
  var k=ymOf(S.cursor),mo=month(k),p=k.split("-"),n=daysIn(k),mi=MONTHS.indexOf(k),nk=MONTHS[mi+1];
  var wins=[],thanks=[],words=[],written_=0,counts={};
  S.habits.forEach(function(h){counts[h]=0});
  for(var d=1;d<=n;d++){var ds=k+"-"+pad(d),x=S.days[ds];if(written(ds))written_++;
    if(x){(x.grat||[]).forEach(function(g){if(g)thanks.push({d:ds,t:g})});S.habits.forEach(function(h){if(x.habits&&x.habits[h])counts[h]++})}
    if(mo.margin[d])words.push(mo.margin[d]);
    if(wdi(ds)===0&&S.weeks[ds]&&S.weeks[ds].win)wins.push({d:ds,t:S.weeks[ds].win})}
  var done=0;(S.days?Object.keys(S.days):[]).forEach(function(ds){if(ymOf(ds)===k)S.days[ds].lines.forEach(function(l){if(l.done&&l.t)done++})});
  var tally='<div class="tally"><div><div class="n">'+written_+'</div><div class="lbl">days written</div></div><div><div class="n">'+done+'</div><div class="lbl">lines crossed off</div></div>'+
    S.habits.map(function(h){return '<div><div class="n">'+counts[h]+'<span style="font-size:14px;color:var(--label)"> / '+n+'</span></div><div class="lbl">'+esc(h)+'</div></div>'}).join("")+'</div>';
  return '<div class="stack"><div class="head"><div><div class="eyebrow">ten minutes at month\'s end</div><h1>the re-read: '+MFULL[+p[1]-1]+'</h1></div><div class="nav"><button class="btn line-btn" data-act="month" data-k="'+k+'">back to the month</button></div></div>'+
   '<div class="sage"><div class="lbl">the one goal was</div><p class="voice" style="margin:4px 0 0;color:var(--ink);font-size:18px">'+(mo.goal?esc(mo.goal):"no goal written this month. that's information too.")+'</p></div>'+
   '<div><div class="eyebrow" style="margin-bottom:8px">what the pattern says</div>'+tally+'<p class="voice" style="margin:8px 0 0">no streaks here. just what happened.</p></div>'+
   '<div class="two"><div class="stack" style="gap:8px"><div class="eyebrow">wins</div>'+(wins.length?wins.map(function(w){return '<div class="quote">'+esc(w.t)+'<div class="lbl" style="font-style:normal;margin-top:2px">week of '+fmtShort(w.d)+'</div></div>'}).join(""):'<p class="voice" style="margin:0">no wins written down yet. write one now; they still count late.</p>')+
     '<div class="eyebrow" style="margin-top:10px">thanks</div>'+(thanks.length?thanks.slice(0,12).map(function(g){return '<div class="line"><span class="lbl" style="width:52px;flex:none">'+fmtShort(g.d).slice(4)+'</span><span>'+esc(g.t)+'</span></div>'}).join(""):'<p class="voice" style="margin:0">nothing yet.</p>')+'</div>'+
   '<div class="stack" style="gap:8px"><div class="eyebrow">the margin, in your words</div>'+(words.length?'<div class="words">'+words.map(function(w){return '<span>'+esc(w)+'</span>'}).join("")+'</div>':'<p class="voice" style="margin:0">the margin stayed blank.</p>')+
     '<div class="eyebrow" style="margin-top:10px">what i learned</div><input class="field under" id="lessons" value="'+esc(mo.lessons||"")+'" placeholder="one lesson is plenty" data-path="months.'+k+'.lessons">'+
     (nk?'<div class="eyebrow" style="margin-top:10px">next month\'s one goal</div><input class="field under" id="nextgoal" value="'+esc(month(nk).goal)+'" placeholder="'+MFULL[+nk.slice(5)-1]+', in one line" data-path="months.'+nk+'.goal">':'')+'</div></div></div>';
};
V.lists=function(){
  var cards=S.lists.map(function(L,i){var path="lists."+i+".items",n=L.items.filter(function(x){return x.done}).length;
    return '<div class="cardp stack" style="gap:4px"><div class="row" style="gap:8px"><input class="field listname" id="ln_'+i+'" value="'+esc(L.name)+'" placeholder="name this list" data-path="lists.'+i+'.name" aria-label="List name">'+
      (S._delList===i?'<span class="confirm"><button class="pill" data-act="list-del-yes" data-i="'+i+'">delete list?</button><button class="pill ghost" data-act="list-del-no">keep</button></span>':'<button class="x" data-act="list-del" data-i="'+i+'" aria-label="Delete this list">✕</button>')+'</div>'+
      L.items.map(function(x,j){return lineHTML(path,x,j,"","add")}).join("")+addBar(path)+
      (n?'<button class="route" style="align-self:flex-start;margin-top:4px" data-act="list-clear" data-i="'+i+'">clear '+n+' checked</button>':'')+'</div>'});
  return '<div class="stack"><div class="head"><div><div class="eyebrow">lists that don\'t belong to a day</div><h1>lists</h1><p class="voice" style="margin:4px 0 0">groceries, errands, packing. type a line or write it by hand.</p></div><div class="nav"><button class="btn copper" data-act="list-new">+ new list</button></div></div>'+
   (cards.length?'<div class="lists">'+cards.join("")+'</div>':'<div class="sage voice" style="color:var(--ink)">no lists yet. start one for groceries.</div>')+'</div>';
};
V.search=function(){
  var q=(S._q||"").trim().toLowerCase(),hits=[];
  function hit(where,text,act,attrs){if(text&&String(text).toLowerCase().indexOf(q)>=0)hits.push({w:where,t:String(text),a:act,x:attrs})}
  if(q.length>=2){
    Object.keys(S.days).sort().forEach(function(ds){var x=S.days[ds],w=fmtShort(ds);hit(w+" · plot",x.plot,"day",'data-d="'+ds+'"');(x.lines||[]).forEach(function(l){hit(w,l.t,"day",'data-d="'+ds+'"')});(x.grat||[]).forEach(function(g){hit(w+" · thanks",g,"day",'data-d="'+ds+'"')})});
    Object.keys(S.weeks).sort().forEach(function(w){var x=S.weeks[w];(x.willdo||[]).forEach(function(l){hit("week of "+fmtShort(w).slice(4),l.t,"day",'data-d="'+w+'" data-to="week"')});hit("win · "+fmtShort(w).slice(4),x.win,"day",'data-d="'+w+'" data-to="week"')});
    Object.keys(S.months).sort().forEach(function(k){var x=S.months[k],mn=MFULL[+k.slice(5)-1];hit(mn+" · goal",x.goal,"month",'data-k="'+k+'"');Object.keys(x.margin||{}).forEach(function(d){hit(mn+" "+d+" · margin",x.margin[d],"month",'data-k="'+k+'"')})});
    year().stories.forEach(function(s,i){hit("storyline "+(i+1),s.end,"view",'data-v="year"');s.ch.forEach(function(c){hit("storyline "+(i+1)+" · chapter",c.t,"view",'data-v="year"')})});
    S.clearing.forEach(function(c){hit("the clearing",c.t,"view",'data-v="clearing"')});
    S.lists.forEach(function(L){hit("list",L.name,"view",'data-v="lists"');L.items.forEach(function(x){hit("list · "+(L.name||"untitled"),x.t,"view",'data-v="lists"')})});
    Object.keys(S.archive).forEach(function(t){S.archive[t].forEach(function(r){hit("archive · "+t,r.t,"arcgo",'data-t="'+t+'"')})});
  }
  function hl(t){var i=t.toLowerCase().indexOf(q);return esc(t.slice(0,i))+"<mark>"+esc(t.slice(i,i+q.length))+"</mark>"+esc(t.slice(i+q.length))}
  return '<div class="stack"><div><div class="eyebrow">search</div><h1>'+(q.length<2?"find on any page":hits.length+" place"+(hits.length===1?"":"s")+" with “"+esc(S._q.trim())+"”")+'</h1></div>'+
   (q.length<2?'<p class="voice" style="margin:0">type at least two letters in the search box above.</p>':hits.length?'<div class="hits">'+hits.slice(0,60).map(function(h){return '<button data-act="'+h.a+'" '+h.x+'><span class="where">'+esc(h.w)+'</span><span>'+hl(h.t)+'</span></button>'}).join("")+'</div>':'<p class="voice" style="margin:0">nothing on any page yet. maybe it\'s still in your head.</p>')+'</div>';
};
var ARCS=[["projects","projects"],["money","money & savings"],["meals","meals"],["books","books"],["records","records"],["appointments","appointments"],["trips","trips"]];
V.clearing=function(){
  var cl=S.clearing.map(function(x,i){return '<div class="line"><button class="circle'+(x.real?" on":"")+'" data-act="circle" data-i="'+i+'" aria-label="'+(x.real?"Uncircle":"Circle as real")+'"></button><input type="text" id="cl'+i+'" value="'+esc(x.t)+'" data-path="clearing.'+i+'.t">'+(x.real?'<button class="route" data-act="route" data-i="'+i+'">→ week</button>':'')+'<button class="x" data-act="cl-del" data-i="'+i+'" aria-label="Let it go">✕</button></div>'}).join("");
  var t=S.archiveTab,list=arc(t),money=t==="money";
  var rows=list.map(function(x,i){return '<div class="line'+(x.done?" done":"")+'"><input type="checkbox" class="box" aria-label="done" '+(x.done?"checked":"")+' data-act="toggle" data-path="archive.'+t+'.'+i+'.done"><input type="text" id="ar'+i+'" value="'+esc(x.t)+'" data-path="archive.'+t+'.'+i+'.t" data-enter="arc">'+(money?'<input class="amt" id="am'+i+'" inputmode="decimal" value="'+esc(x.amt||"")+'" placeholder="0.00" data-path="archive.'+t+'.'+i+'.amt" aria-label="amount">':'')+'<button class="x" data-act="ar-del" data-i="'+i+'" aria-label="Remove">✕</button></div>'}).join("");
  var tot=money?list.reduce(function(s,x){var v=parseFloat(String(x.amt||"").replace(/[^0-9.\-]/g,""));return s+(isNaN(v)?0:v)},0):0;
  return '<div class="stack"><div class="two"><div class="stack" style="gap:6px"><div><div class="eyebrow">the brain dump that routes itself</div><h1>the clearing</h1><p class="voice" style="margin:4px 0 8px">write everything down. circle what\'s real, give it a week, and let the rest stay weather.</p></div>'+cl+
   '<input class="field under" id="clnew" placeholder="+ another thought, then enter" data-enter="clear" aria-label="New thought"></div>'+
   '<div class="stack" style="gap:6px"><div><div class="eyebrow">event-shaped storage</div><h1>the archive</h1></div><div class="chips">'+ARCS.map(function(a){return '<button class="pill" data-act="arctab" data-t="'+a[0]+'" aria-current="'+(a[0]===t)+'">'+a[1]+'</button>'}).join("")+'</div>'+rows+
   '<input class="field under" id="arnew" placeholder="+ add to '+esc(ARCS.filter(function(a){return a[0]===t})[0][1])+', then enter" data-enter="arcnew" aria-label="New archive row">'+
   (money?'<div class="sage total"><span class="lbl">saved so far</span><span class="num">$'+tot.toFixed(2)+'</span></div>':'')+'</div></div></div>';
};

/* ---------- render ---------- */
function render(focusId){
  var v=S.view,page=document.getElementById("page");
  var pills=[["day","today"],["week","week"],["month","month"],["year","year"],["lists","lists"],["clearing","clearing"],["method","method"]];
  document.getElementById("pills").innerHTML=pills.map(function(p){return '<button class="pill" data-act="view" data-v="'+p[0]+'" aria-current="'+(v===p[0]||(v==="reread"&&p[0]==="month"))+'">'+p[1]+'</button>'}).join("")+
    '<button class="pill ghost" data-act="pencil" aria-pressed="'+S.pencil+'" title="The companion writes in pencil in the margin">pencil '+(S.pencil?"on":"off")+'</button>';
  var cur=v==="cover"||v==="method"||v==="clearing"||v==="search"||v==="lists"?null:ymOf(S.cursor);
  document.getElementById("rail").innerHTML='<button class="tab" data-act="view" data-v="cover" aria-current="'+(v==="cover")+'">HOME</button>'+MONTHS.map(function(k){return '<button class="tab" data-act="month" data-k="'+k+'" aria-current="'+(cur===k)+'">'+MAB[+k.slice(5)-1]+'</button>'}).join("");
  var cover=v==="cover";
  page.className="page"+(cover?" wide":"");
  page.innerHTML='<div style="min-width:0">'+V[v]()+'</div>'+(cover?"":marginCol());
  document.getElementById("smile").textContent=cover?"":(v==="search"?"":smileFor(v+":"+(v==="day"?S.cursor:v==="week"?mon(S.cursor):ymOf(S.cursor))));
  renderMarks();
  var sh=document.getElementById("sheet"),open=S._todoOpen,left=S.todo.filter(function(x){return !x.done&&(x.t||(x.ink&&x.ink.length))}).length,crossed=S.todo.filter(function(x){return x.done}).length;
  sh.innerHTML='<button class="fab'+(open?" open":"")+'" data-act="todo" aria-expanded="'+open+'"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h2M2.5 8h2M2.5 11.5h2M7 4.5h6.5M7 8h6.5M7 11.5h6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'+(open?"close":"to-do")+(left&&!open?'<span class="count">'+left+'</span>':'')+'</button>'+
    (open?'<section class="sheet" role="dialog" aria-label="My to-do list"><div class="row" style="align-items:baseline"><h2>my to-do list</h2><span class="lbl" style="margin-left:auto">'+left+' to go</span></div>'+
    '<p class="voice" style="margin:0 0 6px;font-size:13.5px">type it or write it. cross it out when it\'s done: tick the box, draw a line through your writing, or swipe across a typed line.</p>'+
    S.todo.map(function(x,i){return lineHTML("todo",x,i,i===0?"what needs doing?":"","add")}).join("")+addBar("todo")+
    (crossed?'<button class="route" style="align-self:flex-start;margin-top:6px" data-act="todo-clear">clear '+crossed+' crossed out</button>':'')+'</section>':'');
  if(v==="day")setupInk();
  setupStrips();
  if(window.remountSync)window.remountSync();
  if(focusId){var f=document.getElementById(focusId);if(f){f.focus();try{var L=f.value.length;f.setSelectionRange(L,L)}catch(e){}}}
  save();
}
function go(v){S.view=v;S._sug=null;S._confirm=false;S._clearInk=false;if(v!=="search"){S._q="";var qi=document.getElementById("q");if(qi&&document.activeElement!==qi)qi.value=""}render();window.scrollTo(0,0)}

/* ---------- pen ---------- */
var stripRO=null;
function paintStrip(cv){var l=getPath(cv.dataset.ink);if(!l||!l.ink)return;var dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  var x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);x.lineCap="round";x.lineJoin="round";x.globalAlpha=l.done?.45:1;
  var minX=1e9,maxX=-1e9;
  l.ink.forEach(function(s){if(!s.p.length)return;x.strokeStyle=inkColor(s.c);x.lineWidth=s.w||2;x.beginPath();x.moveTo(s.p[0][0]*H,s.p[0][1]*H);
    if(s.p.length===1)x.lineTo(s.p[0][0]*H+.1,s.p[0][1]*H);
    for(var i=1;i<s.p.length-1;i++){x.quadraticCurveTo(s.p[i][0]*H,s.p[i][1]*H,(s.p[i][0]+s.p[i+1][0])/2*H,(s.p[i][1]+s.p[i+1][1])/2*H)}
    if(s.p.length>1){var L=s.p[s.p.length-1];x.lineTo(L[0]*H,L[1]*H)}x.stroke();s.p.forEach(function(q){minX=Math.min(minX,q[0]*H);maxX=Math.max(maxX,q[0]*H)})});
  if(l.done&&maxX>minX){x.globalAlpha=1;x.strokeStyle=inkColor("copper");x.lineWidth=1.6;x.beginPath();x.moveTo(minX-4,H*.52);x.lineTo(maxX+4,H*.48);x.stroke()}}
function setupStrips(){
  if(stripRO){stripRO.disconnect();stripRO=null}
  var cvs=document.querySelectorAll("canvas.strip");if(!cvs.length)return;
  if(window.ResizeObserver){stripRO=new ResizeObserver(function(es){es.forEach(function(e){paintStrip(e.target)})})}
  cvs.forEach(function(cv){
    var cur=null;
    function pt(e){var r=cv.getBoundingClientRect();return[+((e.clientX-r.left)/r.height).toFixed(4),+((e.clientY-r.top)/r.height).toFixed(4)]}
    cv.onpointerdown=function(e){var l=getPath(cv.dataset.ink);if(!l)return;cv.setPointerCapture(e.pointerId);e.preventDefault();
      var pr=e.pointerType==="pen"&&e.pressure?e.pressure:.5;cur={c:pen.color,w:+(1.2+pr*1.8).toFixed(2),p:[pt(e)]};l.ink.push(cur);paintStrip(cv)};
    cv.onpointermove=function(e){if(!cur)return;var ev=e.getCoalescedEvents?e.getCoalescedEvents():[e];ev.forEach(function(q){cur.p.push(pt(q))});paintStrip(cv)};
    cv.onpointerup=cv.onpointercancel=function(){if(!cur)return;var me=cur;cur=null;
      var l0=getPath(cv.dataset.ink),H=cv.clientHeight;
      if(l0.ink.length>1&&me.p.length>2){var xs=me.p.map(function(q){return q[0]}),ys=me.p.map(function(q){return q[1]}),w=Math.max.apply(0,xs)-Math.min.apply(0,xs),h=Math.max.apply(0,ys)-Math.min.apply(0,ys);
        var ox=[];l0.ink.slice(0,-1).forEach(function(s){s.p.forEach(function(q){ox.push(q[0])})});var ow=Math.max.apply(0,ox)-Math.min.apply(0,ox);
        if(h<.28&&w>.5&&w>=ow*.6){l0.ink.pop();l0.done=!l0.done;save();render();return}}
      save();
      var parts=cv.dataset.ink.split("."),idx=+parts.pop(),arr=getPath(parts.join("."));
      var u=cv.parentNode.querySelector('[data-act="ink-undo"]');if(u)u.disabled=false;
      if(idx===arr.length-1&&arr[idx].ink.length===1){arr.push({t:"",done:false,ink:[]});render()}else renderMarks()};
    if(stripRO)stripRO.observe(cv);paintStrip(cv)});
}
function repaintStrips(){document.querySelectorAll("canvas.strip").forEach(paintStrip)}
var inkRO=null,inkPaint=null;
try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){repaintStrips();if(inkPaint&&document.getElementById("ink"))inkPaint()})}catch(err){}
try{new MutationObserver(function(){repaintStrips();if(inkPaint&&document.getElementById("ink"))inkPaint()}).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]})}catch(err){}
function setupInk(){
  var cv=document.getElementById("ink"),host=document.getElementById("paper");if(!cv)return;
  var d=day(S.cursor),drawing=null;
  function size(){var r=host.getBoundingClientRect(),dpr=window.devicePixelRatio||1;cv.width=r.width*dpr;cv.height=r.height*dpr;paint()}
  function paint(){var x=cv.getContext("2d"),w=cv.width,h=cv.height,dpr=window.devicePixelRatio||1;x.clearRect(0,0,w,h);x.lineCap="round";x.lineJoin="round";
    d.strokes.forEach(function(s){if(!s.p.length)return;x.strokeStyle=inkColor(s.c);x.lineWidth=(s.w||2.2)*dpr;x.beginPath();x.moveTo(s.p[0][0]*w,s.p[0][1]*h);
      if(s.p.length===1)x.lineTo(s.p[0][0]*w+.1,s.p[0][1]*h);
      for(var i=1;i<s.p.length-1;i++){var mx=(s.p[i][0]+s.p[i+1][0])/2*w,my=(s.p[i][1]+s.p[i+1][1])/2*h;x.quadraticCurveTo(s.p[i][0]*w,s.p[i][1]*h,mx,my)}
      if(s.p.length>1){var L=s.p[s.p.length-1];x.lineTo(L[0]*w,L[1]*h)}x.stroke()})}
  function pt(e){var r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]}
  function erase(e){var r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,before=d.strokes.length;
    d.strokes=d.strokes.filter(function(s){return !s.p.some(function(q){var dx=q[0]*r.width-px,dy=q[1]*r.height-py;return dx*dx+dy*dy<144})});
    if(d.strokes.length!==before)paint()}
  var erasing=false;
  cv.onpointerdown=function(e){if(!pen.on)return;cv.setPointerCapture(e.pointerId);e.preventDefault();
    if(pen.tool==="eraser"){erasing=true;erase(e);return}
    var pr=e.pointerType==="pen"&&e.pressure?e.pressure:.5;drawing={c:pen.color,w:+(1.3+pr*2).toFixed(2),p:[pt(e)]};d.strokes.push(drawing);paint()};
  cv.onpointermove=function(e){if(erasing){erase(e);return}if(!drawing)return;var ev=e.getCoalescedEvents?e.getCoalescedEvents():[e];ev.forEach(function(q){drawing.p.push(pt(q))});paint()};
  cv.onpointerup=cv.onpointercancel=function(){if(erasing){erasing=false;save();render();return}if(drawing){drawing.p=drawing.p.map(function(q){return[+q[0].toFixed(4),+q[1].toFixed(4)]});drawing=null;save();render()}};
  inkPaint=paint;
  if(inkRO){inkRO.disconnect();inkRO=null}
  if(window.ResizeObserver){inkRO=new ResizeObserver(size);inkRO.observe(host)}
  size();
}

/* ---------- suggestions (local rules) ---------- */
function draft(){
  var c=S.cursor,d=day(c),have=d.lines.map(function(l){return l.t.toLowerCase()}),out=[];
  function add1(t){if(t&&have.indexOf(t.toLowerCase())<0&&out.indexOf(t)<0)out.push(t)}
  (S.days[add(c,-1)]||{lines:[]}).lines.forEach(function(l){if(l.t&&!l.done)add1(l.t)});
  week(mon(c)).willdo.forEach(function(l){if(l.t&&!l.done)add1(l.t)});
  var g=month(ymOf(c)).goal;if(g)add1("one small step toward: "+g);
  for(var i=1;i<=3;i++){var x=S.days[add(c,i)];if(x)x.lines.forEach(function(l){if(l.t&&!l.done)add1("get ready for "+fmtShort(add(c,i))+": "+l.t.replace(/^.*?·\s*/,""))})}
  return out.slice(0,6);
}

/* ---------- events ---------- */
document.addEventListener("click",function(e){
  var b=e.target.closest("[data-act]");if(!b)return;var a=b.dataset.act;
  if(b.type==="checkbox"&&a!=="toggle")return;
  switch(a){
    case "view":go(b.dataset.v);break;
    case "month":S.cursor=b.dataset.k===ymOf(TODAY)?TODAY:b.dataset.k+"-01";go("month");break;
    case "day":S.cursor=b.dataset.d;go(b.dataset.to||"day");break;
    case "arcgo":S.archiveTab=b.dataset.t;go("clearing");break;
    case "try":var tn=b.dataset.n;S.cursor=TODAY;pen.on=tn==="2";pen.tool="pen";go(tn==="3"?"clearing":"day");break;
    case "eraser":pen.tool=pen.tool==="eraser"?"pen":"eraser";render();break;
    case "penundo":day(S.cursor).strokes.pop();render();break;
    case "penclear-yes":day(S.cursor).strokes=[];S._clearInk=false;render();break;
    case "penclear-no":S._clearInk=false;render();break;
    case "dstep":S.cursor=clampDay(add(S.cursor,+b.dataset.n));S._sug=null;render();break;
    case "wstep":S.cursor=clampDay(add(S.cursor,+b.dataset.n));render();break;
    case "mstep":var i=MONTHS.indexOf(ymOf(S.cursor))+(+b.dataset.n);if(i>=0&&i<12){S.cursor=MONTHS[i]===ymOf(TODAY)?TODAY:MONTHS[i]+"-01";render()}break;
    case "toggle":setPath(b.dataset.path,!getPath(b.dataset.path));render();break;
    case "habit":var hd=day(b.dataset.d);hd.habits[b.dataset.h]=!hd.habits[b.dataset.h];render();break;
    case "line-add":var arr=getPath(b.dataset.path);arr.push({t:"",done:false});render(b.dataset.path.replace(/\W/g,"_")+"_"+(arr.length-1));break;
    case "todo":S._todoOpen=!S._todoOpen;if(S._todoOpen&&!S.todo.length)S.todo.push({t:"",done:false});render(S._todoOpen&&S.todo.length===1&&!S.todo[0].t?"todo_0":null);break;
    case "todo-clear":S.todo=S.todo.filter(function(x){return !x.done});render();break;
    case "ink-add":var ia=getPath(b.dataset.path);ia.push({t:"",done:false,ink:[]});render();var st=document.querySelectorAll('canvas.strip[data-ink="'+b.dataset.path+'.'+(ia.length-1)+'"]')[0];if(st)st.scrollIntoView({block:"nearest"});break;
    case "ink-undo":var il=getPath(b.dataset.path);if(il&&il.ink){il.ink.pop();render()}break;
    case "list-new":S.lists.push({name:"",items:[{t:"",done:false}]});render("ln_"+(S.lists.length-1));break;
    case "list-del":S._delList=+b.dataset.i;render();break;
    case "list-del-yes":S.lists.splice(+b.dataset.i,1);S._delList=null;render();break;
    case "list-del-no":S._delList=null;render();break;
    case "list-clear":var LL=S.lists[+b.dataset.i];LL.items=LL.items.filter(function(x){return !x.done});render();break;
    case "line-del":getPath(b.dataset.path).splice(+b.dataset.i,1);render();break;
    case "pencil":S.pencil=!S.pencil;render();break;
    case "mark-ok":case "mark-no":var ms=document.getElementById("marks")._marks||[],m=ms[+b.dataset.i];if(!m)break;S.dismissed.push(m.id);if(a==="mark-ok"&&m.accept)m.accept();render();break;
    case "pen":pen.on=!pen.on;render();break;
    case "pencolor":pen.color=b.dataset.c;pen.tool="pen";render();break;
    case "penclear":S._clearInk=true;render();break;
    case "suggest":S._sug=draft();render();break;
    case "sug-close":S._sug=null;render();break;
    case "sug-add":var dd=day(S.cursor);document.querySelectorAll("[data-sug]").forEach(function(c){if(c.checked)dd.lines.push({t:S._sug[+c.dataset.sug],done:false})});S._sug=null;render();break;
    case "circle":var it=S.clearing[+b.dataset.i];it.real=!it.real;render();break;
    case "route":var r=S.clearing.splice(+b.dataset.i,1)[0],wk=week(mon(S.cursor)),slot=wk.willdo.filter(function(x){return !x.t})[0];
      if(slot){slot.t=r.t;toast("routed to this week's three")}else{day(S.cursor).lines.push({t:r.t,done:false});toast("the three were full. it went on "+fmtShort(S.cursor))}render();break;
    case "cl-del":S.clearing.splice(+b.dataset.i,1);render();break;
    case "arctab":S.archiveTab=b.dataset.t;render();break;
    case "ar-del":arc(S.archiveTab).splice(+b.dataset.i,1);render();break;
    case "reset-ask":S._confirm=true;render();break;
    case "reset-no":S._confirm=false;render();break;
    case "reset-yes":var keep=S.owner;S=blank();S.owner=keep;save();persist();render();break;
  }
});
var sw=null;
document.addEventListener("pointerdown",function(e){var t=e.target;if(e.pointerType!=="mouse"&&t.matches&&t.matches('.line input[type=text][data-path$=".t"]'))sw={el:t,x:e.clientX,y:e.clientY};else sw=null},true);
document.addEventListener("pointerup",function(e){if(!sw)return;var dx=e.clientX-sw.x,dy=Math.abs(e.clientY-sw.y),el=sw.el;sw=null;
  if(Math.abs(dx)>50&&dy<22&&el.value.trim()){var dp=el.dataset.path.replace(/\.t$/,".done");setPath(dp,!getPath(dp));el.blur();render()}},true);
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&S._todoOpen){S._todoOpen=false;render()}});
document.addEventListener("input",function(e){if(e.target.id==="q"){var q=e.target.value;S._q=q;if(q.trim().length>=2){if(S.view!=="search"){S._back=S.view;S.view="search"}render()}else if(S.view==="search"){S.view=S._back||"day";render()}return}var p=e.target.dataset&&e.target.dataset.path;if(p&&e.target.type!=="checkbox")setPath(p,e.target.value)});
document.addEventListener("change",function(e){if(e.target.dataset&&e.target.dataset.path&&e.target.type!=="checkbox")renderMarks()});
document.addEventListener("keydown",function(e){
  if(e.key!=="Enter")return;var t=e.target,en=t.dataset&&t.dataset.enter;if(!en)return;e.preventDefault();
  if(en==="add"){var p=t.dataset.path.split("."),i=+p[p.length-2],base=p.slice(0,-2).join("."),arr=getPath(base);arr.splice(i+1,0,{t:"",done:false});render(base.replace(/\W/g,"_")+"_"+(i+1))}
  else if(en==="clear"&&t.value.trim()){S.clearing.push({t:t.value.trim(),real:false});render("clnew")}
  else if(en==="arcnew"&&t.value.trim()){arc(S.archiveTab).push({t:t.value.trim(),done:false});render("arnew")}
  else if(en==="arc"){render()}
});
window.addEventListener("pagehide",function(){persist();if(window.sync)window.sync.flush()});
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden"){persist();if(window.sync)window.sync.flush()}else if(window.sync&&window.sync.user())window.sync.pull().catch(function(){})});
/* ---------- sync (only when app/config.js holds real Supabase values) ---------- */
window.applyPlannerState=function(st){if(!st||typeof st!=="object")return;S=Object.assign(blank(),st);S._sug=null;S._confirm=false;S._clearInk=false;S._q="";S._delList=null;S._todoOpen=false;save({fromSync:true});persist();render()};
window.getPlannerState=function(){return S};
window.addEventListener("dayscript-sync-ready",function(){
  var cfg=window.DAYSCRIPT_CONFIG;if(!cfg||!/^https:\/\/[a-z0-9-]+\.supabase\.co/.test(cfg.SUPABASE_URL||"")||/paste-anon-key/.test(cfg.SUPABASE_ANON_KEY||""))return;
  var ui=null;
  window.sync=createSync({supabaseUrl:cfg.SUPABASE_URL,supabaseAnonKey:cfg.SUPABASE_ANON_KEY,getState:window.getPlannerState,applyState:window.applyPlannerState,
    onStatus:function(st,d){if(ui)ui.onStatus(st,d);if(st==="conflict-resolved"&&d&&d.outcome==="server-won"&&ui)ui.say("updated from your other device")}});
  function mount(){var a=document.getElementById("cover-actions");if(!a||a.firstChild||!window.mountSyncUI)return;ui=mountSyncUI({sync:window.sync,anchor:a});ui.onStatus(window.sync.status)}
  mount();window.remountSync=mount;
});
render();
})();
