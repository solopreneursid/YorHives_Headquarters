/** Deterministic technical assessment and localized, unsent proposal drafts. */
const topics=[
 {id:'api',pattern:/\b(?:REST|OpenAPI|API|webhook)s?\b/i,label:'Public API or webhook mentioned'},
 {id:'library',pattern:/\b(?:SDK|library|package|plugin|module)s?\b/i,label:'Reusable software component mentioned'},
 {id:'format',pattern:/\b(?:PDF|JSON|CSV|XML|file format)s?\b/i,label:'Data or document format mentioned'},
 {id:'auth',pattern:/\b(?:authentication|API key|OAuth|authorization)\b/i,label:'Authentication requirement mentioned'},
 {id:'license',pattern:/\b(?:licen[cs]e|Apache 2\.0|MIT|AGPL|GPL)\b/i,label:'Licensing terms mentioned'}
];
const safe=(x,n=180)=>String(x??'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-contact]').trim().slice(0,n);
export function assessIntegration(opportunity){
 const body=safe(opportunity?.title)+' '+safe(opportunity?.summary,600);
 const signals=topics.filter(t=>t.pattern.test(body)).map(t=>({id:t.id,label:t.label,evidenceUrl:opportunity.sourceUrl}));
 const documented=opportunity?.sourceType==='official-product-page';
 return {status:signals.length?'technical-research-candidate':'insufficient-technical-evidence',
  sourceClass:documented?'official-documentation-excerpt':'public-metadata-or-discussion',
  signals,checks:['Verify the exact interface and supported versions','Review authentication, license and terms of use','Verify data handling and implementation cost','Run isolated compatibility tests with non-sensitive fixtures'],
  compatibilityVerified:false,licenseCompatible:null,credentialsRequired:null,estimatedCost:null,approvedForImplementation:false};
}
const LANGUAGE=Object.freeze({
 en:{subject:'Possible collaboration',hello:'Hello,',intro:'I am exploring whether a resource from',reference:'could be relevant to your documented work. I found this public reference:',ask:'Would it be appropriate to discuss whether a small integration or resource reference would be useful?',close:'This is an exploratory proposal, not a claim of compatibility or an existing partnership.'},
 hi:{subject:'संभावित सहयोग',hello:'नमस्कार,',intro:'मैं यह समझना चाहता हूँ कि',reference:'की कोई सुविधा आपके प्रकाशित कार्य के लिए उपयोगी हो सकती है या नहीं। यह सार्वजनिक संदर्भ मिला:',ask:'क्या किसी छोटे तकनीकी एकीकरण या संसाधन के संदर्भ पर चर्चा करना उचित होगा?',close:'यह प्रारंभिक प्रस्ताव है; तकनीकी अनुकूलता या मौजूदा साझेदारी का दावा नहीं है।'},
 es:{subject:'Posible colaboración',hello:'Hola,',intro:'Estoy investigando si un recurso de',reference:'podría ser relevante para su trabajo documentado. Encontré esta referencia pública:',ask:'¿Sería apropiado explorar una pequeña integración o una referencia a un recurso?',close:'Es una propuesta exploratoria; no implica compatibilidad confirmada ni una colaboración existente.'}
});
export function localizedProposal(opportunity,{projectName,language='en'}={}){
 if(!Object.hasOwn(LANGUAGE,language)||!opportunity||typeof opportunity.sourceUrl!=='string')throw TypeError('Invalid proposal');
 const u=new URL(opportunity.sourceUrl);
 if(u.protocol!=='https:'||u.username||u.password||u.port)throw TypeError('Invalid evidence link');
 const t=LANGUAGE[language],project=safe(projectName,100),title=safe(opportunity.title);
 if(!project||!title)throw TypeError('Missing context');
 const org=safe(opportunity.prospect?.organization||opportunity.organization,100);
 return {language,subject:t.subject+' — '+project+(org?' / '+org:''),
  body:[t.hello,'',t.intro+' '+project+' '+t.reference,title,u.href,'',t.ask,'',t.close].join('\n'),
  originalEvidenceLanguage:'not-translated',recipient:null,sent:false,published:false,autoExecute:false,
  status:'requires-founder-language-and-context-review'};
}
export function proposalVariants(opportunity,projectName){
 return Object.keys(LANGUAGE).map(language=>localizedProposal(opportunity,{projectName,language}));
}
