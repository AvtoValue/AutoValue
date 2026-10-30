// DOM wiring for the AutoValue page. Pure logic lives in core.js.
(function(){
'use strict';
const {translations,ui}=window.AVI18n;
const {makes,modelOptions,marketSites,OTHER_MAKE,OTHER_MODEL}=window.AVData;
const core=window.AVCore;
const $=id=>document.getElementById(id);
const MAX_COMPS=10;
let mode='buy',step=1,compCount=5,vinChecked=null,backend={online:false,providers:[]};

const lang=()=>$('lang').value;
const t=()=>translations[lang()]||translations.en;
const u=()=>Object.assign({},ui.en,ui[lang()]||{});
const locale=()=>({sl:'sl-SI',de:'de-DE',it:'it-IT',hr:'hr-HR'})[lang()]||'en-IE';
const money=n=>new Intl.NumberFormat(locale(),{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const el=(tag,props,children)=>{const e=Object.assign(document.createElement(tag),props||{});(children||[]).forEach(c=>e.append(c));return e};
const selectedEquipment=()=>[...document.querySelectorAll('.equipment-check:checked')].map(x=>x.parentElement.innerText.trim());
const optText=id=>$(id).selectedOptions[0]?$(id).selectedOptions[0].text:'';
// "Other" placeholders are not real names, so they are left out of searches.
const realMake=()=>$('make').value===OTHER_MAKE?'':$('make').value.trim();
const realModel=()=>$('model').value===OTHER_MODEL?'':$('model').value.trim();

// --- Vehicle dropdowns and power ---
function setFirstOption(select,text){if(select.options.length)select.options[0].textContent=text}
function populateMakes(){
 makes.forEach(name=>$('make').append(el('option',{value:name,textContent:name})));
}
function setModels(){
 const m=$('make').value,model=$('model');
 model.replaceChildren(el('option',{value:'',textContent:m?u().chooseModel:u().chooseMakeFirst}));
 (modelOptions[m]||[]).forEach(name=>model.append(el('option',{value:name,textContent:name===OTHER_MODEL?u().otherModel:name})));
 model.disabled=!m;
}
// Option values stay in English (the logic uses them); only the visible labels are translated.
function translateOptions(){
 const o=u().opt;
 [['fuel',o.fuel],['trans',o.trans],['color',o.color],['country',o.country]].forEach(([id,map])=>{
  [...$(id).options].forEach(opt=>{if(map[opt.value])opt.textContent=map[opt.value]});
 });
 document.querySelectorAll('.equipment-check').forEach(c=>{const label=o.equipment[c.value];if(label)c.nextElementSibling.textContent=label});
 [...$('make').options].forEach(opt=>{if(opt.value===OTHER_MAKE)opt.textContent=u().otherMake});
 [...$('model').options].forEach(opt=>{if(opt.value===OTHER_MODEL)opt.textContent=u().otherModel});
}
function populateYears(){
 for(let y=new Date().getFullYear();y>=1950;y--)$('year').append(el('option',{value:String(y),textContent:String(y)}));
}
function updatePowerConversion(){
 const raw=$('powerEntry').value,n=Number(raw),hint=$('powerConversion');
 if(raw===''||!Number.isFinite(n)||n<0){$('power').value='';$('powerHp').value='';hint.textContent=u().powerHint;return}
 if($('powerUnit').value==='kw'){
  $('power').value=String(n);$('powerHp').value=String(Math.round(core.kwToHp(n)));
  hint.textContent='≈ '+Math.round(core.kwToHp(n))+' KM';
 }else{
  $('powerHp').value=String(n);$('power').value=core.hpToKw(n).toFixed(1);
  hint.textContent='≈ '+core.hpToKw(n).toFixed(1)+' kW';
 }
}
let previousPowerUnit='kw';
function onPowerUnitChange(){
 const raw=$('powerEntry').value,n=Number(raw),unit=$('powerUnit').value;
 if(raw!==''&&Number.isFinite(n)&&n>=0&&unit!==previousPowerUnit)$('powerEntry').value=unit==='hp'?String(Math.round(core.kwToHp(n))):core.hpToKw(n).toFixed(1);
 previousPowerUnit=unit;
 $('powerEntry').placeholder=unit==='kw'?'103':'140';
 updatePowerConversion();
}

// --- Navigation and language ---
function show(n){
 step=n;
 ['s1','s2','s3'].forEach((id,i)=>$(id).classList.toggle('hidden',i!==n-1));
 $('bar1').classList.toggle('active',n>=1);$('bar2').classList.toggle('active',n>=2);
 $('stepLabel').textContent=n===1?t().step:n===2?t().step2:t().step3;
 $('stepNo').textContent=n===1?'01 / 02':n===2?'02 / 02':'✓';
 window.scrollTo({top:0,behavior:'smooth'});
 saveState();
}
function applyLang(){
 const d=t(),s=u();
 document.documentElement.lang=lang();
 Object.keys(d).forEach(k=>{if($(k))$(k).innerHTML=d[k]});
 $('stepLabel').textContent=step===1?d.step:step===2?d.step2:d.step3;
 setFirstOption($('make'),s.chooseMake);setFirstOption($('year'),s.chooseYear);setFirstOption($('color'),s.chooseColor);
 translateOptions();
 $('pill').textContent=s.pill;$('badge').textContent=s.badge;
 $('vin').placeholder=s.vinPh;$('trim').placeholder=s.trimPh;
 setFirstOption($('model'),$('make').value?s.chooseModel:s.chooseMakeFirst);
 updatePowerConversion();
 $('vinStatus').textContent=vinChecked?s[vinChecked]:(d.vinHelp||ui.en.vinOk);
 $('sellerPros').placeholder=s.prosPh;$('sellerCons').placeholder=s.consPh;$('condition').placeholder=s.conditionPh;
 ['researchHeading','researchIntro','manualHeading','manualIntro','addComp','loadListings'].forEach(k=>{$(k).textContent=s[k]});
 $('comparePrices').textContent=s.compare;
 ['extSummary','extHow','extDownload'].forEach(k=>{$(k).textContent=s[k]});
 document.title='AutoValue — '+s.pageTitle;$('protoLabel').textContent=s.protoLabel;
 $('demo').textContent=s.demoBtn;$('garageHeading').textContent=s.garageHeading;$('share').textContent=s.shareBtn;$('saveGarage').textContent=s.saveGarage;$('feedbackLink').textContent=s.feedback;
 $('demoBanner').textContent=s.demoBanner;$('demoBanner').classList.toggle('hidden',!isDemo);$('saveGarage').hidden=isDemo;
 renderGarage();
 $('edit').textContent=s.editBtn;$('copy').textContent=s.copyBtn;
 if(!lastSummary){$('estimatedRangeValue').textContent=s.notAvailable;$('confidenceValue').textContent=s.pendingData}
 $('privacyLink').textContent=s.privacyLink;$('privacyLink').href='privacy.html?lang='+lang();
 $('quickSearchL').textContent=s.quickSearchL;$('quickSearch').placeholder=s.quickSearchPh;
 $('adjustToggleL').textContent=s.adjustToggle;$('print').textContent=s.print;$('reset').textContent=s.reset;
 renderBackendStatus();
 buildCompRows();
 if(step===3){buildSearchLinks();renderReportLabels();if(lastSummary)renderComparison()}
}

// --- Seller / buyer mode ---
function updateModeFields(){
 document.querySelectorAll('.seller-only').forEach(x=>x.classList.toggle('hidden',mode!=='sell'));
 $('price').required=mode==='sell';
 if(mode!=='sell')$('price').value='';
}
function checkVin(){
 const v=$('vin').value.trim().toUpperCase();$('vin').value=v;
 vinChecked=!v?'vinEmpty':core.isValidVinFormat(v)?'vinOk':'vinBad';
 $('vinStatus').textContent=u()[vinChecked];
}

// --- Report ---
function target(){
 return {year:Number($('year').value)||undefined,km:Number($('mileage').value)||undefined,fuel:$('fuel').value,transmission:$('trans').value,kw:Number($('power').value)||undefined};
}
function renderReportLabels(){
 const s=u();
 $('askingSummary').textContent=mode==='sell'&&$('price').value?money(Number($('price').value)):(mode==='buy'?'—':s.notProvided);
 $('askingLabel').textContent=mode==='sell'?s.askingLabel:s.goalLabel;
 $('resultHeading').textContent=mode==='buy'?s.headingBuy:s.headingSell;
}
function analyse(quiet){
 const s=u();
 if(!$('make').value.trim()||!$('model').value.trim()||!$('year').value||!$('mileage').value){if(quiet!==true)alert(s.required);return false}
 $('carSummary').textContent=optText('make')+' '+optText('model');
 const equipment=selectedEquipment();
 const meta=[$('year').value,Number($('mileage').value).toLocaleString(locale())+' km',optText('country'),optText('fuel'),optText('trans')];
 if($('color').value)meta.push(optText('color'));
 if(mode==='sell'){
  if($('trim').value)meta.push($('trim').value);
  if(equipment.length)meta.push(equipment.join(', '));
  if($('vin').value.trim())meta.push('VIN: '+$('vin').value.trim().toUpperCase());
  if($('sellerPros').value.trim())meta.push(s.extras+$('sellerPros').value.trim());
  if($('sellerCons').value.trim())meta.push(s.faults+$('sellerCons').value.trim());
 }
 $('metaSummary').textContent=meta.join(' · ');
 renderReportLabels();
 buildSearchLinks();
 buildCompRows();
 lastSummary=null;
 $('manualResult').textContent=s.afterAnalyse;
 show(3);
 refreshSources();
 return true;
}
function copySummary(){
 const L=u().sum,na=L.na,v=id=>$(id).value||na;
 const lines=[L.title,L.market+': '+optText('country'),L.mode+': '+(mode==='sell'?L.sell:L.buy),L.vehicle+': '+optText('make')+' '+optText('model'),L.year+': '+$('year').value,L.mileage+': '+$('mileage').value+' km',L.fuel+': '+optText('fuel'),L.trans+': '+optText('trans'),L.power+': '+v('power')+' kW / '+v('powerHp')+' KM',L.color+': '+($('color').value?optText('color'):na)];
 if(mode==='sell')lines.push(L.asking+': '+($('price').value?$('price').value+' EUR':na),L.vin+': '+v('vin'),L.pros+': '+v('sellerPros'),L.cons+': '+v('sellerCons'),L.trim+': '+v('trim'),L.equipment+': '+(selectedEquipment().join(', ')||na),L.service+': '+v('condition'));
 if(lastSummary){const st=lastSummary.result.stats;lines.push(L.ads+': '+st.n,L.median+': '+Math.round(st.median)+' EUR',L.range+': '+Math.round(st.min)+'–'+Math.round(st.max)+' EUR')}
 lines.push(L.note);
 const text=lines.join('\n');
 navigator.clipboard.writeText(text).then(()=>alert(u().copied),()=>prompt(u().copyPrompt,text));
}

// --- Search links ---
function buildSearchLinks(){
 const s=u(),box=$('searchLinks'),sites=marketSites[$('country').value]||[];
 const year=Number($('year').value),mileage=Number($('mileage').value),hasPower=$('powerEntry').value.trim()!=='';
 const q=core.buildVehicleQuery({make:realMake(),model:realModel(),year,mileage,fuel:$('fuel').value,transmission:$('trans').value,mode,trim:$('trim').value.trim(),kw:Number($('power').value),hp:hasPower?Number($('powerHp').value):0,equipment:selectedEquipment()});
 const years=year?[year-1,year,year+1].join(', '):'—';
 const km=mileage>0?Math.max(0,mileage-50000).toLocaleString(locale())+'–'+(mileage+50000).toLocaleString(locale())+' km':'—';
 const power=hasPower?Math.round(Number($('powerHp').value))+' KM / '+Math.round(Number($('power').value))+' kW':s.notSpecified;
 const filters=el('p',{className:'note search-filters',textContent:s.filtersLead+optText('country')+' · '+s.fYears+years+' · '+s.fKm+km+' · '+s.fFuel+optText('fuel')+' · '+s.fPower+power+' · '+s.fTrans+optText('trans')+'. '+s.filtersTail});
 box.replaceChildren(filters,...sites.map(([name,domain])=>el('a',{className:'search-link',target:'_blank',rel:'noopener noreferrer',href:'https://www.google.com/search?q='+encodeURIComponent('site:'+domain+' '+q),textContent:s.searchPrefix+name+' ↗'})));
}

// --- Comparable ad rows ---
// Ad details come from parsed text, shared links or saved data, so keep only known fields of the right type.
function parseMeta(str){
 let raw;
 try{raw=JSON.parse(str||'{}')}catch(e){return {}}
 if(!raw||typeof raw!=='object')return {};
 const out={};
 ['price','year','km','kw','hp'].forEach(k=>{if(typeof raw[k]==='number'&&Number.isFinite(raw[k]))out[k]=raw[k]});
 ['fuel','transmission','source','title','url'].forEach(k=>{if(typeof raw[k]==='string')out[k]=raw[k].slice(0,200)});
 return out;
}
function readRows(){
 const rows=[];
 for(let i=1;$('link'+i);i++)rows.push({link:$('link'+i).value,text:$('text'+i).value,price:$('comp'+i).value,meta:$('link'+i).dataset.meta||''});
 return rows;
}
function buildCompRows(rows){
 const s=u(),box=$('compRows'),prev=rows||readRows();
 const exampleDomain=((marketSites[$('country').value]||[])[0]||['','avto.net'])[1];
 compCount=Math.max(compCount,prev.length);
 box.replaceChildren();
 for(let i=1;i<=compCount;i++){
  const link=el('input',{type:'url',id:'link'+i,placeholder:s.link+i+' — https://www.'+exampleDomain+'/…'});link.setAttribute('aria-label',s.link+i);
  const open=el('button',{type:'button',className:'btn quiet comp-open',id:'open'+i,textContent:s.open});
  const paste=el('button',{type:'button',className:'btn quiet comp-paste',id:'paste'+i,textContent:s.pasteBtn});
  paste.hidden=!canReadClipboard;
  const text=el('textarea',{id:'text'+i,rows:2,placeholder:s.paste});
  const info=el('div',{className:'comp-info',id:'info'+i,textContent:s.empty});
  const price=el('input',{type:'number',min:'1',id:'comp'+i,placeholder:s.price});price.setAttribute('aria-label',s.price+' '+i);
  const summary=el('button',{type:'button',className:'comp-summary',id:'sum'+i});
  const row=el('div',{className:'comp-row'},[summary,el('div',{className:'comp-row-head'},[link,open]),text,paste,el('div',{className:'comp-row-foot'},[info,price])]);
  summary.addEventListener('click',()=>{row.classList.remove('collapsed');link.focus()});
  if(i>5){const rm=el('button',{type:'button',className:'btn quiet comp-remove',textContent:s.remove});rm.addEventListener('click',()=>removeRow(i));row.append(el('div',{className:'comp-extra'},[el('span'),rm]))}
  box.append(row);
  const p=prev[i-1];
  if(p){link.value=p.link;text.value=p.text;price.value=p.price;if(p.meta)link.dataset.meta=p.meta}
  open.addEventListener('click',()=>openAd(i));
  paste.addEventListener('click',()=>pasteInto(i));
  text.addEventListener('input',()=>parseAdText(i));
  if(p&&p.text)parseAdText(i);else if(p&&p.meta)describeRow(i,parseMeta(p.meta),true);
  if(p)collapseRow(i);
 }
 $('addComp').disabled=compCount>=MAX_COMPS;
 saveState();
}
// After a comparison (or when rows are restored), a row with a price folds into one summary line ("#1 · 33.900 € · 2019 · 58.000 km ✓") to save space.
function collapseRow(i){
 const price=Number($('comp'+i).value),row=$('compRows').children[i-1];
 if(!(price>0)||!row)return;
 const s=u(),meta=parseMeta($('link'+i).dataset.meta);
 const parts=['#'+i,money(price)];
 if(meta.year)parts.push(String(meta.year));
 if(Number.isFinite(meta.km))parts.push(meta.km.toLocaleString(locale())+' km');
 const warn=core.comparabilityWarnings(meta,target()).length>0;
 const sum=$('sum'+i);
 sum.className='comp-summary'+(warn?' warn':'');
 sum.replaceChildren(parts.join(' · ')+(warn?' ⚠':' ✓'),el('span',{textContent:s.rowEdit+' ✎'}));
 sum.setAttribute('aria-label',parts.join(', ')+'. '+s.rowEdit);
 row.classList.add('collapsed');
}
const canReadClipboard=!!(navigator.clipboard&&navigator.clipboard.readText);
function pasteInto(i){
 navigator.clipboard.readText().then(txt=>{
  if(!txt.trim())return;
  // A bare link (e.g. copied from an app's share menu) goes into the link field.
  if(/^https?:\/\/\S+$/i.test(txt.trim())&&!$('link'+i).value.trim()){$('link'+i).value=txt.trim();saveState();return}
  $('text'+i).value=txt;parseAdText(i);saveState();
 },()=>notify(u().pasteFailed));
}
function addRow(){if(compCount<MAX_COMPS){compCount++;buildCompRows();$('link'+compCount).focus()}}
function removeRow(i){const rows=readRows();rows.splice(i-1,1);compCount=Math.max(5,compCount-1);buildCompRows(rows)}
function openAd(i){
 const url=$('link'+i).value.trim();
 if(!/^https?:\/\/\S+$/i.test(url)){$('info'+i).className='comp-info warn';$('info'+i).textContent=u().badLink;return}
 window.open(url,'_blank','noopener,noreferrer');$('text'+i).focus();
}
function describeRow(i,d,fromSource){
 const s=u(),info=$('info'+i),parts=[];
 if(d.source&&fromSource)parts.push(d.source);
 if(d.price)parts.push(money(d.price));
 if(d.year)parts.push(s.year+' '+d.year);
 if(d.km!==undefined)parts.push(d.km.toLocaleString(locale())+' '+s.km);
 if(d.kw)parts.push(Math.round(d.kw)+' kW'+(d.hp?' / '+d.hp+' KM':''));
 if(d.fuel)parts.push(s.fuels[d.fuel]||d.fuel);
 if(d.transmission)parts.push(s.trans[d.transmission]||d.transmission);
 const warns=core.comparabilityWarnings(d,target()).map(w=>s.warn[w]);
 if(!d.price){info.className='comp-info warn';info.textContent=(parts.length?s.found+': '+parts.join(' · ')+' — ':'')+s.notFound;return}
 info.className='comp-info '+(warns.length?'warn':'ok');
 info.textContent=s.found+': '+parts.join(' · ')+(warns.length?' — ⚠ '+warns.join(', '):'');
}
function parseAdText(i){
 const txt=$('text'+i).value;
 if(!txt.trim()){$('info'+i).className='comp-info';$('info'+i).textContent=u().empty;delete $('link'+i).dataset.meta;return}
 const d=core.extractAd(txt);
 if(d.price)$('comp'+i).value=d.price;
 $('link'+i).dataset.meta=JSON.stringify(d);
 describeRow(i,d,false);
}

// --- Comparison ---
let lastSummary=null;
function comparePrices(){
 const ads=readRows().map((r,k)=>{const meta=parseMeta(r.meta);return {index:k+1,link:r.link.trim(),price:Number(r.price),meta}}).filter(a=>Number.isFinite(a.price)&&a.price>0);
 const tgt=target(),adjust=$('adjustToggle').checked,withPrice=a=>Object.assign({},a.meta,{price:a.price});
 const model=adjust?core.depreciationModel(ads.map(withPrice)):null;
 ads.forEach(a=>{a.adjusted=core.adjustPrice(withPrice(a),tgt,model)});
 const result=core.summarizeComparison({prices:ads.map(a=>a.adjusted),mode,askingPrice:Number($('price').value)});
 lastSummary=result?{result,ads,model,adjust}:null;
 for(let i=1;$('link'+i);i++)collapseRow(i);
 renderComparison();
 saveState();
}
const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(m,k)=>values[k]!==undefined?values[k]:m);
function renderComparison(){
 const s=u(),out=$('manualResult');
 if(!lastSummary){out.textContent=s.noPrices;return}
 const {result,ads}=lastSummary,st=result.stats;
 const line=(label,value)=>el('div',{},[el('strong',{textContent:label}),value]);
 const nodes=[
  line(lastSummary.model?s.rangeAdjusted:s.rangeEntered,money(st.min)+' – '+money(st.max)),
  line(s.median,money(st.median)),
  line(s.mean,money(st.mean)),
  line(s.count,String(st.n)),
 ];
 if(st.outliers.length)nodes.push(line(s.outliers,st.outliers.map(money).join(', ')));
 nodes.push(line(s.confidence,s.conf[result.confidence]+(result.highSpread?s.spread:'')));
 const {model}=lastSummary;
 if(model){
  const tgt=target();
  nodes.push(el('div',{className:'adjust-note',textContent:fill(s.adjustInfo,{year:tgt.year,km:tgt.km.toLocaleString(locale())+' km',n:model.n,perKm:money(-model.perKm*10000),perYear:money(model.perYear)})}));
  const changed=ads.filter(a=>a.adjusted!==a.price);
  if(changed.length)nodes.push(line(s.adjustedList,changed.map(a=>'#'+a.index+' '+money(a.price)+' → '+money(a.adjusted)).join(' · ')));
 }else if(lastSummary.adjust)nodes.push(el('div',{className:'adjust-note',textContent:s.adjustNeed}));
 if(mode==='buy'){
  nodes.push(line(s.buyRange,money(result.buyRange[0])+' – '+money(result.buyRange[1])),el('div',{textContent:s.buyTip}));
 }else if(result.verdict){
  if(result.verdict==='high')nodes.push(line(s.sellHigh,s.sellHighTip+money(result.diff)+s.towardMedian));
  else if(result.verdict==='low')nodes.push(line(s.sellLow,s.sellLowTip+money(-result.diff)+s.towardMedian));
  else nodes.push(line(s.sellFair,''));
  nodes.push(el('div',{textContent:s.tolerance+money(result.tolerance)}));
 }else nodes.push(el('div',{textContent:s.askMissing}));
 const tgt=target(),mismatched=ads.map(a=>({a,w:core.comparabilityWarnings(a.meta,tgt)})).filter(x=>x.w.length);
 if(mismatched.length){
  nodes.push(el('strong',{textContent:s.mismatches}));
  nodes.push(el('ul',{className:'warn-list'},mismatched.map(({a,w})=>el('li',{textContent:'#'+a.index+' ('+money(a.price)+'): '+w.map(x=>s.warn[x]).join(', ')}))));
 }
 nodes.push(el('small',{textContent:s.resultNote}));
 const linked=ads.filter(a=>/^https?:\/\//i.test(a.link));
 if(linked.length)nodes.push(el('div',{className:'used-ads'},[el('strong',{textContent:s.adsUsed}),...linked.map(a=>el('div',{},[el('a',{href:a.link,target:'_blank',rel:'noopener noreferrer',textContent:'#'+a.index+' · '+money(a.price)+' ↗'})]))]));
 out.replaceChildren(...nodes);
 $('estimatedRangeValue').textContent=mode==='buy'?money(result.buyRange[0])+'–'+money(result.buyRange[1]):money(st.min)+'–'+money(st.max);
 $('confidenceValue').textContent=s.confShort[result.confidence];
 renderChart();
}

// --- Price/mileage chart (inline SVG) ---
const SVG_NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs,text){
 const e=document.createElementNS(SVG_NS,tag);
 Object.keys(attrs||{}).forEach(k=>e.setAttribute(k,attrs[k]));
 if(text!==undefined)e.textContent=text;
 return e;
}
function renderChart(){
 const box=$('chart'),s=u();
 const hide=()=>{box.classList.add('hidden');box.replaceChildren()};
 if(!lastSummary)return hide();
 const {result,ads,model}=lastSummary,tgt=target(),ask=mode==='sell'?Number($('price').value):0;
 const pts=ads.filter(a=>Number.isFinite(a.meta.km)&&a.price>0);
 if(pts.length<2)return hide();
 const trend=model&&tgt.km?km=>result.stats.median+model.perKm*(km-tgt.km):null;
 const xs=pts.map(a=>a.meta.km).concat(tgt.km?[tgt.km]:[]);
 const xt=core.niceTicks(Math.min(...xs),Math.max(...xs),(document.querySelector('.manual-tools').clientWidth||640)<480?3:5);
 const ys=pts.map(a=>a.price);
 if(mode==='buy')ys.push(...result.buyRange);
 if(ask>0)ys.push(ask);
 if(trend)ys.push(trend(xt[0]),trend(xt[xt.length-1]));
 const yt=core.niceTicks(Math.min(...ys),Math.max(...ys),4);
 // Draw at the on-screen width so labels stay readable on phones.
 const W=Math.round(Math.max(300,Math.min(640,(document.querySelector('.manual-tools').clientWidth||640)-28))),H=W<480?260:300,L=66,R=26,T=14,B=40,x0=xt[0],x1=xt[xt.length-1],y0=yt[0],y1=yt[yt.length-1];
 const sx=v=>L+(v-x0)/((x1-x0)||1)*(W-L-R),sy=v=>H-B-(v-y0)/((y1-y0)||1)*(H-T-B);
 const svg=svgEl('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':s.chartTitle+': '+pts.length+' '+s.chartAds.toLowerCase()});
 yt.forEach(v=>{svg.append(svgEl('line',{class:'grid',x1:L,x2:W-R,y1:sy(v),y2:sy(v)}),svgEl('text',{class:'axis-label',x:L-8,y:sy(v)+4,'text-anchor':'end'},money(v)))});
 xt.forEach(v=>{svg.append(svgEl('line',{class:'grid',x1:sx(v),x2:sx(v),y1:H-B,y2:H-B+5}),svgEl('text',{class:'axis-label',x:sx(v),y:H-B+18,'text-anchor':'middle'},v.toLocaleString(locale())))});
 svg.append(svgEl('text',{class:'axis-label',x:(L+W-R)/2,y:H-4,'text-anchor':'middle'},s.chartKm));
 if(mode==='buy'){const [lo,hi]=result.buyRange;svg.append(svgEl('rect',{class:'band',x:L,width:W-L-R,y:sy(hi),height:Math.max(2,sy(lo)-sy(hi))}))}
 if(trend)svg.append(svgEl('line',{class:'trend',x1:sx(x0),y1:sy(trend(x0)),x2:sx(x1),y2:sy(trend(x1))}));
 if(tgt.km){
  svg.append(svgEl('line',{class:'you',x1:sx(tgt.km),x2:sx(tgt.km),y1:T,y2:H-B}));
  const right=sx(tgt.km)>W-120;
  svg.append(svgEl('text',{class:'you-label',x:sx(tgt.km)+(right?-6:6),y:T+12,'text-anchor':right?'end':'start'},s.chartYourCar));
 }
 if(ask>0&&tgt.km){const cx=sx(tgt.km),cy=sy(ask);svg.append(svgEl('path',{class:'ask',d:'M'+cx+' '+(cy-8)+'L'+(cx+8)+' '+cy+'L'+cx+' '+(cy+8)+'L'+(cx-8)+' '+cy+'Z'},undefined))}
 pts.forEach(a=>{
  const out=result.stats.outliers.includes(a.adjusted),warn=core.comparabilityWarnings(a.meta,tgt).length>0;
  const c=svgEl('circle',{class:'pt'+(out?' out':warn?' warn':''),cx:sx(a.meta.km),cy:sy(a.price),r:6,tabindex:0});
  c.append(svgEl('title',{},'#'+a.index+' · '+money(a.price)+' · '+a.meta.km.toLocaleString(locale())+' km'+(a.meta.year?' · '+a.meta.year:'')));
  svg.append(c);
 });
 const legend=el('div',{className:'chart-legend'});
 const item=(fill,label,border)=>{const i=el('i');i.style.background=fill;if(border)i.style.border=border;legend.append(el('span',{},[i,label]))};
 item('var(--accent)',s.chartAds);item('#f3c96b',s.chartWarn);
 if(result.stats.outliers.length)item('transparent',s.chartOutlier,'2px solid #f37b6b');
 if(mode==='buy')item('rgba(199,243,107,.3)',s.chartBuyRange);
 if(trend)item('#7fb2ff',s.chartTrend);
 if(ask>0)item('#fff',s.chartAsking);
 box.replaceChildren(el('h4',{textContent:s.chartTitle}),svg,legend,el('p',{className:'chart-note',textContent:s.chartNote}));
 box.classList.remove('hidden');
}

// --- Optional backend (server/server.js). The page works without it, e.g. from file:// or GitHub Pages. ---
function api(path,options){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 return fetch('api/'+path,Object.assign({signal:ctrl.signal,headers:{'Content-Type':'application/json'}},options)).then(r=>r.ok?r.json():Promise.reject(r)).finally(()=>clearTimeout(timer));
}
function renderBackendStatus(){
 const s=u();
 $('backendStatus').textContent=backend.online?s.backendOnline:s.backendOffline;
 if(!backend.online)return;
 const names=backend.providers.map(p=>p.name);
 $('sourceStatus').textContent=names.length?s.providersReady+names.join(', '):s.noProviderSources;
 $('sourceSub').textContent=names.length?s.providersSub:s.noProviderSub;
 $('loadListings').classList.toggle('hidden',!names.length);
}
function detectBackend(){
 if(!/^https?:$/.test(location.protocol))return;
 api('health').then(h=>{backend.online=!!h.ok;renderBackendStatus()},()=>{});
}
function refreshSources(){
 if(!backend.online)return;
 api('sources?country='+encodeURIComponent($('country').value)).then(r=>{backend.providers=(r.providers||[]).filter(p=>p.configured);renderBackendStatus()},()=>{});
}
function loadListings(){
 const s=u();
 $('manualResult').textContent=s.loading;
 const body={country:$('country').value,make:$('make').value,model:$('model').value,year:Number($('year').value),mileage:Number($('mileage').value),fuel:$('fuel').value,transmission:$('trans').value};
 api('listings/search',{method:'POST',body:JSON.stringify(body)}).then(r=>{
  const listings=(r.listings||[]).slice(0,MAX_COMPS);
  compCount=Math.max(5,listings.length);
  buildCompRows(listings.map(l=>({link:l.url||'',text:'',price:l.price?String(l.price):'',meta:JSON.stringify(l)})));
  $('manualResult').textContent=s.loadedN+listings.length;
 },()=>{$('manualResult').textContent=s.loadFailed});
}

// --- Quick make/model search ---
const catalogue={};
Object.keys(modelOptions).forEach(m=>{if(m!==OTHER_MAKE)catalogue[m]=modelOptions[m].filter(x=>x!==OTHER_MODEL)});
let suggestions=[],activeSuggestion=-1;
function renderSuggestions(){
 const list=$('quickSearchList'),q=$('quickSearch').value;
 if(!q.trim()){suggestions=[];closeSuggestions();return}
 suggestions=core.searchVehicles(q,catalogue,8);activeSuggestion=suggestions.length?0:-1;
 list.replaceChildren(...(suggestions.length?suggestions.map((sug,i)=>{
  const li=el('li',{id:'sug'+i,textContent:sug.make+' '+sug.model});li.setAttribute('role','option');
  li.addEventListener('pointerdown',e=>e.preventDefault());li.addEventListener('click',()=>chooseSuggestion(i));
  return li;
 }):[el('li',{className:'none',textContent:u().quickSearchNone})]));
 list.classList.remove('hidden');$('quickSearch').setAttribute('aria-expanded','true');
 updateActiveSuggestion();
}
function updateActiveSuggestion(){
 [...$('quickSearchList').children].forEach((li,i)=>li.setAttribute('aria-selected',String(i===activeSuggestion)));
 if(activeSuggestion>=0)$('quickSearch').setAttribute('aria-activedescendant','sug'+activeSuggestion);else $('quickSearch').removeAttribute('aria-activedescendant');
}
function closeSuggestions(){
 $('quickSearchList').classList.add('hidden');$('quickSearch').setAttribute('aria-expanded','false');$('quickSearch').removeAttribute('aria-activedescendant');
}
function chooseSuggestion(i){
 const sug=suggestions[i];if(!sug)return;
 $('make').value=sug.make;setModels();$('model').value=sug.model;
 $('quickSearch').value=sug.make+' '+sug.model;closeSuggestions();saveState();$('year').focus();
}
function onQuickSearchKey(e){
 const open=!$('quickSearchList').classList.contains('hidden');
 if((e.key==='ArrowDown'||e.key==='ArrowUp')&&suggestions.length){
  e.preventDefault();
  if(!open)renderSuggestions();
  else activeSuggestion=(activeSuggestion+(e.key==='ArrowDown'?1:-1)+suggestions.length)%suggestions.length;
  updateActiveSuggestion();
 }else if(e.key==='Enter'&&open&&activeSuggestion>=0){e.preventDefault();chooseSuggestion(activeSuggestion)}
 else if(e.key==='Escape')closeSuggestions();
}

// --- Saved progress (this browser only) ---
const STORE_KEY='autovalue:v1';
const FIELDS=['country','make','model','year','mileage','fuel','trans','powerUnit','powerEntry','color','price','vin','sellerPros','sellerCons','trim','condition'];
let restoring=true,saveTimer;
function saveState(){
 if(restoring)return;
 const state={v:1,lang:lang(),mode,step,compCount,garageId:currentGarageId||undefined,demo:isDemo||undefined,compared:!!lastSummary,adjust:$('adjustToggle').checked,fields:{},equipment:[...document.querySelectorAll('.equipment-check:checked')].map(c=>c.value),rows:readRows()};
 FIELDS.forEach(id=>{state.fields[id]=$(id).value});
 try{localStorage.setItem(STORE_KEY,JSON.stringify(state))}catch(e){}
}
function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveState,300)}
function restoreState(){
 let st=null;
 try{st=JSON.parse(localStorage.getItem(STORE_KEY)||'null')}catch(e){}
 if(!st||st.v!==1)return;
 try{
  if(translations[st.lang])$('lang').value=st.lang;
  currentGarageId=typeof st.garageId==='string'?st.garageId:null;isDemo=!!st.demo;
  if(st.mode==='buy'||st.mode==='sell'){mode=st.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('selected',x.dataset.mode===mode));updateModeFields()}
  const f=st.fields||{},set=id=>{if(typeof f[id]==='string')$(id).value=f[id]};
  set('country');set('make');setModels();
  FIELDS.filter(id=>id!=='country'&&id!=='make').forEach(set);
  previousPowerUnit=$('powerUnit').value;
  (st.equipment||[]).forEach(v=>{const c=[...document.querySelectorAll('.equipment-check')].find(x=>x.value===v);if(c)c.checked=true});
  $('adjustToggle').checked=st.adjust!==false;
  compCount=Math.min(MAX_COMPS,Math.max(5,Number(st.compCount)||5));
  applyLang();
  buildCompRows(Array.isArray(st.rows)?st.rows.slice(0,MAX_COMPS):[]);
  if(st.step===2)show(2);
  else if(st.step===3&&analyse(true)&&st.compared)comparePrices();
 }catch(e){}
}
function resetAll(){
 if(!confirm(u().resetSaves))return;
 stashCurrent();
 try{localStorage.removeItem(STORE_KEY)}catch(e){}
 restoring=true;location.replace(location.pathname);
}

