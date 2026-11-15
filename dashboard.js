/* YorpHives Headquarters — local-first front end. No autonomous execution. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PAGES = {home:'Home', discover:'Discover', team:'AI Employees', decisions:'Decisions', growth:'Growth', control:'HQ Control'};
  const DEPARTMENTS = [
    {name:'Engineering & Operations',short:'EO',job:'Website health & engineering',review:'Security & Independent QA'},
    {name:'Research & Innovation',short:'RI',job:'Tools & emerging technology',review:'Engineering & Operations'},
    {name:'Global Market Intelligence',short:'MI',job:'Markets & customer needs',review:'Product & Growth'},
    {name:'Product & Growth',short:'PG',job:'Products & adoption',review:'Global Market Intelligence'},
    {name:'Revenue & Business',short:'RB',job:'Revenue & monetization',review:'Security & Independent QA'},
    {name:'Security & Independent QA',short:'QA',job:'Security & independent review',review:'Founder'}
  ];
  const CATEGORIES = [['all','All'],['apps','Apps & tools'],['technology','Technology'],['markets','Markets'],['competitors','Competitors'],['revenue','Revenue']];
  const TRANSITIONS = {proposed:['accepted','rejected','snoozed'],accepted:['implemented','rejected','snoozed'],implemented:['verified','accepted'],verified:['proposed'],rejected:['proposed'],snoozed:['proposed']};
  const STATE_LABELS = {proposed:'Proposed',accepted:'Accepted',implemented:'Implemented',verified:'Outcome recorded',rejected:'Rejected',snoozed:'Paused'};
  const EMPTY = () => ({schemaVersion:'yorphives.hq-intelligence.v1',assets:[],products:[],findings:[],opportunities:[],activity:[],changes:[],comparisons:[],securityWatch:[],agents:[],operating:{queue:[],threads:[],pending:null,activeOpportunities:null,aiStatus:'Not connected'},decisionJournal:{available:false,events:[]},resourceBudget:{publicFetches:{used:null,limit:900}},verification:{complete:false}});
  const store = {get:(k,fallback)=>{try{return JSON.parse(localStorage.getItem('yh-ui:'+k))??fallback;}catch{return fallback;}},set:(k,v)=>{try{localStorage.setItem('yh-ui:'+k,JSON.stringify(v));}catch{}}};
  const sessionSaved=()=>{try{const x=JSON.parse(sessionStorage.getItem('yh:saved')||'[]');return Array.isArray(x)?x.filter(y=>typeof y==='string').slice(0,500):[];}catch{return [];}};
  const state = {
    page: PAGES[location.hash.slice(1)] ? location.hash.slice(1) : 'home', data:EMPTY(), source:'preview',
    navHistory:[], homeFilter:'all', pulseQuery:'', discoverFilter:'all', discoverQuery:'', discoverSort:'newest', savedOnly:false,
    discoverSource:'hq', githubQuery:'', githubResults:[], githubLoading:false, githubSearched:false, githubError:'', githubSearchedQuery:'', githubTotal:0, githubIncomplete:false, githubSort:'stars',githubFilter:'all',githubSavedOnly:false,
    productFilter:'all', productQuery:'', decisionFilter:'all', busy:false, detail:null,
    compact:store.get('compact',false) === true, alerts:store.get('alerts',false) === true,
    saved:new Set(sessionSaved()), pulse:[], searchQuery:'', saving:false,
    githubSaved:new Map((()=>{try{const x=JSON.parse(sessionStorage.getItem('yh:github-saved')||'[]');return Array.isArray(x)?x.filter(t=>Array.isArray(t)&&typeof t[0]==='string'&&t[1]&&typeof t[1]==='object').slice(0,60):[];}catch{return [];}})())
  };
  let lastFocus=null, toastTimer, lastHighKey='', lastLiveFetch=0;
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#ic-${name}"/></svg>`;
  const list = (d,key) => Array.isArray(d?.[key]) ? d[key] : [];
  const cut = (s,n=115) => String(s??'').slice(0,n);
  const filled = v => v!==undefined && v!==null && v!=='';
  const num = v => state.source!=='preview' && filled(v) && Number.isFinite(Number(v)) ? Number(v).toLocaleString() : '—';
  const date = v => {const ms=Date.parse(v||'');return Number.isFinite(ms)?new Date(ms).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'—';};
  const time = v => {const ms=Date.parse(v||'');return Number.isFinite(ms)?new Date(ms).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—';};
  const today = () => new Date().toISOString();
  const badge = (s,t='plain') => `<span class="tag tag-${t}">${esc(s)}</span>`;
  const ready = () => state.source !== 'preview';
  const website = () => list(state.data,'assets').find(x=>x.kind==='website');
  const hqState=()=>state.source==='live'?state.data.hqHealth:null;
  const hqLabel=()=>hqState()?.status==='responding'?'Responding':hqState()?.status==='delayed'?'Delayed':'Not verified';
  const status = x => ({healthy:'HTTP OK',reachable:'HTTP OK',degraded:'Needs review',unknown:'Unknown'})[x]||'Unknown';
  const header=(t,s,act='')=>`<header class="page-header"><div><h1>${esc(t)}</h1><p>${esc(s)}</p></div>${act?`<div class="header-action">${act}</div>`:''}</header>`;
  const button=(id,label,iconName,cls='button-subtle',extra='')=>`<button type="button" class="button ${cls}" data-action="${esc(id)}" ${extra}>${icon(iconName)} ${esc(label)}</button>`;
  const importButton=()=>button('import','Open report','upload');
  const exportButton=()=>button('export-report','Export report','upload','button-subtle',!ready()?'disabled title="No report loaded"':'');
  const blank=(name,hint='')=>`<div class="blank"><span class="blank-icon">${icon('info')}</span><strong>${esc(name)}</strong>${hint?`<small>${esc(hint)}</small>`:''}</div>`;
  const card=(title,body,extra='',classes='')=>`<section class="panel ${classes}"><div class="panel-top"><h2>${esc(title)}</h2>${extra}</div>${body}</section>`;
  const stat=(t,v,n,mark)=>`<article class="stat"><span class="stat-top"><span>${esc(t)}</span>${icon(mark)}</span><strong>${esc(String(v??'—'))}</strong><small>${esc(n)}</small></article>`;
  const homeStat=(t,v,n,mark,to)=>`<button type="button" class="stat stat-action" data-page="${esc(to)}" aria-label="${esc(t+': '+String(v??'—')+'. Open '+PAGES[to])}"><span class="stat-top"><span>${esc(t)}</span>${icon(mark)}</span><strong>${esc(String(v??'—'))}</strong><small>${esc(n)}</small></button>`;
  const navlink=(to,label)=>`<button class="text-action" type="button" data-page="${esc(to)}">${esc(label)} ${icon('arrow')}</button>`;
  const provenance=()=>{const labels={preview:['Preview','No live evidence','neutral'],live:['Live report','HTTP evidence','green'],imported:['Imported report','Local only','amber'],stale:['Stale report','Refresh failed','amber']};const [name,sub,color]=labels[state.source];return `<div class="provenance"><span class="provenance-main"><span class="provenance-dot ${color}"></span><strong>${name}</strong><span>${sub}</span></span><small>${ready()?`Updated ${esc(time(state.data.generatedAt||state.data.briefing?.generatedAt))}`:'Not connected'}</small></div>`;};
  const link = raw => {try{const x=new URL(String(raw));return ['https:','http:'].includes(x.protocol)&&!x.username&&!x.password?x.href:null;}catch{return null;}};
  const sortDate = x => {const n=Date.parse(x||'');return Number.isFinite(n)&&n<=Date.now()?n:0;};
  const files = kind => ({finding:'findings',opportunity:'opportunities',product:'products',comparison:'comparisons',change:'changes',activity:'activity',security:'securityWatch'})[kind];
  const row=(x,kind,id,sub='')=>`<button type="button" class="record-row" data-detail="${esc(kind)}" data-id="${esc(id)}"><span class="record-copy"><strong>${esc(cut(x.title||x.name||'Untitled',130))}</strong>${sub?`<small>${esc(sub)}</small>`:''}</span><span class="record-end">${icon('chevron')}</span></button>`;
  const tab=(name,id,current,group)=>`<button class="filter ${id===current?'selected':''}" type="button" data-${group}="${esc(id)}" aria-pressed="${id===current}">${esc(name)}</button>`;
  const safeKey=(kind,id)=>`${kind}:${id}`;
  function records() {
    const d=state.data;
    const normalize=(kind,arr,timeField)=>arr.map((x,i)=>({...x,_kind:kind,_key:`${kind}:${filled(x.id)?x.id:'at-'+i}`,_id:filled(x.id)?x.id:'at-'+i,_date:x[timeField]||x.observedAt||x.occurredAt||''}));
    return [
      ...normalize('finding',list(d,'findings'),'observedAt'),
      ...normalize('opportunity',list(d,'opportunities'),'observedAt'),
      ...normalize('change',list(d,'changes'),'occurredAt'),
      ...normalize('activity',list(d,'activity'),'occurredAt')
    ].sort((a,b)=>sortDate(b._date)-sortDate(a._date));
  }
  function pulseItems(){state.pulse=records().slice(0,20);return state.pulse.filter(x=>state.homeFilter==='all'|| (state.homeFilter==='alerts'&&x._kind==='finding') || (state.homeFilter==='research'&&x._kind==='opportunity') || (state.homeFilter==='changes'&&['change','activity'].includes(x._kind)));}
  function queue(){return list(state.data.operating,'queue').slice(0,3);}
  function latestJournal(){const map=new Map();for(const x of [...list(state.data.decisionJournal,'events')].sort((a,b)=>(Number(b.sequence)||0)-(Number(a.sequence)||0))){if(!map.has(x.thread))map.set(x.thread,x);}return map;}
  function asRecord(queueItem){const kind=queueItem.type==='opportunity'?'opportunity':'finding';return list(state.data,files(kind)).find(x=>String(x.id)===String(queueItem.id))||queueItem;}
  function permittedDecision(item,kind){const thread=`${kind}:${item.id}`;const event=latestJournal().get(thread);const previous=event?.state||'proposed';return {thread,event,previous,revision:Number(event?.revision??item.revision??0),actions:TRANSITIONS[previous]||[]};}
  function canDecide(){return state.source==='live'&&state.data.decisionJournal?.available===true;}
  function home(){
    const d=state.data, q=queue(), raw=pulseItems(), search=state.pulseQuery.trim().toLowerCase();
    const pulse=raw.filter(x=>!search||[x.title,x.summary,x.description,x.asset,x._kind].some(v=>String(v||'').toLowerCase().includes(search)));
    const counts={all:state.pulse.length,alerts:state.pulse.filter(x=>x._kind==='finding').length,research:state.pulse.filter(x=>x._kind==='opportunity').length,changes:state.pulse.filter(x=>['change','activity'].includes(x._kind)).length};
    const s=state.source==='live'?status(website()?.status):state.source==='stale'?'Stale':state.source==='imported'?'Imported':'—';
    const pulseBlock=pulse.length?pulse.map(x=>{const i=state.pulse.indexOf(x);return `<button type="button" class="pulse-row" data-detail="pulse" data-id="${i}"><span class="pulse-symbol">${icon(x._kind==='finding'?'shield':x._kind==='opportunity'?'compass':'clock')}</span><span class="pulse-text"><strong>${esc(cut(x.title||x.summary||'Update',105))}</strong><small>${esc(x._kind==='finding'?'Alert':x._kind==='opportunity'?'Research':'Update')}</small></span><span class="pulse-date">${date(x._date)}</span></button>`;}).join(''):blank('No matching updates');
    return header('Home','Status · decisions · activity','<a class="button button-subtle" href="https://yorphives.com/" target="_blank" rel="noopener noreferrer" aria-label="Open YorpHives website">Website ↗</a>')+provenance()+
      `<div class="stat-grid four">${homeStat('YorpHives.com',s,'HTTP check','shield','control')}${homeStat('Headquarters',hqLabel(),'API · DB · scheduler','clock','control')}${homeStat('To review',num(d.operating?.pending),'Recommendations','check','decisions')}${homeStat('Research',ready()?list(d,'opportunities').length:'—','Unverified leads','compass','discover')}</div>`+
      `<div class="shortcut-row">${navlink('discover','Discover')}${navlink('team','AI Employees')}${navlink('decisions','Decisions')}${navlink('growth','Growth')}</div>`+
      `<div class="content-grid home-grid">${card('YH Pulse',`<div class="filter-scroller compact-tabs">${[['all','All'],['alerts','Alerts'],['research','Research'],['changes','Changes']].map(([id,n])=>tab(n+' '+counts[id],id,state.homeFilter,'pulse-filter')).join('')}</div><div class="pulse-tools"><label class="inline-search pulse-search">${icon('search')}<input id="pulse-query" type="search" placeholder="Search updates" aria-label="Search YH Pulse" value="${esc(state.pulseQuery)}"/></label>${search?button('clear-pulse-search','Clear','close'):''}<small class="pulse-count" role="status">${pulse.length} / ${state.pulse.length}</small></div><div class="pulse-list scroll-region" role="region" tabindex="0" aria-label="YH Pulse updates">${pulseBlock}</div>`,badge('LATEST 20'))}`+
      `<div class="vertical-stack">${card('Priorities',q.length?`<div class="record-list">${q.map((x,i)=>row(asRecord(x),'review',i,x.contract?.classification||x.status||'Review')).join('')}</div>`:blank('No recommendations'),badge('TOP 3')+navlink('decisions','Open'))}`+
      `${card('Quick actions',`<div class="quick-grid">${button('import','Open report','upload')}${exportButton()}${button('copy-summary','Copy status','file')}${button('refresh','Refresh','refresh')}</div>`)}</div></div>`;
  }
  function discoveryItems(){const d=state.data;const items=[];
    list(d,'products').forEach((x,i)=>items.push({...x,_kind:'product',_id:filled(x.id)?x.id:'at-'+i,_category:'apps',_date:x.firstSeen||x.lastChecked||''}));
    list(d,'comparisons').forEach((x,i)=>items.push({...x,_kind:'comparison',_id:filled(x.id)?x.id:'at-'+i,_category:'competitors',_date:x.observedAt||'',title:x.competitor||x.product||'Comparison'}));
    list(d,'opportunities').forEach((x,i)=>{const c=String(x.category||'').toLowerCase();const group=c==='technology'?'technology':c==='revenue'?'revenue':c==='product'?'apps':c==='market'||c==='markets'?'markets':'markets';items.push({...x,_kind:'opportunity',_id:filled(x.id)?x.id:'at-'+i,_category:group,_date:x.observedAt||''});});
    return items;
  }
  function savedKey(x){return safeKey(x._kind,x._id);}
  function discover(){
    if(state.discoverSource==='github')return discoverOnline();
    const all=discoveryItems();let filtered=all.filter(x=>(state.discoverFilter==='all'||state.discoverFilter===x._category) && (!state.savedOnly||state.saved.has(savedKey(x))) && `${x.title||x.name||''} ${x.description||''} ${x.evidenceSummary||''}`.toLowerCase().includes(state.discoverQuery.toLowerCase()));
    filtered.sort(state.discoverSort==='name'?(a,b)=>String(a.title||a.name).localeCompare(String(b.title||b.name)):(a,b)=>sortDate(b._date)-sortDate(a._date));
    const cards=filtered.map(x=>`<article class="lead-card"><div class="lead-top">${badge(x._kind==='product'?'Site inventory':x._kind==='comparison'?'Comparison':'Research')}<button type="button" class="save-btn ${state.saved.has(savedKey(x))?'is-saved':''}" data-save-kind="${esc(x._kind)}" data-save-id="${esc(x._id)}" aria-pressed="${state.saved.has(savedKey(x))}" aria-label="${state.saved.has(savedKey(x))?'Remove saved item':'Save item'}">${state.saved.has(savedKey(x))?'★':'☆'}</button></div><button class="lead-body" type="button" data-detail="${esc(x._kind)}" data-id="${esc(x._id)}"><strong>${esc(cut(x.title||x.name||'Item',100))}</strong><small>${esc(cut(x.description||x.evidenceSummary||x.qaReason||'Review evidence',110))}</small><span class="lead-footer">Details ${icon('arrow')}</span></button></article>`).join('');
    const purpose=[['apps','Apps & tools','Open-source candidates','compass'],['technology','Technology','Models & standards','spark'],['markets','Markets','Customer needs','users'],['competitors','Competitors','Product comparisons','chart'],['revenue','Revenue','Business models','check']];
    return header('Discover','Tools · markets · opportunities',importButton())+provenance()+discoverSourceTabs()+
      `<div class="filter-scroller">${CATEGORIES.map(([id,n])=>tab(n,id,state.discoverFilter,'discover-filter')).join('')}</div>`+
      `<div class="toolbar"><label class="inline-search">${icon('search')}<input id="discover-query" type="search" placeholder="Search discoveries" value="${esc(state.discoverQuery)}" aria-label="Search discoveries" /></label><select id="discover-sort" class="select" aria-label="Sort discoveries"><option value="newest" ${state.discoverSort==='newest'?'selected':''}>Newest</option><option value="name" ${state.discoverSort==='name'?'selected':''}>A–Z</option></select><button type="button" class="button ${state.savedOnly?'button-active':'button-subtle'}" data-action="toggle-saved" aria-pressed="${state.savedOnly}">☆ Saved</button></div>`+
      (all.length?`<div class="lead-grid scroll-grid" role="region" tabindex="0" aria-label="Discovered tools and opportunities">${cards||blank('No matching items')}</div>`:`<div class="purpose-grid">${purpose.filter(x=>state.discoverFilter==='all'||state.discoverFilter===x[0]).map(([id,n,s,i])=>`<button type="button" class="purpose-card purpose-button" data-discover-filter="${esc(id)}"><span class="purpose-icon">${icon(i)}</span><h2>${esc(n)}</h2><p>${esc(s)}</p></button>`).join('')}</div>`)+
      `<div class="page-footnote">${all.length?`${filtered.length} shown · `:''}Research is not validated demand.</div>`;
  }

  function discoverSourceTabs(){
    return `<div class="discover-sources" role="group" aria-label="Research source">${tab('HQ records','hq',state.discoverSource,'discover-source')}${tab('Find open source','github',state.discoverSource,'discover-source')}</div>`;
  }
  function githubCandidates(){
    if(!state.githubSavedOnly)return state.githubResults;
    const all=new Map([...state.githubResults.map(x=>[x.id,x]),...state.githubSaved]);
    return [...all.values()].filter(x=>state.githubSaved.has(x.id));
  }
  function discoverOnline(){
    const all=githubCandidates();
    const filtered=all.filter(x=>state.githubFilter==='all'||x.category===state.githubFilter);
    filtered.sort(state.githubSort==='name'?(a,b)=>String(a.title).localeCompare(String(b.title)):
      state.githubSort==='stars'?(a,b)=>(b.stars||0)-(a.stars||0):
      (a,b)=>sortDate(b.updatedAt)-sortDate(a.updatedAt));
    const cards=filtered.map(x=>`<article class="lead-card"><div class="lead-top">${badge(x.category==='technology'?'Technology · GitHub':'App · GitHub')}<button type="button" class="save-btn ${state.githubSaved.has(x.id)?'is-saved':''}" data-github-save="${esc(x.id)}" aria-pressed="${state.githubSaved.has(x.id)}" aria-label="${state.githubSaved.has(x.id)?'Remove saved project':'Save project'}">${state.githubSaved.has(x.id)?'★':'☆'}</button></div><button type="button" class="lead-body" data-detail="github" data-id="${esc(x.id)}"><strong>${esc(cut(x.title,100))}</strong><small>${esc(cut(x.description||'Public repository · description unavailable',140))}</small><span class="lead-meta">${esc(x.license||'License unverified')} · ★ ${num(x.stars)}</span><span class="lead-footer">Details ${icon('arrow')}</span></button></article>`).join('');
    const empty=state.githubLoading?blank('Searching…'):state.githubSavedOnly?blank('No saved projects'):
      state.githubSearched?blank('No matching projects','Try another topic or filter.'):
      blank('Find an open-source project','Enter a topic and search.');
    const notice=state.githubError?`<strong class="discover-error">${esc(state.githubError)}</strong>`:
      state.githubLoading?'Searching public GitHub repositories…':
      state.githubSearched?`${num(state.githubTotal)} public matches · ${filtered.length} shown${state.githubIncomplete?' · Partial results':''}`:
      'Direct public GitHub search · No account or payment';
    return header('Discover','Find · assess · save',importButton())+provenance()+discoverSourceTabs()+
      `<form id="github-search-form" class="discover-search-form"><label class="inline-search">${icon('search')}<input id="github-query" type="search" value="${esc(state.githubQuery)}" maxlength="64" aria-label="Search public GitHub repositories" placeholder="e.g. PDF editor" /></label><button type="submit" class="button button-primary discover-submit" ${state.githubLoading?'disabled':''}>${icon('search')} ${state.githubLoading?'Searching…':'Find projects'}</button></form>`+
      `<div class="discover-controls"><div class="filter-scroller compact-tabs">${[['all','All'],['apps','Apps & tools'],['technology','Technology']].map(([id,name])=>tab(name,id,state.githubFilter,'github-filter')).join('')}</div><select id="github-sort" class="select" aria-label="Sort public projects"><option value="stars" ${state.githubSort==='stars'?'selected':''}>Stars</option><option value="newest" ${state.githubSort==='newest'?'selected':''}>Recently updated</option><option value="name" ${state.githubSort==='name'?'selected':''}>A–Z</option></select>${button('github-saved',state.githubSavedOnly?'★ Saved':'☆ Saved','check',state.githubSavedOnly?'button-active':'button-subtle')}${button('github-export','Export shortlist','upload','button-subtle',state.githubSaved.size?'':'disabled title="Save a project first"')}${state.githubQuery?button('github-clear','Clear','close'):''}</div>`+
      `<div class="discover-live-status" role="status" aria-live="polite">${notice}</div><div class="lead-grid scroll-grid" role="region" tabindex="0" aria-label="Public open-source project results">${cards||empty}</div>`+
      `<div class="page-footnote">Public GitHub metadata · License, code safety, demand and reuse rights unverified. Saved locally in this tab.</div>`;
  }
  async function searchGithub(){
    if(state.githubLoading)return;
    const q=state.githubQuery.normalize('NFKC').trim().replace(/\s+/g,' ');
    if(!/^[\p{L}\p{N} ._-]{2,64}$/u.test(q)||q.split(/\s+/).length>8){
      state.githubError='Enter 2–64 letters or numbers, up to 8 words.';render();return;
    }
    state.githubError='';state.githubResults=[];state.githubSearched=false;state.githubTotal=0;state.githubSavedOnly=false;state.githubLoading=true;render();
    try{
      const reply=await fetch('/api/discover?q='+encodeURIComponent(q),{
        credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});
      const data=await reply.json().catch(()=>({}));
      if(!reply.ok)throw Error(data.error||'Search unavailable');
      if(data.source!=='github-public'||!Array.isArray(data.items))throw Error('Invalid search response');
      state.githubResults=data.items.slice(0,12).filter(x=>typeof x.id==='string'&&/^[\w.-]+\/[\w.-]+$/.test(x.id)).map(x=>({
        id:x.id,title:String(x.title||x.id),description:String(x.description||'').slice(0,280),
        url:'https://github.com/'+x.id,license:typeof x.license==='string'?x.license:null,
        stars:Number.isSafeInteger(x.stars)?x.stars:0,category:x.category==='technology'?'technology':'apps',
        updatedAt:String(x.updatedAt||''),language:String(x.language||''),source:'github-public'}));
      state.githubTotal=Math.max(0,Number(data.total)||0);
      state.githubIncomplete=data.incomplete===true;state.githubSearched=true;
      state.githubSavedOnly=false;notify(state.githubResults.length?'Projects found':'No matching projects');
    }catch(e){state.githubError=String(e.message||'Search unavailable').slice(0,180);notify('Search unavailable');}
    finally{state.githubLoading=false;if(state.page==='discover')render();}
  }

  function assignmentFor(name){const threads=list(state.data.operating,'threads');return threads.filter(x=>x.contract?.owner===name);}
  function team(){const statusText=ready()?state.data.operating?.aiStatus||'Not connected':'Not connected';return header('AI Employees','Six departments · evidence routing')+provenance()+
    `<div class="compact-info">${icon('info')} AI inference: ${esc(statusText)}</div>`+
    `<div class="team-grid">${DEPARTMENTS.map((x,i)=>`<button class="member-card" type="button" data-detail="department" data-id="${i}"><span class="member-avatar">${esc(x.short)}</span><span class="member-text"><strong>${esc(x.name)}</strong><small>${esc(x.job)}</small><span class="member-status">${assignmentFor(x.name).length} routed records · Not proof of AI execution</span></span>${icon('chevron')}</button>`).join('')}</div>`+
    `${card('Workflow',`<div class="steps"><span>Observe</span>${icon('arrow')}<span>Investigate</span>${icon('arrow')}<span>Review</span>${icon('arrow')}<span>Recommend</span>${icon('arrow')}<span>Founder</span></div>`)}`+
    `<div class="page-footnote">No autonomous deployment or payment.</div>`;}
  function decisions(){const d=state.data,q=queue(),journal=list(d.decisionJournal,'events'),latest=latestJournal(),threads=list(d.operating,'threads');
    const filtered=threads.filter(x=>state.decisionFilter==='all'||(state.decisionFilter==='pending'?x.needsDecision:x.status===state.decisionFilter));
    return header('Decisions','Approve · track · verify', journal.length?button('export-decisions','Export history','upload'):'' )+provenance()+
      `<div class="stat-grid three">${stat('To review',num(d.operating?.pending),'Top 3','check')}${stat('Active',num(d.operating?.activeOpportunities),'Limit: 3','compass')}${stat('History',ready()&&d.decisionJournal?.available?journal.length:'—','Journal entries','clock')}</div>`+
      `<div class="content-grid equal">${card('Review queue',q.length?`<div class="record-list">${q.map((x,i)=>row(asRecord(x),'review',i,x.contract?.freshness||x.status||'Review')).join('')}</div>`:blank('No recommendations'),badge('TOP 3'))}`+
      `${card('Recent decisions',journal.length?`<div class="record-list scroll-region" role="region" tabindex="0" aria-label="Recent decisions">${journal.slice(0,12).map(x=>row(x,'decision',x.sequence??x.thread,STATE_LABELS[x.state]||x.state)).join('')}</div>`:blank('No saved decisions'), badge(canDecide()?'Connected':'Read-only'))}</div>`+
      `${threads.length?card('All threads',`<div class="filter-scroller compact-tabs">${[['all','All'],['pending','To review'],['accepted','Accepted'],['implemented','Implemented'],['verified','Verified']].map(([id,n])=>tab(n,id,state.decisionFilter,'decision-filter')).join('')}</div><div class="record-list scroll-region" role="region" tabindex="0" aria-label="Decision threads">${filtered.slice(0,60).map(x=>row(asRecord(x),'thread',x.thread,STATE_LABELS[x.status]||x.status||'Proposed')).join('')||blank('No matches')}</div>`, badge(`${filtered.length} THREADS`)):''}`+
      `<div class="page-footnote">Accepting a recommendation never deploys changes.</div>`;
  }
  function growth(){const d=state.data;const all=list(d,'products');const visible=all.filter(x=>(state.productFilter==='all'||(state.productFilter==='published'&&x.discoveryConfidence==='published')||(state.productFilter==='candidate'&&x.discoveryConfidence==='candidate'))&&`${x.name||''} ${x.url||''}`.toLowerCase().includes(state.productQuery.toLowerCase()));
    return header('Growth','Traffic · products · revenue')+provenance()+
      `<div class="stat-grid four">${stat('Visitors','—','No analytics','users')}${stat('Revenue','—','No verified source','chart')}${stat('Products',ready()?all.length:'—','Inventory may be partial','compass')}${stat('Conversion','—','No analytics','check')}</div>`+
      `<div class="content-grid equal">${card('Products',`<div class="toolbar small-toolbar"><label class="inline-search">${icon('search')}<input id="product-query" type="search" placeholder="Find product" aria-label="Search products" value="${esc(state.productQuery)}"/></label><select id="product-filter" class="select" aria-label="Product filter"><option value="all">All</option><option value="published" ${state.productFilter==='published'?'selected':''}>Published routes</option><option value="candidate" ${state.productFilter==='candidate'?'selected':''}>Candidates</option></select></div><div class="record-list scroll-region" role="region" tabindex="0" aria-label="Product inventory">${visible.slice(0,60).map((x,i)=>row(x,'product',filled(x.id)?x.id:'at-'+all.indexOf(x),x.discoveryConfidence||'Unverified')).join('')||blank('No products')}</div><small class="minor">${all.length?`${visible.length} shown · `:''}HTTP status is not a tool functionality test.</small>`)}`+
      `<div class="vertical-stack">${card('Audience',blank('Not connected','Visitors · engagement'))}${card('Revenue',blank('Not connected','Verified earnings'))}${card('Opportunities',`<div class="record-list">${list(d,'opportunities').slice(0,5).map((x,i)=>row(x,'opportunity',filled(x.id)?x.id:'at-'+i,x.category||'Research')).join('')||blank('No leads')}</div><div class="panel-footer">${navlink('discover','Discover')}</div>`)}</div></div>`;
  }
  function control(){const d=state.data,b=d.resourceBudget?.publicFetches||{},rawUsed=b.used,budgetUsed=ready()&&filled(rawUsed)&&Number.isFinite(Number(rawUsed))?Math.max(0,Number(rawUsed)):null,limit=Number(b.limit)>0?Number(b.limit):900;
    const h=hqState();
    const checked=d.briefing?.site?.lastCheck;
    const tiles=[['YorpHives.com',ready()?status(website()?.status):'Unknown','shield'],
      ['Website check',checked?time(checked):'Not verified','clock'],
      ['Headquarters',hqLabel(),'shield'],
      ['HQ API',h?.api==='responding'?'Responding':'Not verified','link'],
      ['HQ database',h?.database==='responding'?'Responding':'Not verified','chart'],
      ['HQ scheduler',h?.collector==='current'?'Current':h?.collector==='stale'?'Delayed':'Not verified','clock'],
      ['Last HQ check',h?.lastCollectorCheck?time(h.lastCollectorCheck):'Not verified','clock'],
      ['AI inference',d.operating?.aiStatus||'Not connected','users']];
    return header('HQ Control','Site · HQ · security',importButton())+provenance()+
      `<div class="system-grid">${tiles.map(([name,v,i])=>`<article class="system-card"><span class="system-icon">${icon(i)}</span><h2>${esc(name)}</h2><p>${esc(v)}</p></article>`).join('')}</div>`+
      `<div class="page-footnote">HQ checks: API · database · scheduler. <a href="https://github.com/solopreneursid/YorHives_Headquarters/actions/workflows/independent-health.yml" target="_blank" rel="noopener noreferrer">Independent checks ↗</a> (login gate only).</div>`+
      `<div class="content-grid equal">${card('Daily public requests',`<div class="budget-number"><strong>${budgetUsed===null?'—':budgetUsed.toLocaleString()}</strong><span>/ ${limit.toLocaleString()} GET</span></div><progress max="${limit}" value="${budgetUsed??0}" aria-label="Daily GET budget"></progress><small class="minor">Internal limit, not a billing guarantee.</small>`)}`+
      `${card('Permissions',`<div class="setting-list"><div><span>Agent code changes</span>${badge('Blocked','green')}</div><div><span>Agent payments</span>${badge('Blocked','green')}</div><div><span>Founder journal</span>${badge(canDecide()?'Available':'Unavailable',canDecide()?'green':'amber')}</div></div><small class="minor">Reported policy · verify runtime independently.</small>`)}`+
      `${card('Security advisories',list(d,'securityWatch').length?`<div class="record-list scroll-region" role="region" tabindex="0" aria-label="Security advisories">${list(d,'securityWatch').slice(0,10).map((x,i)=>row(x,'security',filled(x.id)?x.id:'at-'+i,'Applicability unverified')).join('')}</div>`:blank('No advisory records'))}`+
      `${card('Display & alerts',`<div class="setting-list"><label class="switch-row" for="compact-toggle"><span>Compact layout<small>Less spacing</small></span><input id="compact-toggle" type="checkbox" ${state.compact?'checked':''}></label><label class="switch-row" for="alerts-toggle"><span>Browser alerts<small>High priority · open tab</small></span><input id="alerts-toggle" type="checkbox" ${state.alerts?'checked':''}></label></div><div class="button-row">${exportButton()}${button('copy-summary','Copy status','file')}</div><small class="minor">Display settings stored in this browser only.</small>`)}</div>`;
  }
  const VIEWS={home,discover,team,decisions,growth,control};
  function render({keepFocus=false}={}){
    let focusId=null,start=null,end=null;
    if(keepFocus && document.activeElement?.id){focusId=document.activeElement.id;start=document.activeElement.selectionStart;end=document.activeElement.selectionEnd;}
    $('page-root').innerHTML=VIEWS[state.page]();
    $('current-page-label').textContent=PAGES[state.page];document.title='YorpHives HQ — '+PAGES[state.page];
    document.body.classList.toggle('compact-mode',state.compact);
    document.querySelectorAll('[data-page]').forEach(el=>{const active=el.dataset.page===state.page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    const back=state.navHistory.length>0||state.page!=='home';$('back-button').hidden=!back;$('mobile-back-button').hidden=!back;
    $('more-popover').hidden=true;$('more-button').setAttribute('aria-expanded','false');$('more-button').classList.toggle('active',['growth','control'].includes(state.page));
    const pending=state.data.operating?.pending;$('decision-count').hidden=!ready()||!Number.isInteger(pending)||pending<1;if(ready()&&Number.isInteger(pending)&&pending>0)$('decision-count').textContent=pending>99?'99+':String(pending);
    if(focusId && $(focusId)){try{$(focusId).focus();if(typeof start==='number')$(focusId).setSelectionRange(start,end);}catch{}}
  }
  function navigate(to,push=true){if(!PAGES[to])return; if(to!==state.page){state.navHistory.push(state.page);if(state.navHistory.length>30)state.navHistory.shift();state.page=to;}
    if(push&&location.hash!=='#'+to)history.pushState({hqPage:to},'','#'+to);render();window.scrollTo(0,0);}
  function goBack(){const prior=state.navHistory.pop()||'home';state.page=PAGES[prior]?prior:'home';history.replaceState({hqPage:state.page},'','#'+state.page);render();window.scrollTo(0,0);}
  function browserRoute(){const to=location.hash.slice(1);if(!PAGES[to]||to===state.page)return;state.navHistory.push(state.page);state.page=to;render();window.scrollTo(0,0);}
  function record(kind,id){if(kind==='department')return DEPARTMENTS[Number(id)]||null;if(kind==='github')return state.githubResults.find(x=>String(x.id)===String(id))||state.githubSaved.get(String(id))||null;if(kind==='pulse')return state.pulse[Number(id)]||null;if(kind==='review')return queue()[Number(id)]||null;
    if(kind==='thread')return list(state.data.operating,'threads').find(x=>x.thread===id)||null;
    if(kind==='decision')return list(state.data.decisionJournal,'events').find(x=>String(x.sequence??x.thread)===String(id))||null;
    const arr=list(state.data,files(kind));return arr.find(x=>String(x.id)===String(id))||(String(id).startsWith('at-')?arr[Number(id.slice(3))]:null)||null;}
  function sources(x,kind){const raw=[...(Array.isArray(x?.evidence)?x.evidence:[]),x.evidenceUrl,x.evidence_url,x.source_url,x.source,kind==='product'||kind==='github'?x.url:null];return [...new Set(raw.map(link).filter(Boolean))].slice(0,8);}
  function detailFields(items){return `<div class="detail-fields">${items.filter(([,v])=>filled(v)).map(([name,v])=>`<div class="detail-field"><small>${esc(name)}</small><p>${esc(String(v))}</p></div>`).join('')}</div>`;}
  function openDetail(kind,id){let x=record(kind,id);if(!x){notify('Record unavailable');return;}
    state.detail={kind,id};lastFocus=document.activeElement;
    let target=x,actualKind=kind,discussion='';
    if(kind==='review'||kind==='thread') {const k=(x.type||x.thread?.split(':')[0])==='opportunity'?'opportunity':'finding';target=asRecord({...x,type:k});actualKind=k;discussion=x.contract?.impact||'';}
    if(kind==='pulse')actualKind=x._kind;
    const title=target.title||target.name||target.competitor||x.title||'Details';
    const fields=kind==='department'?[['Responsibility',x.job],['Independent review',x.review],['Routed records',`${assignmentFor(x.name).length} (not proof of AI work)`],['AI inference',state.data.operating?.aiStatus||'Not connected']]:
      kind==='decision'?[['Status',STATE_LABELS[x.state]||x.state],['Date',time(x.created_at)],['Reason',x.note],['Feedback',x.feedback],['Success condition',x.success_condition],['Measured outcome',x.outcome]]:
       kind==='github'?[['Summary',x.description],['License',x.license||'Unverified'],['GitHub stars',String(x.stars??0)+' · popularity signal only'],['Primary language',x.language],['Updated',time(x.updatedAt)],['Review','Candidate only. Verify license, safety and suitability before reuse.']]:
      [['Summary',target.description||target.evidenceSummary||target.summary||discussion],['Recommendation',target.recommendation],['Priority',target.priority],['Evidence',x.contract?.classification||'Unverified'],['Confidence',target.confidence||target.discoveryConfidence],['Observed',time(target.observedAt||target._date||target.occurredAt)],['Source status',state.source==='live'?'Live report':'Not live-verified']];
    const urls=sources(target,actualKind);let extras='';
    if(kind==='department'){
      const tasks=assignmentFor(x.name);extras=card('Routed recommendations',tasks.length?`<div class="record-list">${tasks.slice(0,15).map(t=>row(asRecord(t),'thread',t.thread,t.status||'Review')).join('')}</div>`:blank('No routed records'),'','drawer-panel');
    }else if(kind==='decision'){
      const evidence=link(x.evidence_url);if(evidence)urls.push(evidence);extras=`<p class="minor">Stored founder decision · no automated execution</p>`;
    }else{
      const base=kind==='review'||kind==='thread'?x:(actualKind==='finding'||actualKind==='opportunity'?{id:target.id,type:actualKind}:null);
      if(base && filled(base.id))extras=renderDecisionEditor(base,actualKind);
    }
    $('detail-content').innerHTML=`<h2 id="detail-title">${esc(title)}</h2>${detailFields(fields)}`+
      (kind!=='department'?`<div class="detail-field"><small>Sources</small>${urls.length?`<ul class="source-links">${[...new Set(urls)].map(u=>`<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(cut(u,130))} ${icon('external')}</a></li>`).join('')}</ul>`:'<p>None linked</p>'}</div>`:'')+
      extras+`<div class="detail-buttons">${button('close-detail','Close','close')}</div>`;
    $('detail-drawer').hidden=false;$('detail-scrim').hidden=false;document.body.classList.add('drawer-open');$('detail-close').focus();
  }
  function renderDecisionEditor(item,kind){const d=permittedDecision(item,kind),live=canDecide(),stateNow=d.previous,actions=d.actions;
    const minDay=new Date(Date.now()+86400000).toISOString().slice(0,10);const maxDay=new Date(Date.now()+90*86400000).toISOString().slice(0,10);
    if(!live||!actions.length||!/^[-a-zA-Z0-9_]{1,80}$/.test(String(item.id||'')))return `<p class="drawer-note">${live?'No further transition available.':'Review only · Decision saving needs live founder access.'}</p>`;
    const exp=kind==='opportunity';
    return `<section class="decision-editor"><h3>Founder decision</h3><p class="minor">Current: ${esc(STATE_LABELS[stateNow]||stateNow)} · Records intent only</p>
      <form id="decision-form"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="id" value="${esc(item.id)}"><input type="hidden" name="revision" value="${d.revision}">
        <label for="decision-state">Next step</label><select id="decision-state" class="select" name="state" required><option value="">Select</option>${actions.map(s=>`<option value="${s}">${esc(STATE_LABELS[s])}</option>`).join('')}</select>
        <label for="decision-reason">Reason *</label><textarea id="decision-reason" name="note" rows="2" maxlength="800" required placeholder="Why?"></textarea>
        <label for="decision-feedback">Feedback</label><select class="select" id="decision-feedback" name="feedback"><option value="">None</option><option value="useful">Useful</option><option value="incorrect">Incorrect</option><option value="too-noisy">Too noisy</option><option value="not-priority">Not a priority</option></select>
        ${exp?`<fieldset id="decision-experiment" hidden><legend>Customer experiment · required to accept</legend>
          <label>Audience <input name="audience" maxlength="400"></label><label>Problem <input name="problem" maxlength="400"></label>
          <label>Hypothesis <input name="hypothesis" maxlength="400"></label><label>Success metric <input name="metric" maxlength="400"></label>
          <label>Target <input name="target" type="number" step="any" min="0.00001"></label><label>Effort cap (hours) <input name="effortHours" type="number" min="0.1" max="40" step="any"></label>
          <label>Review by <input name="reviewBy" type="date" min="${minDay}" max="${maxDay}"></label><label>Stop condition <input name="stopCondition" maxlength="400"></label>
        </fieldset>`:''}
        <fieldset id="decision-outcome-fields" hidden><legend>Outcome · required to verify</legend><label>Success condition <textarea name="successCondition" maxlength="500" rows="2"></textarea></label><label>Measured result <textarea name="outcome" maxlength="800" rows="2"></textarea></label><label>Evidence link (HTTPS) <input name="evidenceUrl" type="url" maxlength="1000" placeholder="https://"></label></fieldset>
        <p id="decision-error" class="form-error" role="alert"></p><button class="button button-primary" type="submit" id="decision-submit">Save decision</button>
      </form></section>`;
  }
  function updateDecisionFields(){const form=$('decision-form');if(!form)return;const st=form.elements.state.value, exp=$('decision-experiment'),out=$('decision-outcome-fields');
    if(exp){exp.hidden=st!=='accepted';exp.querySelectorAll('input').forEach(x=>x.required=!exp.hidden);}
    if(out){out.hidden=st!=='verified';out.querySelectorAll('input,textarea').forEach(x=>x.required=!out.hidden);}
  }
  async function submitDecision(form){if(state.saving||!canDecide()){notify('Live founder access required');return;}
    const f=new FormData(form),kind=f.get('kind'),id=f.get('id'),next=f.get('state'),revision=Number(f.get('revision'));
    if(!['finding','opportunity'].includes(kind)||!/^[-a-zA-Z0-9_]{1,80}$/.test(id)||!Number.isSafeInteger(revision)||revision<0){$('decision-error').textContent='Invalid decision record.';return;}
    const body={kind,id,state:next,revision,note:String(f.get('note')||'').trim(),feedback:String(f.get('feedback')||''),outcome:String(f.get('outcome')||'').trim(),successCondition:String(f.get('successCondition')||'').trim(),evidenceUrl:String(f.get('evidenceUrl')||'').trim()};
    if(next==='accepted'&&kind==='opportunity')body.experiment={audience:String(f.get('audience')||'').trim(),problem:String(f.get('problem')||'').trim(),hypothesis:String(f.get('hypothesis')||'').trim(),metric:String(f.get('metric')||'').trim(),target:Number(f.get('target')),effortHours:Number(f.get('effortHours')),reviewBy:String(f.get('reviewBy')),stopCondition:String(f.get('stopCondition')||'').trim()};
    if(!next||!body.note){$('decision-error').textContent='Select a next step and add a reason.';return;}
    if(body.state==='verified'&&(!body.outcome||!body.successCondition||!/^https:\/\/[^\s]+/i.test(body.evidenceUrl))){$('decision-error').textContent='Add outcome, success condition and HTTPS evidence.';return;}
    state.saving=true;$('decision-submit').disabled=true;$('decision-error').textContent='';
    try{const response=await fetch('/api/decisions',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-hq-founder-action':'decision-v1','accept':'application/json'},body:JSON.stringify(body)});
      const result=await response.json().catch(()=>({}));if(!response.ok||result.saved!==true)throw Error(result.error||'Save refused');
      closeDetail();notify('Decision saved');await refresh(false);
    }catch(e){if($('decision-error'))$('decision-error').textContent=cut(e.message||'Save failed',170);notify('Decision not saved');}finally{state.saving=false;if($('decision-submit'))$('decision-submit').disabled=false;}
  }
  function closeDetail(){if($('detail-drawer').hidden)return;$('detail-drawer').hidden=true;$('detail-scrim').hidden=true;state.detail=null;document.body.classList.remove('drawer-open');if(lastFocus?.isConnected)lastFocus.focus();}
  function notify(msg){$('toast').textContent=msg;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2700);}
  function normalize(d){if(!d||d.schemaVersion!=='yorphives.hq-intelligence.v1')throw Error('Unsupported report');const out={...EMPTY(),...d};for(const k of ['assets','products','findings','opportunities','activity','changes','comparisons','securityWatch','agents'])out[k]=Array.isArray(out[k])?out[k].slice(0,200):[];
    out.operating={...EMPTY().operating,...(d.operating&&typeof d.operating==='object'&&!Array.isArray(d.operating)?d.operating:{})};out.operating.queue=list(out.operating,'queue').slice(0,3);out.operating.threads=list(out.operating,'threads').slice(0,300);
    out.decisionJournal={available:d.decisionJournal?.available===true,events:list(d.decisionJournal,'events').slice(0,2000)};
    return out;
  }
  function highAlert(d){const high=list(d,'findings').filter(x=>['high','critical'].includes(x.priority));if(!high.length||!state.alerts||!('Notification' in window)||Notification.permission!=='granted')return;
    const key=high.map(x=>x.id||x.title).join('|');if(!lastHighKey){lastHighKey=key;return;}if(key!==lastHighKey){lastHighKey=key;try{new Notification('HQ: new high-priority findings',{body:'Open Headquarters to review.',tag:'yh-high-priority'});}catch{}}}
  async function refresh(manual=false){if(state.busy||(!manual&&state.source==='imported')){return;}if(!/^https?:$/.test(location.protocol)){if(manual)notify('Open report locally');return;}
    state.busy=true;try{const reply=await fetch('/api/report',{credentials:'same-origin',headers:{accept:'application/json'},cache:'no-store'});if(!reply.ok)throw Error('Report unavailable');const d=normalize(await reply.json());
      const oldSource=state.source;state.data=d;state.source='live';lastLiveFetch=Date.now();if(oldSource==='live')highAlert(d);else lastHighKey=list(d,'findings').filter(x=>['high','critical'].includes(x.priority)).map(x=>x.id||x.title).join('|');
      if(manual)notify('Report refreshed');
    }catch{if(state.source==='live')state.source='stale';if(manual)notify('Live report unavailable');}
    finally{state.busy=false;render();}
  }
  async function openLocal(file){if(!file)return;if(file.size>5*1024*1024){notify('Report limit: 5 MB');return;}try{const d=normalize(JSON.parse(await file.text()));state.data=d;state.source='imported';lastHighKey='';navigate('home');notify('Report opened locally');}catch{notify('Invalid HQ report');}}
  function downloadJson(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);notify('Private export created');}
  const summary=()=>`YorpHives HQ
Source: ${state.source}
Updated: ${state.data.generatedAt||'Unavailable'}
Website HTTP: ${state.source==='live'?status(website()?.status):'Not live-verified'}
Headquarters: ${hqLabel()}
To review: ${num(state.data.operating?.pending)}
Research leads: ${ready()?list(state.data,'opportunities').length:'—'}
Revenue: unavailable`;
  async function copySummary(){const message=summary();try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(message);notify('Status copied');}catch{const dialog=$('copy-modal'),field=$('copy-text');field.value=message;if(!dialog.open)dialog.showModal();field.focus();field.select();notify('Select and copy status');}}
  function searchItems(){const items=[...Object.entries(PAGES).map(([id,title])=>({kind:'page',id,title,label:'Page'})),...DEPARTMENTS.map((x,id)=>({kind:'department',id,title:x.name,label:'Department'}))];
    for(const [kind,label] of [['finding','Alert'],['opportunity','Research'],['product','Product'],['comparison','Comparison'],['security','Advisory']]){
      list(state.data,files(kind)).forEach((x,i)=>items.push({kind,id:filled(x.id)?x.id:'at-'+i,title:x.title||x.name||x.competitor||'Untitled',label}));}
    return items;
  }
  function renderSearch(){const q=$('search-input').value.trim().toLowerCase();const match=searchItems().filter(x=>String(x.title).toLowerCase().includes(q)).slice(0,30);
    $('search-results').innerHTML=match.length?match.map(x=>`<button class="search-result" type="button" ${x.kind==='page'?`data-page="${esc(x.id)}"`:`data-detail="${esc(x.kind)}" data-id="${esc(x.id)}"`}><span><strong>${esc(x.title)}</strong><small>${esc(x.label)}</small></span>${icon('arrow')}</button>`).join(''):blank('No matches');}
  function openSearch(){const dlg=$('search-modal');if(!dlg.open)dlg.showModal();renderSearch();$('search-input').focus();}
  async function toggleAlerts(checked){if(!checked){state.alerts=false;store.set('alerts',false);notify('Browser alerts off');return;}
    if(!('Notification' in window)||!window.isSecureContext){state.alerts=false;notify('Browser alerts require a secure connection');return;}
    let permission=Notification.permission;if(permission==='default')permission=await Notification.requestPermission();state.alerts=permission==='granted';store.set('alerts',state.alerts);notify(state.alerts?'Alerts on · open tab only':'Notification permission unavailable');}
  function action(cmd){switch(cmd){case 'import':$('report-file').click();break;case 'refresh':refresh(true);break;case 'clear-pulse-search':state.pulseQuery='';render();break;case 'toggle-saved':state.savedOnly=!state.savedOnly;render();break;case 'github-saved':state.githubSavedOnly=!state.githubSavedOnly;render();break;case 'github-clear':state.githubQuery='';state.githubResults=[];state.githubSearched=false;state.githubError='';state.githubSavedOnly=false;render();break;case 'github-export':if(state.githubSaved.size)downloadJson({source:'github-public',exportedAt:today(),projects:[...state.githubSaved.values()]},'hq-open-source-shortlist.json');break;case 'export-report':if(ready())downloadJson(state.data,'hq-evidence-private.json');break;case 'export-decisions':downloadJson({exportedAt:today(),events:list(state.data.decisionJournal,'events')},'hq-decisions-private.json');break;case 'copy-summary':copySummary();break;case 'close-detail':closeDetail();break;}}
  function bind(){document.addEventListener('click',e=>{
      const nav=e.target.closest('[data-page]');if(nav){if($('search-modal').open)$('search-modal').close();if(!$('detail-drawer').hidden)closeDetail();navigate(nav.dataset.page);return;}
      const detail=e.target.closest('[data-detail]');if(detail){if($('search-modal').open)$('search-modal').close();openDetail(detail.dataset.detail,detail.dataset.id);return;}
      const src=e.target.closest('[data-discover-source]');if(src){state.discoverSource=src.dataset.discoverSource==='github'?'github':'hq';render();return;}
      const githubCategory=e.target.closest('[data-github-filter]');if(githubCategory){state.githubFilter=githubCategory.dataset.githubFilter;render();return;}
      const ghStar=e.target.closest('[data-github-save]');if(ghStar){const id=ghStar.dataset.githubSave;const item=state.githubResults.find(x=>x.id===id)||state.githubSaved.get(id);if(item){if(state.githubSaved.has(id))state.githubSaved.delete(id);else state.githubSaved.set(id,item);try{sessionStorage.setItem('yh:github-saved',JSON.stringify([...state.githubSaved].slice(-60)));}catch{}render();notify(state.githubSaved.has(id)?'Saved in this tab':'Removed from saved');}return;}
      const d=e.target.closest('[data-discover-filter]');if(d){state.discoverFilter=d.dataset.discoverFilter;render();return;}
      const p=e.target.closest('[data-pulse-filter]');if(p){state.homeFilter=p.dataset.pulseFilter;render();return;}
      const f=e.target.closest('[data-decision-filter]');if(f){state.decisionFilter=f.dataset.decisionFilter;render();return;}
      const s=e.target.closest('[data-save-kind]');if(s){const key=safeKey(s.dataset.saveKind,s.dataset.saveId);if(state.saved.has(key))state.saved.delete(key);else state.saved.add(key);try{sessionStorage.setItem('yh:saved',JSON.stringify([...state.saved].slice(0,500)));}catch{}render();notify(state.saved.has(key)?'Saved for this tab':'Removed from saved');return;}
      const cmd=e.target.closest('[data-action]')?.dataset.action;if(cmd)action(cmd);
    });
    $('more-button').addEventListener('click',()=>{const open=$('more-popover').hidden;$('more-popover').hidden=!open;$('more-button').setAttribute('aria-expanded',String(open));});
    $('import-menu-action').addEventListener('click',()=>{$('more-popover').hidden=true;$('more-button').setAttribute('aria-expanded','false');$('report-file').click();});
    for(const id of ['global-search-button','mobile-search-button'])$(id).addEventListener('click',openSearch);
    for(const id of ['refresh-button','mobile-refresh-button'])$(id).addEventListener('click',()=>refresh(true));
    for(const id of ['back-button','mobile-back-button'])$(id).addEventListener('click',goBack);
    $('search-input').addEventListener('input',renderSearch);$('search-close').addEventListener('click',()=>$('search-modal').close());$('copy-close').addEventListener('click',()=>$('copy-modal').close());
    $('detail-close').addEventListener('click',closeDetail);$('detail-scrim').addEventListener('click',closeDetail);
    $('report-file').addEventListener('change',e=>{openLocal(e.target.files[0]);e.target.value='';});
    document.addEventListener('input',e=>{if(e.target.id==='github-query'){state.githubQuery=e.target.value;return;}if(['discover-query','product-query','pulse-query'].includes(e.target.id)){state[e.target.id==='discover-query'?'discoverQuery':e.target.id==='product-query'?'productQuery':'pulseQuery']=e.target.value;render({keepFocus:true});}});
    document.addEventListener('change',async e=>{if(e.target.id==='discover-sort'){state.discoverSort=e.target.value;render();}if(e.target.id==='github-sort'){state.githubSort=e.target.value;render();}if(e.target.id==='product-filter'){state.productFilter=e.target.value;render();}if(e.target.id==='decision-state')updateDecisionFields();
      if(e.target.id==='compact-toggle'){state.compact=e.target.checked;store.set('compact',state.compact);render();}if(e.target.id==='alerts-toggle'){await toggleAlerts(e.target.checked);render();}});
    document.addEventListener('submit',e=>{if(e.target.getAttribute('id')==='decision-form'){e.preventDefault();submitDecision(e.target);}if(e.target.id==='github-search-form'){e.preventDefault();searchGithub();}});
    window.addEventListener('popstate',browserRoute);window.addEventListener('hashchange',browserRoute);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){if(!$('detail-drawer').hidden)closeDetail();$('more-popover').hidden=true;$('more-button').setAttribute('aria-expanded','false');}
      if(e.key==='Tab'&&!$('detail-drawer').hidden){const nodes=[...$('detail-drawer').querySelectorAll('button:not([disabled]),a[href],input:not([disabled]):not([type=hidden]),textarea:not([disabled]),select:not([disabled])')].filter(x=>!x.closest('[hidden]'));const i=nodes.indexOf(document.activeElement);if(e.shiftKey&&i===0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0]?.focus();}}
      const typing=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement;
      if((e.key==='/'&&!typing)||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){e.preventDefault();openSearch();}
    });
    document.addEventListener('pointerdown',e=>{if(!$('more-popover').hidden&&!e.target.closest('#more-popover')&&!e.target.closest('#more-button')){$('more-popover').hidden=true;$('more-button').setAttribute('aria-expanded','false');}});
  }
  bind();history.replaceState({hqPage:state.page},'','#'+state.page);render();refresh();
  // Read cached evidence only while the tab is visible; never overwrite a locally opened report.
  setInterval(()=>{if(!document.hidden&&!state.busy&&state.source!=='imported'&&Date.now()-lastLiveFetch>=120000)refresh(false);},120000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!state.busy&&state.source!=='imported'&&Date.now()-lastLiveFetch>=120000)refresh(false);});
})();
