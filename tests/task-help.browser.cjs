const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const context = await browser.newContext({viewport:{width:390,height:844}});
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/sync.js*',r=>r.abort());
 await page.goto('http://127.0.0.1:8000/');
 await page.locator('#task').fill('Reclamar factura');await page.locator('#task-form button').click();
 await page.locator('.task-help').click();
 await page.locator('#help-step').fill('Pedir justificante por correo');
 await page.locator('#help-context').fill('El importe es incorrecto');
 assert.match(await page.locator('#help-prompt').inputValue(), /El importe es incorrecto/);
 await page.locator('#help-save').click();
 await page.locator('#help-copy').click();
 assert.match(await page.evaluate(()=>navigator.clipboard.readText()), /Reclamar factura/);
 await page.locator('#help-close').click();await page.reload();
 assert.match(await page.locator('.next-step').innerText(), /Pedir justificante/);
 await page.locator('.task-help').click();
 assert.equal(await page.locator('#help-context').inputValue(),'');
 assert.equal(await page.locator('#help-step').inputValue(),'Pedir justificante por correo');
 const result=await page.evaluate(()=>{
   const data=window.miDia.read();window.miDia.apply(data);
   const step=window.miDia.read().tasks[0].nextStep;
   const legacy=structuredClone(data);delete legacy.tasks[0].nextStep;
   window.miDia.validate(legacy);
   let rejected=false;try{window.miDia.validate({...data,tasks:[{text:'bad',done:false,nextStep:42}]})}catch{rejected=true}
   return {step,rejected};
 });
 assert.equal(result.step,'Pedir justificante por correo');assert.equal(result.rejected,true);
 await page.locator('#help-save').click();
 assert.match(await page.locator('#help-status').innerText(),/La lista cambió/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile dialog, clipboard, next-step persistence, backup/sync validation, legacy data, stale edit protection, no page errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
