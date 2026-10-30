// Vehicle catalogue and marketplace sites used to build search links.
(function(root){
const modelOptions={
'Audi':['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','TT','e-tron'],
'BMW':['1 Series','2 Series','3 Series','4 Series','5 Series','6 Series','7 Series','X1','X3','X5','X6','Z4','i3','i4','iX'],
'Citroën':['C1','C3','C4','C5','Berlingo'],
'Dacia':['Sandero','Logan','Duster','Jogger','Spring'],
'Fiat':['500','Panda','Punto','Tipo','500X','Doblo'],
'Ford':['Fiesta','Focus','Mondeo','Puma','Kuga','EcoSport','Mustang','S-Max','Transit'],
'Honda':['Jazz','Civic','Accord','CR-V','HR-V','ZR-V','Type R'],
'Hyundai':['i10','i20','i30','Ioniq','Kona','Tucson','Santa Fe'],
'Kia':['Picanto','Rio','Ceed','Proceed','Niro','Sportage','Sorento','EV6'],
'Mazda':['Mazda2','Mazda3','Mazda6','CX-3','CX-30','CX-5','MX-5'],
'Mercedes-Benz':['A-Class','B-Class','C-Class','E-Class','S-Class','CLA','CLS','GLA','GLB','GLC','GLE','GLS','SLK / SLC'],
'MINI':['Cooper','One','Clubman','Countryman','Electric'],
'Mitsubishi':['Colt','Lancer','ASX','Outlander','Eclipse Cross'],
'Nissan':['Micra','Juke','Qashqai','X-Trail','Leaf','Navara'],
'Opel':['Corsa','Astra','Insignia','Mokka','Crossland','Grandland','Zafira'],
'Peugeot':['108','208','2008','308','3008','508','5008','Partner'],
'Porsche':['718','911','Panamera','Macan','Cayenne','Taycan'],
'Renault':['Twingo','Clio','Megane','Captur','Kadjar','Austral','Scenic','Kangoo'],
'Škoda':['Citigo','Fabia','Scala','Octavia','Superb','Kamiq','Karoq','Kodiaq','Enyaq'],
'SEAT':['Mii','Ibiza','Leon','Arona','Ateca','Tarraco'],
'Subaru':['Impreza','Legacy','Forester','Outback','XV / Crosstrek','BRZ'],
'Suzuki':['Swift','Ignis','Vitara','S-Cross','Jimny','Across'],
'Tesla':['Model 3','Model S','Model X','Model Y','Cybertruck'],
'Toyota':['Aygo','Yaris','Corolla','Camry','Prius','C-HR','RAV4','Land Cruiser','Hilux','Supra'],
'Volkswagen':['up!','Polo','Golf','Passat','Arteon','T-Cross','T-Roc','Tiguan','Touareg','Touran','ID.3','ID.4','Transporter'],
'Volvo':['C30','S60','S90','V40','V60','V90','XC40','XC60','XC90'],
'Other':['Other / not listed']
};
const marketSites={SI:[['Avto.net','avto.net'],['Bolha','bolha.com']],DE:[['mobile.de','mobile.de'],['AutoScout24','autoscout24.de']],AT:[['willhaben','willhaben.at'],['AutoScout24','autoscout24.at']],IT:[['Subito','subito.it'],['AutoScout24','autoscout24.it']],HR:[['Njuškalo','njuskalo.hr'],['AutoScout24','autoscout24.hr']],FR:[['Leboncoin','leboncoin.fr'],['La Centrale','lacentrale.fr']],NL:[['Marktplaats','marktplaats.nl'],['AutoScout24','autoscout24.nl']],UK:[['Auto Trader','autotrader.co.uk'],['Motors','motors.co.uk']],US:[['Cars.com','cars.com'],['AutoTrader','autotrader.com']],ES:[['Coches.net','coches.net'],['AutoScout24','autoscout24.es']],PL:[['OTOMOTO','otomoto.pl'],['OLX','olx.pl']]};
const api={modelOptions,marketSites};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AVData=api;
})(this);