// --- My garage, shared reports and the example ---
const GARAGE_KEY='autovalue:garage',NOTICE_KEY='autovalue:notice',MAX_GARAGE=20;
let currentGarageId=null,isDemo=false;
function readJson(storage,key,fallback){try{const v=JSON.parse(storage.getItem(key)||'null');return v==null?fallback:v}catch(e){return fallback}}
function writeJson(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true}catch(e){return false}}
function garage(){const g=readJson(localStorage,GARAGE_KEY,[]);return Array.isArray(g)?g.filter(x=>x&&x.id&&x.state):[]}
// Copies the current valuation into My garage (updating its earlier copy). The example is never stored.
function stashCurrent(){
 saveState();
 const st=readJson(localStorage,STORE_KEY,null);
 if(!st||st.demo||!st.fields||!st.fields.make||!st.fields.model)return null;
 const list=garage(),id=st.garageId||'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 const old=list.find(x=>x.id===id);
 st.garageId=id;currentGarageId=id;
 const median=lastSummary?Math.round(lastSummary.result.stats.median):(old?old.median:null);
 writeJson(localStorage,GARAGE_KEY,[{id,savedAt:Date.now(),median,state:st}].concat(list.filter(x=>x.id!==id)).slice(0,MAX_GARAGE));
 writeJson(localStorage,STORE_KEY,st);
 return id;
}
// Replaces the current valuation and reloads, so the page starts from a clean form.
function openState(st,noticeKey){
 writeJson(localStorage,STORE_KEY,st);
 if(noticeKey)writeJson(sessionStorage,NOTICE_KEY,noticeKey);
 restoring=true;location.replace(location.pathname);
}
function renderGarage(){
 const s=u(),list=garage(),box=$('garageList');
 $('garage').classList.toggle('hidden',!list.length);
 box.replaceChildren(...list.map(g=>{
  const f=g.state.fields||{},model=f.model===OTHER_MODEL?s.otherModel:f.model||'';
  const title=[f.make===OTHER_MAKE?s.otherMake:f.make,model,f.year].filter(Boolean).join(' ');
  const details=[new Date(g.savedAt).toLocaleDateString(locale()),g.median?s.median+money(g.median):s.garageNoResult];
  if(g.id===currentGarageId)details.push(s.garageCurrent);
  const open=el('button',{type:'button',className:'btn quiet',textContent:s.garageOpen,disabled:g.id===currentGarageId});
  const del=el('button',{type:'button',className:'btn quiet',textContent:s.garageDelete});
  open.addEventListener('click',()=>{stashCurrent();openState(g.state,'openedFromGarage')});
  del.addEventListener('click',()=>{
   if(!confirm(s.garageDeleteConfirm))return;
   writeJson(localStorage,GARAGE_KEY,garage().filter(x=>x.id!==g.id));
   if(g.id===currentGarageId){currentGarageId=null;saveState()}
   renderGarage();
  });
  return el('li',{className:'garage-item'+(g.id===currentGarageId?' current':'')},[el('div',{},[el('b',{textContent:title}),el('small',{textContent:details.join(' · ')})]),el('div',{className:'garage-actions'},[open,del])]);
 }));
}
function showPendingNotice(){
 const key=readJson(sessionStorage,NOTICE_KEY,null);
 if(!key)return;
 try{sessionStorage.removeItem(NOTICE_KEY)}catch(e){}
 if(typeof u()[key]==='string')notify(u()[key]);
}
function saveToGarage(){if(stashCurrent()){notify(u().garageSaved);renderGarage()}}
const DEMO_ADS=[[2017,150000,12900],[2018,135000,14200],[2018,110000,15400],[2019,95000,16900],[2018,125000,14600],[2017,118000,13900],[2019,140000,15200],[2020,80000,18900]];
function loadDemo(){
 stashCurrent();
 const rows=DEMO_ADS.map(([year,km,price])=>({link:'',text:'',price:String(price),meta:JSON.stringify({price,year,km,kw:110,hp:150,fuel:'Diesel',transmission:'Manual'})}));
 openState({v:1,lang:lang(),mode:'buy',step:3,compCount:rows.length,compared:true,adjust:true,demo:true,equipment:[],rows,
  fields:{country:$('country').value,make:'Škoda',model:'Octavia',year:'2018',mileage:'120000',fuel:'Diesel',trans:'Manual',powerUnit:'kw',powerEntry:'110',color:'',price:'',vin:'',sellerPros:'',sellerCons:'',trim:'',condition:''}},null);
}
function shareReport(){
 const s=u();saveState();
 const st=readJson(localStorage,STORE_KEY,null);if(!st)return;
 const fields={};
 // The VIN stays private; everything needed to rebuild the report is included.
 Object.keys(st.fields||{}).forEach(k=>{if(k!=='vin'&&st.fields[k])fields[k]=st.fields[k]});
 const rows=(st.rows||[]).filter(r=>r.link||r.price).map(r=>({link:r.link,price:r.price,meta:r.meta}));
 const url=location.origin+location.pathname+'#r='+core.encodeState({v:1,lang:st.lang,mode:st.mode,adjust:st.adjust,demo:st.demo,fields,equipment:st.equipment,rows});
 if(navigator.share){navigator.share({title:s.shareText,url}).catch(()=>{});return}
 navigator.clipboard.writeText(url).then(()=>notify(s.shareCopied),()=>prompt(s.sharePrompt,url));
}
// Opens a report from a "#r=" link. Returns true when the page is reloading into it.
function openSharedReport(){
 if(!location.hash.startsWith('#r='))return false;
 let p=null;
 try{p=core.decodeState(location.hash.slice(3))}catch(e){}
 if(!p||p.v!==1||!p.fields||typeof p.fields!=='object'){
  history.replaceState(null,'',location.pathname);writeJson(sessionStorage,NOTICE_KEY,'sharedInvalid');return false;
 }
 const fields={},str=v=>typeof v==='string'?v.slice(0,5000):'';
 FIELDS.forEach(k=>{fields[k]=str(p.fields[k])});
 const rows=(Array.isArray(p.rows)?p.rows:[]).slice(0,MAX_COMPS).map(r=>({link:/^https?:\/\//i.test(str(r.link))?str(r.link):'',text:'',price:String(Number(r.price)>0?Number(r.price):''),meta:str(r.meta)}));
 stashCurrent();
 openState({v:1,lang:translations[p.lang]?p.lang:lang(),mode:p.mode==='sell'?'sell':'buy',step:3,compCount:Math.max(5,rows.length),compared:true,adjust:p.adjust!==false,demo:!!p.demo,
  equipment:Array.isArray(p.equipment)?p.equipment.filter(x=>typeof x==='string'):[],rows,fields},'sharedLoaded');
 return true;
}

// --- Ads sent from the browser extension (#ad=…) or the phone's share menu (?url=&text=) ---
let noticeTimer;
function notify(text){
 const n=$('notice');n.textContent=text;n.classList.remove('hidden');
 clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.classList.add('hidden'),8000);
}
function addIncomingAd(ad){
 const s=u(),link=/^https?:\/\//i.test(ad.url||'')?ad.url.trim():'';
 const text=[ad.title,ad.text].filter(Boolean).join('\n').slice(0,50000);
 if(!link&&!text.trim())return;
 const rows=readRows();
 if(link&&rows.some(r=>r.link.trim()===link)){notify(s.adDuplicate);return}
 let i=rows.findIndex(r=>!r.link.trim()&&!r.text.trim()&&!r.price);
 if(i<0){
  if(compCount>=MAX_COMPS){notify(s.adsFull);return}
  compCount++;rows.push({link:'',text:'',price:'',meta:''});i=rows.length-1;
 }
 rows[i]={link,text,price:'',meta:''};
 buildCompRows(rows);
 const meta=parseMeta($('link'+(i+1)).dataset.meta);
 notify(fill(meta.price?s.adAdded:s.adAddedNoPrice,{n:i+1}));
 if(step===3)$('compRows').children[i].scrollIntoView({block:'center'});
}
function readIncomingAd(){
 const clean=()=>history.replaceState(null,'',location.pathname);
 if(location.hash.startsWith('#ad=')){
  try{addIncomingAd(JSON.parse(decodeURIComponent(location.hash.slice(4))))}catch(e){}
  clean();return;
 }
 const q=new URLSearchParams(location.search);
 if(q.has('url')||q.has('text')){
  let url=q.get('url')||'',text=q.get('text')||'';
  // Android apps often put the link inside the shared text.
  const m=!url&&text.match(/https?:\/\/\S+/);
  if(m){url=m[0];text=text.replace(m[0],'').trim()}
  addIncomingAd({url,title:q.get('title')||'',text});
  clean();
 }
}

// --- Init ---
populateMakes();
populateYears();
setModels();
$('make').addEventListener('change',setModels);
$('powerEntry').addEventListener('input',updatePowerConversion);
$('powerUnit').addEventListener('change',onPowerUnitChange);
$('decodeVin').addEventListener('click',checkVin);
$('lang').addEventListener('change',applyLang);
$('country').addEventListener('change',()=>{const m={SI:'sl',DE:'de',AT:'de',IT:'it',HR:'hr'}[$('country').value];if(m){$('lang').value=m;applyLang()}});
$('next').addEventListener('click',()=>show(2));
$('back').addEventListener('click',()=>show(1));
$('edit').addEventListener('click',()=>show(2));
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('selected',x===b));updateModeFields();saveState()}));
$('analyse').addEventListener('click',analyse);
$('copy').addEventListener('click',copySummary);
$('comparePrices').addEventListener('click',comparePrices);
$('addComp').addEventListener('click',addRow);
$('loadListings').addEventListener('click',loadListings);
$('quickSearch').addEventListener('input',renderSuggestions);
$('quickSearch').addEventListener('keydown',onQuickSearchKey);
$('quickSearch').addEventListener('blur',closeSuggestions);
$('print').addEventListener('click',()=>window.print());
$('reset').addEventListener('click',resetAll);
$('demo').addEventListener('click',loadDemo);
$('share').addEventListener('click',shareReport);
$('saveGarage').addEventListener('click',saveToGarage);
document.addEventListener('input',saveSoon);
document.addEventListener('change',saveSoon);
if(!openSharedReport()){
 // First visit: pick the market and language from the browser language.
 if(!readJson(localStorage,STORE_KEY,null)){const m=core.marketForLocale(navigator.language);if(m){$('country').value=m.country;$('lang').value=m.lang}}
 updateModeFields();
 applyLang();
 restoreState();
 restoring=false;
 readIncomingAd();
 saveState();
 detectBackend();
 showPendingNotice();
}
// Another tab (e.g. one opened by the extension) saved new entries: refresh this one if it is in the background.
window.addEventListener('hashchange',()=>{if(!openSharedReport()){showPendingNotice();readIncomingAd()}});
window.addEventListener('storage',e=>{if(e.key===STORE_KEY&&document.hidden)location.reload()});
if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
