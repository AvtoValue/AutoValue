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
function analyse(){
 const s=u();
 if(!$('make').value.trim()||!$('model').value.trim()||!$('year').value||!$('mileage').value){alert(s.required);return}
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
  const text=el('textarea',{id:'text'+i,rows:2,placeholder:s.paste});
  const info=el('div',{className:'comp-info',id:'info'+i,textContent:s.empty});
  const price=el('input',{type:'number',min:'1',id:'comp'+i,placeholder:s.price});price.setAttribute('aria-label',s.price+' '+i);
  const row=el('div',{className:'comp-row'},[el('div',{className:'comp-row-head'},[link,open]),text,el('div',{className:'comp-row-foot'},[info,price])]);
  if(i>5){const rm=el('button',{type:'button',className:'btn quiet comp-remove',textContent:s.remove});rm.addEventListener('click',()=>removeRow(i));row.append(el('div',{className:'comp-extra'},[el('span'),rm]))}
  box.append(row);
  const p=prev[i-1];
  if(p){link.value=p.link;text.value=p.text;price.value=p.price;if(p.meta)link.dataset.meta=p.meta}
  open.addEventListener('click',()=>openAd(i));
  text.addEventListener('input',()=>parseAdText(i));
  if(p&&p.text)parseAdText(i);else if(p&&p.meta)describeRow(i,JSON.parse(p.meta),true);
 }
 $('addComp').disabled=compCount>=MAX_COMPS;
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
 const ads=readRows().map((r,k)=>{const meta=r.meta?JSON.parse(r.meta):{};return {index:k+1,link:r.link.trim(),price:Number(r.price),meta}}).filter(a=>Number.isFinite(a.price)&&a.price>0);
 const result=core.summarizeComparison({prices:ads.map(a=>a.price),mode,askingPrice:Number($('price').value)});
 lastSummary=result?{result,ads}:null;
 renderComparison();
}
function renderComparison(){
 const s=u(),out=$('manualResult');
 if(!lastSummary){out.textContent=s.noPrices;return}
 const {result,ads}=lastSummary,st=result.stats;
 const line=(label,value)=>el('div',{},[el('strong',{textContent:label}),value]);
 const nodes=[
  line(s.rangeEntered,money(st.min)+' – '+money(st.max)),
  line(s.median,money(st.median)),
  line(s.mean,money(st.mean)),
  line(s.count,String(st.n)),
 ];
 if(st.outliers.length)nodes.push(line(s.outliers,st.outliers.map(money).join(', ')));
 nodes.push(line(s.confidence,s.conf[result.confidence]+(result.highSpread?s.spread:'')));
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
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('selected',x===b));updateModeFields()}));
$('analyse').addEventListener('click',analyse);
$('copy').addEventListener('click',copySummary);
$('comparePrices').addEventListener('click',comparePrices);
$('addComp').addEventListener('click',addRow);
$('loadListings').addEventListener('click',loadListings);
updateModeFields();
applyLang();
detectBackend();
})();
