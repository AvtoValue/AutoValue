// Shows the privacy page in the language from ?lang=, the saved AutoValue language, or English.
(function(){
'use strict';
const select=document.getElementById('legalLang');
const available=[...select.options].map(o=>o.value);
let lang=new URLSearchParams(location.search).get('lang');
if(!available.includes(lang)){try{lang=(JSON.parse(localStorage.getItem('autovalue:v1')||'{}')||{}).lang}catch(e){lang=null}}
if(!available.includes(lang))lang='en';
function show(l){
 document.querySelectorAll('.legal').forEach(a=>a.classList.toggle('hidden',a.dataset.lang!==l));
 document.documentElement.lang=l;select.value=l;
}
select.addEventListener('change',()=>show(select.value));
show(lang);
})();
