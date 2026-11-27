/**
 * Non-invasive bridge to the existing Revenue and Growth Evidence response shapes.
 * No new source collection, network requests or persistence. Unknown remains null.
 */
import {buildGrowthIntelligence,PROJECTS} from './growth-intelligence.mjs';

const VALID_KINDS=new Set(['public-discussion','public-client-intent','official-tender-listing',
 'community-partner-mention','community-sponsorship-mention','public-repository',
 'public-demand-signal','first-party-aggregate']);
function mapRow(row){
 if(!row||typeof row!=='object'||!VALID_KINDS.has(row.sourceType))return null;
 return {title:row.title,summary:row.summary||row.description,
  sourceUrl:row.sourceUrl,sourceType:row.sourceType,observedAt:row.observedAt};
}
export function existingRevenueSignals(revenue){
 if(revenue?.readOnly!==true||revenue?.schemaVersion!==1)return [];
 const raw=[...(Array.isArray(revenue.marketSignals)?revenue.marketSignals:[]),
  ...(Array.isArray(revenue.opportunities)?revenue.opportunities:[])];
 const found=new Map();
 for(const row of raw.slice(0,200)){
  const normalized=mapRow(row);
  if(!normalized)continue;
  const key=String(normalized.sourceUrl)+'|'+String(normalized.title)+'|'+String(normalized.observedAt);
  if(!found.has(key))found.set(key,normalized);
 }
 return [...found.values()];
}
export function existingGrowthMetrics(growth){
 if(growth?.available!==true||growth?.readOnly!==true||
    growth.source!=='https://yorphives.com/api/insights/growth')return {};
 const c=growth.comparison;
 if(!c||!Number.isSafeInteger(c.recent7dPageViews)||c.recent7dPageViews<0||
    !Number.isSafeInteger(c.recent7dCompletedActions)||c.recent7dCompletedActions<0)return {};
 return {yorphives:{sourceType:'first-party-aggregate',source:growth.source,
  observedAt:growth.generatedAt,pageViews7d:c.recent7dPageViews,
  completedActions7d:c.recent7dCompletedActions}};
}
export function growthFromExistingEvidence({revenue,growth,projects=PROJECTS,prospectScans=[],businessScans=[],
  now=new Date().toISOString()}={}){
 const scans=Array.isArray(prospectScans)?prospectScans.slice(0,50):[];
 const prospectSignals=scans.flatMap(s=>s?.state==='observed'&&Array.isArray(s.records)?s.records.slice(0,8):[]);
 const business=Array.isArray(businessScans)?businessScans.slice(0,100):[];
 const businessSignals=business.flatMap(s=>s?.state==='observed'&&Array.isArray(s.records)?s.records.slice(0,6):[]);
 const result=buildGrowthIntelligence({projects,signals:[...existingRevenueSignals(revenue),...prospectSignals,...businessSignals],
  metrics:existingGrowthMetrics(growth),now});
 return {...result,integration:'existing-hq-revenue-evidence',
  businessSources:business.map(({projectId,kind,state,checkedAt,records})=>({projectId,kind,state,checkedAt,observedCount:Array.isArray(records)?records.length:0})),
  prospectSources:scans.map(({projectId,state,checkedAt,records})=>({projectId,state,checkedAt,observedCount:Array.isArray(records)?records.length:0})),
  sourceStatuses:revenue?.readOnly===true&&Array.isArray(revenue.sources)?
    revenue.sources.map(x=>({name:String(x.name||'').slice(0,100),
      status:String(x.status||'not-checked').slice(0,80)})).slice(0,20):[],
  caveat:'Public repository/package metadata, selected official documentation and revenue research are limited source coverage. Topic matches do not establish buying intent or permission to contact.'};
}
