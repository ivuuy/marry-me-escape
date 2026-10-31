/* Run with Playwright installed, or set PLAYWRIGHT_MODULE to its local path.
   CHROME_PATH optionally points at a system Chromium / Chrome executable. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'marriage-3d-qa-'));
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const hook = `window.gameTest={get:()=>({state,player:{...player},elapsed,record:{...record},spawnPools,walls,furniture}),hitAt,start,step,move,pause,setView,keys,view:()=>view3d,reset:(x,y)=>{clearTimeout(finishDelay);if($('result').open)$('result').close();state='playing';$('pauseCover').hidden=true;elapsed=1200;collision=null;clearInput();player={x,y}},stop:()=>{state='paused'}};`;
  const anchor = 'updateRecord();chooseSpawn();if(!buildScene())return;';
  assert(source.includes(anchor));
  const instrumented = path.join(temp, 'instrumented.html');
  fs.writeFileSync(instrumented, source.replace(anchor, hook + anchor));
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}), args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors = [], external = [];
  try {
    const page = await browser.newPage({viewport:{width:1440,height:950},colorScheme:'light'});
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => {if(/^https?:/.test(r.url()))external.push(r.url());});
    await page.context().setOffline(true);
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForTimeout(650);
    assert.equal(await page.locator('#renderError').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({path:path.join(temp, 'desktop.png'),fullPage:true});
    await page.click('#start');
    await page.waitForTimeout(100);
    assert.notEqual(await page.locator('#timer').textContent(), '00:00.0');
    await page.click('#pause');
    const paused = await page.locator('#timer').textContent();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#timer').textContent(), paused);
    await page.click('#resume');

    await page.goto(pathToFileURL(instrumented).href);
    await page.waitForFunction(() => window.gameTest?.view());
    const engine = await page.evaluate(() => {
      const g=window.gameTest,checks=[],ok=(c,m)=>{if(!c)throw new Error(m);checks.push(m);};
      const view=g.view(),snapshot=g.get();
      ok(view.renderer.isWebGLRenderer,'True WebGL renderer');
      ok(view.scene.children.length>30,'Furniture consists of actual 3D objects');
      ok(snapshot.spawnPools.length===10,'All ten spawn areas available');
      for(const pool of snapshot.spawnPools)for(const p of pool.points)ok(!g.hitAt(p.x,p.y,8),'Safe spawn '+pool.name);
      g.reset(205,452);g.move(35,0);ok(g.get().state==='lost','Furniture collision loses');
      g.reset(90,290);g.move(-70,0);ok(g.get().state==='lost','Wall collision loses');
      g.reset(360,270);g.move(70,0);ok(g.get().state==='playing','Interior doorway passable');
      g.reset(714,612);g.move(0,36);ok(g.get().state==='playing','Partial exit does not win');g.move(0,4);ok(g.get().state==='won','Full exit wins');
      g.reset(680,603);g.move(0,55);ok(g.get().state==='lost','Exit frame collision loses');
      g.reset(200,460);g.move(200,0);ok(g.get().state==='lost','Cannot tunnel through objects');
      for(const pool of snapshot.spawnPools){
        const origin=pool.points[Math.floor(pool.points.length/2)],queue=[origin],parents=new Map([[origin.x+','+origin.y,null]]);let goal;
        for(let n=0;n<queue.length;n++){
          const p=queue[n];if(p.y>=660&&p.x>683&&p.x<745){goal=p;break;}
          for(const [dx,dy] of [[10,0],[-10,0],[0,10],[0,-10]]){
            const x=p.x+dx,y=p.y+dy,k=x+','+y;
            if(x<75||x>825||y<75||y>670||parents.has(k)||g.hitAt(x,y,2)||g.hitAt(p.x+dx/2,p.y+dy/2,2))continue;
            parents.set(k,p);queue.push({x,y});
          }
        }
        ok(!!goal,'Route exists from '+pool.name);
        const route=[];for(let p=goal;p;p=parents.get(p.x+','+p.y))route.unshift(p);
        for(const mode of ['house','person']){
          g.reset(origin.x,origin.y);g.setView(mode);
          for(const p of route.slice(1)){const current=g.get();if(current.state!=='playing')break;g.move(p.x-current.player.x,p.y-current.player.y);}
          ok(g.get().state==='won',mode+' route wins from '+pool.name);
        }
      }
      // Camera orientation must change input axes without changing speed.
      g.reset(500,550);g.setView('house');view.azimuth=Math.PI/2;g.keys.add('ArrowRight');g.step(.04);g.keys.clear();
      ok(Math.abs(g.get().player.x-500)<.01 && Math.abs(g.get().player.y-545)<.01,'Orbit-relative movement');
      g.reset(500,550);g.setView('person');view.lookYaw=Math.PI/2;g.keys.add('ArrowUp');g.step(.04);g.keys.clear();
      ok(Math.abs(g.get().player.x-505)<.01 && Math.abs(g.get().player.y-550)<.01,'First-person forward follows gaze');
      g.reset(500,550);g.keys.add('ArrowUp');g.keys.add('ArrowRight');g.step(.04);g.keys.clear();
      ok(Math.abs(Math.hypot(g.get().player.x-500,g.get().player.y-550)-5)<.01,'Diagonal speed normalized');
      g.reset(500,550);g.pause();const time=g.get().elapsed;g.step(1);ok(g.get().elapsed===time,'Paused engine does not tick');
      g.reset(500,550);g.setView('house');view.resetView(g.get().player);g.stop();
      return {checks:checks.length,spawnAreas:snapshot.spawnPools.length,meshes:view.renderer.info.render.calls};
    });
    // Real pointer input rotates the scene; a button can restore it.
    const before = await page.evaluate(() => gameTest.view().azimuth);
    await page.evaluate(() => {gameTest.reset(500,550);});
    const rect = await page.locator('#game').boundingBox();
    await page.mouse.move(rect.x+rect.width*.15,rect.y+rect.height*.8);
    await page.mouse.down();await page.mouse.move(rect.x+rect.width*.32,rect.y+rect.height*.8,{steps:5});await page.mouse.up();
    assert.notEqual(await page.evaluate(() => gameTest.view().azimuth),before);
    await page.click('#resetView');assert.equal(await page.evaluate(() => gameTest.view().azimuth),.48);
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.wheel(0,-140);
    assert((await page.evaluate(() => gameTest.view().zoom))>1);
    await page.click('#personView');assert.equal(await page.locator('#personView').getAttribute('aria-pressed'),'true');
    assert(await page.evaluate(() => gameTest.view().camera.isPerspectiveCamera));
    await page.screenshot({path:path.join(temp,'first-person.png')});
    await page.keyboard.press('KeyV');assert.equal(await page.locator('#houseView').getAttribute('aria-pressed'),'true');
    await page.evaluate(() => {gameTest.reset(205,452);gameTest.move(35,0);});
    await page.waitForFunction(() => document.getElementById('result').open);
    const downloadEvent=page.waitForEvent('download');await page.click('#save');const download=await downloadEvent;
    const card=path.join(temp,'result-card.png');await download.saveAs(card);assert(fs.statSync(card).size>15000);
    await page.click('#retry');assert.equal(await page.locator('#result').evaluate(e=>e.open),false);
    await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});await page.screenshot({path:path.join(temp,'dark.png')});
    await page.reload();assert.equal(await page.locator('#wins').textContent(),'21');
    await page.evaluate(()=>localStorage.setItem('dont-touch-marriage-3d-v1','corrupt'));await page.reload();assert.equal(await page.locator('#wins').textContent(),'0');

    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'light'});
    mobile.on('pageerror',e=>errors.push(e.message));await mobile.context().setOffline(true);
    await mobile.goto(pathToFileURL(path.join(root,'index.html')).href);await mobile.waitForTimeout(650);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert(await mobile.locator('.touch-controls').isVisible());await mobile.screenshot({path:path.join(temp,'mobile.png'),fullPage:true});
    await mobile.click('#start');const cdp=await mobile.context().newCDPSession(mobile),button=await mobile.locator('[data-dir="up"]').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:button.x+button.width/2,y:button.y+button.height/2}]});
    await mobile.waitForTimeout(60);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await mobile.locator('.held').count(),0);
    await mobile.click('#slow');assert.equal(await mobile.locator('#slow').getAttribute('aria-pressed'),'true');
    const unsupported=await browser.newPage();
    await unsupported.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type.includes('webgl')?null:original.call(this,type,...rest);};});
    await unsupported.goto(pathToFileURL(path.join(root,'index.html')).href);assert(await unsupported.locator('#renderError').isVisible());assert(await unsupported.locator('#start').isDisabled());
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log(JSON.stringify({passed:true,...engine,scriptErrors:errors,externalRequests:external,screenshots:temp,also:['keyboard and camera controls','first-person mode','mobile touch cancel','offline file loading','PNG export','storage reload and corruption','WebGL unavailable fallback']},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
