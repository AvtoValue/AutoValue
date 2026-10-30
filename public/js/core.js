// Pure logic shared by the browser app and the Node tests: no DOM access here.
(function(root){
'use strict';

// 1 kW = 1.3596216173 metric horsepower (KM/PS/CV).
const KW_TO_HP=1.3596216173;
const kwToHp=kw=>kw*KW_TO_HP;
const hpToKw=hp=>hp/KW_TO_HP;

function isValidVinFormat(vin){return /^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin||'').trim().toUpperCase())}

// Parses "12.990", "12,990", "12 990", "12.990,00", "12,990.00", "12'990" and "12.990,-".
function parseNumber(str){
 let s=String(str).trim().replace(/[\s  ']/g,'').replace(/[.,]-$/,'');
 if(!s)return NaN;
 const lastDot=s.lastIndexOf('.'),lastComma=s.lastIndexOf(',');
 if(lastDot>-1&&lastComma>-1){
  const dec=lastDot>lastComma?'.':',';
  s=s.split(dec==='.'?',':'.').join('').replace(dec,'.');
 }else if(lastDot>-1||lastComma>-1){
  const parts=s.split(lastDot>-1?'.':',');
  // Several separators, or one followed by exactly three digits, means thousands grouping.
  s=parts.length>2||parts[parts.length-1].length===3?parts.join(''):parts.join('.');
 }
 return /^\d+(\.\d+)?$/.test(s)?Number(s):NaN;
}

const NUM='\\d{1,3}(?:[.,\\u00a0\\u202f\' ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?';
const MONTHLY=/(\/\s*(mes|mesec|month|mo|monat|mese|mj|mois)\b|mesečn|monthly|per month|monatl|mtl\.|al mese|mjesečn|par mois|obrok|rata\b|leasing|financ|kredit)/i;
const PRICE_LABEL=/(cena|price|preis|prezzo|cijena|prix|precio|cena vozila)\s*[:\-]?[^0-9€\n]{0,30}$/i;
const SALE_LABEL=/(akcijsk|akcija|special price|sale price|aktionspreis|sonderpreis|prezzo promo|offerta|akcijska cijena)[^0-9€\n]{0,30}$/i;

function priceCandidates(t){
 const out=[];
 const re=new RegExp('(?:€|\\bEUR\\b)\\s*('+NUM+')|('+NUM+')\\s*(?:,-|\\.-)?\\s*(?:€|\\bEUR\\b)','gi');
 let m;
 while((m=re.exec(t))){
  const value=parseNumber(m[1]||m[2]);
  if(!(value>=100&&value<=2000000))continue;
  const before=t.slice(Math.max(0,m.index-40),m.index),after=t.slice(m.index+m[0].length,m.index+m[0].length+25);
  const sameLine=before.slice(before.lastIndexOf('\n')+1).slice(-20);
  if(MONTHLY.test(after.split('\n')[0])||MONTHLY.test(sameLine))continue;
  out.push({value,labeled:PRICE_LABEL.test(before),sale:SALE_LABEL.test(before)});
 }
 return out;
}

const YEAR_LABEL='prva registracija|1\\.\\s*registracija|datum prve registracije|letnik|first registration|registration date|year of manufacture|model year|year|erstzulassung|\\bEZ\\b|baujahr|immatricolazione|anno|godina proizvodnje|godište|prva registracija|mise en circulation|année';
const KM_LABEL='prevo[žz]enih\\s*km|prevo[žz]eni\\s*km|kilometrina|kilometri|kilometra[žz]a|kilometerstand|km[\\s-]*stand|mileage|odometer|chilometraggio|chilometri|prije[đd]eni kilometri|kilom[eé]trage';
const RANGE_LABEL=/(domet|range|reichweite|autonomia|autonomie)[^0-9\n]{0,20}$/i;

function extractYear(t){
 const maxYear=new Date().getFullYear()+1,ok=y=>y>=1950&&y<=maxYear;
 const re=new RegExp('(?:^|[^\\p{L}])(?:'+YEAR_LABEL+')[^0-9\\n]{0,25}(?:(?:\\d{1,2}[./-]\\s*){1,2})?((?:19|20)\\d{2})\\b','giu');
 let m;
 while((m=re.exec(t))){const y=Number(m[1]);if(ok(y))return y}
 m=t.match(/\b(?:0[1-9]|1[0-2])\/((?:19|20)\d{2})\b/);
 if(m&&ok(Number(m[1])))return Number(m[1]);
}

function extractKm(t){
 let m=t.match(new RegExp('(?:'+KM_LABEL+')[^0-9\\n]{0,25}('+NUM+')','i'));
 if(m){const v=parseNumber(m[1]);if(v>=0&&v<2000000)return Math.round(v)}
 // Lower-case "km" only: "150 KM" in Slovenian/Croatian ads means horsepower.
 const re=new RegExp('('+NUM+')\\s*(?:km|Km)\\b(?!\\s*\\/\\s*h)','g');
 while((m=re.exec(t))){
  if(RANGE_LABEL.test(t.slice(Math.max(0,m.index-30),m.index)))continue;
  const v=parseNumber(m[1]);if(v>=0&&v<2000000)return Math.round(v);
 }
}

function extractPower(t){
 const d={};
 let m=t.match(/\b(\d{2,4}(?:[.,]\d)?)\s*kW\b/i);
 if(m){const v=parseNumber(m[1]);if(v>=10&&v<=1500)d.kw=v}
 m=t.match(/\b(\d{2,4})\s*(?:KM|PS|CV|KS|hp|HP|bhp|ch)\b/);
 if(m){const v=Number(m[1]);if(v>=10&&v<=2000)d.hp=v}
 if(d.kw&&!d.hp)d.hp=Math.round(kwToHp(d.kw));
 if(d.hp&&!d.kw)d.kw=Math.round(hpToKw(d.hp));
 return d;
}

// Engine displacement in cm³, from "Prostornina motorja: 1.798 ccm", "Hubraum 1598 cm³" or a model
// name such as "1.4 i-VTEC" / "2,0 TDI". Values below 10 are litres.
const CC_LABEL='prostornina(?:\\s*motorja)?|delovna\\s*prostornina|hubraum|cilindrata|engine\\s*size|displacement|capacity|obujam(?:\\s*motora)?|radni\\s*obujam|cylindr[ée]e';
const ENGINE_WORDS='TDI|TSI|TFSI|FSI|CDI|CRDi|TDCi|dCi|HDi|BlueHDi|JTDm?|MultiJet|i-?VTEC|VTEC|i-?DTEC|i-?CTDi|MPI|T?-?GDI|VVT-?i|D-4D|SkyActiv-?[GDX]?|EcoBoost|PureTech|TCe|e-?HDi|TwinAir|MultiAir|THP|VTi|16V|8V|turbo|benzin|bencin|dizel|diesel|[idDT]';
function extractDisplacement(t){
 t=String(t||'');
 const ok=cc=>cc>=500&&cc<=8500?Math.round(cc):undefined;
 let m=t.match(new RegExp('(?:'+CC_LABEL+')[^0-9\\n]{0,25}('+NUM+')\\s*(ccm|cm3|cm³|ccm³|cc|l\\b)?','i'));
 if(m){const v=parseNumber(m[1]);const cc=v<10?v*1000:v;if(ok(cc))return ok(cc)}
 m=t.match(/\b(\d{3,4}|\d\.\d{3})\s*(?:ccm|cm3|cm³|ccm³|cc)\b/i);
 if(m){const v=parseNumber(m[1]);if(ok(v))return ok(v)}
 // "l/100 km" is fuel consumption, not engine size.
 m=t.match(new RegExp('(?:^|[\\s(/])(\\d[.,]\\d\\d?)\\s*(?:l\\b(?!\\s*/)|(?:'+ENGINE_WORDS+')\\b)'));
 if(m){const v=parseNumber(m[1].replace(',','.'));if(v>=0.6&&v<=8.5)return Math.round(v*1000)}
}

const FUEL_RULES=[
 ['Plug-in hybrid',/plug-?in|\bPHEV\b|priključn/i],
 ['Hybrid',/hybrid|hibrid|\bHEV\b|ibrida/i],
 ['Diesel',/diesel|dizel|\bTDI\b|\bCDI\b|\bdCi\b|\bHDi\b|BlueHDi|\bCRDi\b|\bTDCi\b|\bJTDm?\b|multijet|gasolio/i],
 ['LPG',/\bLPG\b|\bplin\b|autogas|\bGPL\b|\bCNG\b|metan/i],
 ['Petrol',/bencin|benzin|petrol|gasoline|\bTSI\b|\bTFSI\b|\bbenzina\b|essence/i],
];
// "Electric" is only accepted next to a fuel label: "električni pomik stekel" (electric windows) is common.
const ELECTRIC=/elektri[čc]n|electric|elektro|\bBEV\b|elettric|électrique/i;
const FUEL_LABEL=/(gorivo|vrsta goriva|fuel(?: type)?|kraftstoff(?:art)?|alimentazione|carburante|carburant|pogon)\s*[:\-]?\s*([^\n]{0,30})/i;

function extractFuel(t){
 const m=t.match(FUEL_LABEL);
 if(m){
  for(const [name,re] of FUEL_RULES)if(re.test(m[2]))return name;
  if(ELECTRIC.test(m[2]))return 'Electric';
 }
 let best;
 for(const [name,re] of FUEL_RULES){const x=t.match(re);if(x&&(!best||x.index<best.index))best={name,index:x.index}}
 return best&&best.name;
}

const AUTO=/avtomat|automat|\bDSG\b|tiptronic|steptronic|\bCVT\b|\bS-?tronic\b|\bEDC\b|\bPDK\b|\bDCT\b|automatico|automatski/i;
const MANUAL=/ro[čc]n|manual|schalt|ru[čc]n|manuale|mécanique/i;
const TRANS_LABEL=/(menjalnik|vrsta menjalnika|getriebe(?:art)?|transmission|gearbox|cambio|mjenja[čc]|boîte)\s*[:\-]?\s*([^\n]{0,30})/i;

function extractTransmission(t){
 const m=t.match(TRANS_LABEL);
 if(m){if(AUTO.test(m[2]))return 'Automatic';if(MANUAL.test(m[2]))return 'Manual'}
 if(/\b(DSG|tiptronic|steptronic|S-?tronic|PDK)\b|avtomatski menjalnik|automatic transmission|automatikgetriebe|cambio automatico|automatski mjenjač/i.test(t))return 'Automatic';
 if(/ro[čc]ni menjalnik|manual transmission|schaltgetriebe|cambio manuale|ru[čc]ni mjenja[čc]/i.test(t))return 'Manual';
}

// Reads the facts AutoValue needs from text a user copied out of a listing page.
function extractAd(text){
 const t=String(text||'').replace(/ | /g,' ');
 const d={};
 const prices=priceCandidates(t);
 const pick=prices.find(p=>p.sale)||prices.find(p=>p.labeled)||prices[0];
 if(pick)d.price=pick.value;
 const year=extractYear(t);if(year)d.year=year;
 const km=extractKm(t);if(km!==undefined)d.km=km;
 Object.assign(d,extractPower(t));
 const fuel=extractFuel(t);if(fuel)d.fuel=fuel;
 const trans=extractTransmission(t);if(trans)d.transmission=trans;
 const cc=extractDisplacement(t);if(cc)d.cc=cc;
 return d;
}

// Lists how a comparable ad differs from the user's car: 'year','km','fuel','transmission','power','engine'.
function comparabilityWarnings(ad,target){
 const w=[];if(!ad||!target)return w;
 if(ad.year&&target.year&&Math.abs(ad.year-target.year)>1)w.push('year');
 if(ad.km!==undefined&&target.km&&Math.abs(ad.km-target.km)>50000)w.push('km');
 const known=v=>v&&v!=='Other';
 if(known(ad.fuel)&&known(target.fuel)&&ad.fuel!==target.fuel)w.push('fuel');
 if(known(ad.transmission)&&known(target.transmission)&&ad.transmission!==target.transmission)w.push('transmission');
 if(ad.kw&&target.kw&&Math.abs(ad.kw-target.kw)/target.kw>0.15)w.push('power');
 // The user picks a size to the nearest 100 cm³; the ad's exact figure (1798) must round to the
 // same value (1800). 1339 or 1493 do not count as 1400.
 if(ad.cc&&target.cc&&Math.round(ad.cc/100)!==Math.round(target.cc/100))w.push('engine');
 return w;
}

function quantile(sorted,q){
 const pos=(sorted.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);
}

// Basic statistics. With four or more prices, a price is an outlier when it is outside Tukey's
// 1.5×IQR fence and also more than 25% away from the median (the fence alone is too strict for
// the handful of ads users enter).
function priceStats(prices){
 const all=prices.filter(n=>Number.isFinite(n)&&n>0).sort((a,b)=>a-b);
 if(!all.length)return null;
 let kept=all,outliers=[];
 if(all.length>=4){
  const q1=quantile(all,.25),q3=quantile(all,.75),iqr=q3-q1;
  const lo=q1-1.5*iqr,hi=q3+1.5*iqr,med=quantile(all,.5);
  const isOutlier=v=>(v<lo||v>hi)&&Math.abs(v-med)>med*0.25;
  kept=all.filter(v=>!isOutlier(v));outliers=all.filter(isOutlier);
 }
 const mean=kept.reduce((a,b)=>a+b,0)/kept.length;
 const sd=Math.sqrt(kept.reduce((a,b)=>a+(b-mean)**2,0)/kept.length);
 return {n:kept.length,mean,median:quantile(kept,.5),min:kept[0],max:kept[kept.length-1],q1:quantile(kept,.25),q3:quantile(kept,.75),cv:mean?sd/mean:0,outliers};
}

// Turns entered asking prices into a buying range or a verdict on the seller's asking price.
function summarizeComparison({prices,mode,askingPrice}){
 const stats=priceStats(prices||[]);
 if(!stats)return null;
 const levels=['low','medium','high'];
 let level=stats.n<3?0:stats.n<6?1:2;
 const highSpread=stats.n>=3&&stats.cv>0.25;
 if(highSpread&&level>0)level--;
 const res={stats,confidence:levels[level],highSpread};
 if(mode==='buy'){
  res.buyRange=[stats.n>=4?stats.q1:stats.min,stats.median];
 }else if(askingPrice>0){
  res.tolerance=Math.max(500,Math.round(stats.median*0.05));
  res.diff=askingPrice-stats.median;
  res.verdict=res.diff>res.tolerance?'high':res.diff<-res.tolerance?'low':'fair';
 }
 return res;
}

// Fits price against year and mileage across comparable ads (least squares on centred data), so each
// ad can be brought to the user's car. Returns null when the data is too thin, too collinear or
// implausible (an older or higher-mileage car must not come out more expensive).
function depreciationModel(ads){
 const pts=(ads||[]).filter(a=>a.price>0&&a.year>0&&Number.isFinite(a.km));
 if(pts.length<5)return null;
 const feats=['year','km'].filter(f=>new Set(pts.map(p=>p[f])).size>1);
 if(!feats.length)return null;
 const mean=k=>pts.reduce((s,p)=>s+p[k],0)/pts.length;
 const my=mean('price'),mx=feats.map(mean);
 const X=pts.map(p=>feats.map((f,i)=>p[f]-mx[i])),y=pts.map(p=>p.price-my);
 const A=feats.map((_,i)=>feats.map((_,j)=>X.reduce((s,r)=>s+r[i]*r[j],0)));
 const v=feats.map((_,i)=>X.reduce((s,r,k)=>s+r[i]*y[k],0));
 let coef;
 if(feats.length===1)coef=[v[0]/A[0][0]];
 else{
  const det=A[0][0]*A[1][1]-A[0][1]*A[1][0];
  // 1 - r² below 0.02 means year and mileage move together too closely to separate their effects.
  if(det/(A[0][0]*A[1][1])<0.02)return null;
  coef=[(v[0]*A[1][1]-v[1]*A[0][1])/det,(A[0][0]*v[1]-A[1][0]*v[0])/det];
 }
 const m={perYear:0,perKm:0,n:pts.length};
 feats.forEach((f,i)=>{if(f==='year')m.perYear=coef[i];else m.perKm=coef[i]});
 if(m.perYear<0||m.perKm>0)return null;
 return m;
}

// Brings an ad's price to the target car's year and mileage. The change is capped at ±40% so a
// far-off ad cannot dominate; ads without year or mileage keep their price.
function adjustPrice(ad,target,model){
 if(!model||!(ad.price>0)||!(ad.year>0)||!Number.isFinite(ad.km)||!(target.year>0)||!Number.isFinite(target.km))return ad.price;
 const delta=model.perYear*(target.year-ad.year)+model.perKm*(target.km-ad.km);
 const cap=ad.price*0.4;
 return Math.round(ad.price+Math.max(-cap,Math.min(cap,delta)));
}

const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9+]+/g,' ').trim();

