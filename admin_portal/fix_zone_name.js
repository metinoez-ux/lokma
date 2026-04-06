const {initializeApp,cert}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
const sa=require("./service-account.json");
const app=initializeApp({credential:cert(sa)},"fixzone"+Date.now());
const db=getFirestore(app);
const KID="FqEryG6UAXn4mLna2j8S";

(async()=>{
  // 1) Fix products prepZone: rename "Erkekler Standı2" -> "Erkekler Standi"
  const prods=await db.collection(`kermes_events/${KID}/products`).get();
  let fixed=0;
  for(const d of prods.docs){
    const pz=d.data().prepZone;
    if(Array.isArray(pz)&&pz.some(z=>z.includes("2"))){
      const newPz=pz.map(z=>z.replace(/Erkekler Standi2/gi,"Erkekler Standi").replace(/Erkekler Standı2/gi,"Erkekler Standi"));
      if(JSON.stringify(newPz)!==JSON.stringify(pz)){
        await d.ref.update({prepZone:newPz});
        console.log(`Fixed product: ${d.data().name} | ${JSON.stringify(pz)} -> ${JSON.stringify(newPz)}`);
        fixed++;
      }
    }
  }
  console.log(`Products fixed: ${fixed}/${prods.size}`);

  // 2) Fix tableSectionsV2 prepZones
  const kDoc=await db.doc(`kermes_events/${KID}`).get();
  const sections=kDoc.data()?.tableSectionsV2||[];
  let sectionFixed=false;
  const newSections=sections.map(s=>{
    const newPz=(s.prepZones||[]).map(z=>z.replace(/Erkekler Standi2/gi,"Erkekler Standi").replace(/Erkekler Standı2/gi,"Erkekler Standi"));
    if(JSON.stringify(newPz)!==JSON.stringify(s.prepZones||[])){sectionFixed=true;}
    return{...s,prepZones:newPz};
  });
  if(sectionFixed){
    await db.doc(`kermes_events/${KID}`).update({tableSectionsV2:newSections});
    console.log("tableSectionsV2 fixed");
  }

  // 3) Fix prepZoneAssignments keys
  const pza=kDoc.data()?.prepZoneAssignments||{};
  const newPza={};
  let pzaFixed=false;
  for(const[k,v] of Object.entries(pza)){
    const nk=k.replace(/Erkekler Standi2/gi,"Erkekler Standi").replace(/Erkekler Standı2/gi,"Erkekler Standi");
    if(nk!==k)pzaFixed=true;
    newPza[nk]=v;
  }
  if(pzaFixed){
    await db.doc(`kermes_events/${KID}`).update({prepZoneAssignments:newPza});
    console.log("prepZoneAssignments keys fixed");
  }

  // Also list ALL current zones for verification
  console.log("\nCurrent zones in tableSectionsV2:");
  const finalDoc=await db.doc(`kermes_events/${KID}`).get();
  (finalDoc.data()?.tableSectionsV2||[]).forEach(s=>{
    console.log(`  ${s.name}: ${JSON.stringify(s.prepZones||[])}`);
  });
  console.log("\nCurrent prepZoneAssignments keys:",Object.keys(finalDoc.data()?.prepZoneAssignments||{}));
  
  process.exit(0);
})();