// Finds catalogue entries that match every typed word, e.g. "civic ty" -> Honda Civic Type R.
// Whole-word matches rank above prefixes, and shorter names (base models) come first on ties.
function searchVehicles(query,catalogue,limit){
 const words=fold(query).split(' ').filter(Boolean);
 if(!words.length)return [];
 const found=[];
 Object.keys(catalogue).forEach(make=>catalogue[make].forEach(model=>{
  const hay=fold(make+' '+model),tokens=hay.split(' '),compact=hay.replace(/ /g,'');
  let score=0;
  for(const w of words){
   if(tokens.includes(w))score+=3;
   else if(tokens.some(t=>t.startsWith(w)))score+=2;
   else if(compact.includes(w))score+=1;
   else return;
  }
  found.push({make,model,score,len:hay.length});
 }));
 return found.sort((a,b)=>b.score-a.score||a.len-b.len).slice(0,limit||8).map(({make,model})=>({make,model}));
}

// Share links carry the report state as base64url-encoded UTF-8 JSON in the URL fragment.
function encodeState(obj){
 const bytes=new TextEncoder().encode(JSON.stringify(obj));
 let bin='';bytes.forEach(b=>{bin+=String.fromCharCode(b)});
 return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeState(str){
 const b64=String(str).replace(/-/g,'+').replace(/_/g,'/');
 const bin=atob(b64+'='.repeat((4-b64.length%4)%4));
 return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0))));
}

// Round axis ticks (1, 2, 2.5 or 5 × 10^n) covering [min, max] with about `count` steps.
function niceTicks(min,max,count){
 if(!(max>min)){const v=Number.isFinite(min)?min:0;return [v]}
 const raw=(max-min)/Math.max(1,count||5),mag=Math.pow(10,Math.floor(Math.log10(raw)));
 const step=[1,2,2.5,5,10].map(f=>f*mag).find(st=>st>=raw);
 const ticks=[];
 for(let v=Math.floor(min/step)*step;v<=max+step*1e-9;v+=step)ticks.push(Math.round(v*1e6)/1e6);
 if(ticks[ticks.length-1]<max)ticks.push(ticks[ticks.length-1]+step);
 return ticks;
}

// Picks the market and page language from the browser language, e.g. "de-AT" -> Austria, German.
function marketForLocale(locale){
 const [l,r]=String(locale||'').toLowerCase().split(/[-_]/);
 if(l==='sl')return {country:'SI',lang:'sl'};
 if(l==='hr')return {country:'HR',lang:'hr'};
 if(l==='it')return {country:'IT',lang:'it'};
 if(l==='de')return {country:r==='at'?'AT':'DE',lang:'de'};
 const other={fr:'FR',nl:'NL',es:'ES',pl:'PL'};
 if(other[l])return {country:other[l],lang:'en'};
 // Plain English is common on European devices, so only British English picks a market.
 if(l==='en'&&(r==='gb'||r==='uk'))return {country:'UK',lang:'en'};
 return null;
}

const FUEL_TERMS={Diesel:['diesel','dizel','TDI','CDI','dCi','JTD','i-DTEC','HDi'],Petrol:['petrol','bencin','benzin','gasoline','TSI','TFSI','VTEC'],Hybrid:['hybrid','hibrid'],'Plug-in hybrid':['plug-in hybrid','PHEV'],Electric:['electric','električni','električni pogon'],LPG:['LPG','plin'],Other:['fuel']};

// Builds the Google query used for "site:" searches on marketplace portals.
function buildVehicleQuery(v){
 const parts=[];
 if(v.make)parts.push('"'+v.make+'"');
 if(v.model)parts.push('"'+v.model+'"');
 if(v.year)parts.push('('+[v.year-1,v.year,v.year+1].map(y=>'"'+y+'"').join(' OR ')+')');
 if(Number.isFinite(v.mileage)&&v.mileage>0)parts.push(Math.max(0,v.mileage-50000)+'..'+(v.mileage+50000)+' km');
 const fuels=FUEL_TERMS[v.fuel]||[v.fuel];
 if(v.fuel)parts.push('('+fuels.map(x=>'"'+x+'"').join(' OR ')+')');
 if(v.mode==='sell'&&v.trim)parts.push('"'+v.trim+'"');
 if(v.hp>0){const hp=Math.round(v.hp),kw=Math.round(v.kw);parts.push('("'+hp+' KM" OR "'+hp+' PS" OR "'+hp+' hp" OR "'+kw+' kW")')}
 if(v.mode==='sell'&&v.equipment&&v.equipment.length)parts.push('('+v.equipment.map(x=>'"'+x+'"').join(' OR ')+')');
 if(v.transmission==='Manual')parts.push('(manual OR ročni OR Schaltgetriebe OR cambio manuale OR mjenjač)');
 else if(v.transmission==='Automatic')parts.push('(automatic OR avtomatski OR Automatik OR automatico OR automatski)');
 return parts.join(' ');
}

// Common engine sizes offered in the form (cm³, shown as litres).
const ENGINE_SIZES=[600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2700,2800,2900,3000,3200,3500,3700,4000,4200,4400,4700,5000,5500,6000,6500];

const api={ENGINE_SIZES,extractDisplacement,KW_TO_HP,kwToHp,hpToKw,isValidVinFormat,parseNumber,extractAd,comparabilityWarnings,priceStats,summarizeComparison,depreciationModel,adjustPrice,searchVehicles,encodeState,decodeState,niceTicks,marketForLocale,buildVehicleQuery};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AVCore=api;
})(this);
