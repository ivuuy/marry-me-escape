"use strict";
(() => {
  const W=900,H=700,R=11, SPEED=125, SLOW=53, STORAGE='dont-touch-marriage-3d-v1';
  const $=id=>document.getElementById(id), canvas=$('game');
  let view3d=null;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'), dark=matchMedia('(prefers-color-scheme: dark)');
  const ink='#66545b', pink='#bf3056';
  const wall=(x,y,w,h)=>({type:'wall',name:'墙壁',x,y,w,h,corner:0});
  const walls=[wall(50,45,800,14),wall(50,59,14,580),wall(836,59,14,580),wall(64,625,606,14),wall(758,625,78,14),wall(374,59,14,185),wall(374,304,14,34),wall(64,324,150,14),wall(294,324,80,14),wall(574,59,14,113),wall(388,240,126,14),wall(574,315,83,14),wall(737,315,99,14)];
  const rect=(type,name,x,y,w,h,color,corner=7)=>({type,name,x,y,w,h,color,corner});
  const circle=(type,name,x,y,r,color)=>({type,name,x,y,r,color});
  const furniture=[
    rect('bed','床',108,96,137,165,'#eac0c8',10),rect('wardrobe','衣柜',279,82,55,104,'#d4b899'),rect('nightstand','床头柜',270,211,46,43,'#d4b899'),
    rect('tub','浴缸',406,80,69,108,'#d6e4df',18),rect('toilet','马桶',505,82,37,64,'#f8f6ec',12),rect('sink','洗手台',403,198,61,31,'#e0e8e0',6),
    rect('counter','厨房台面',618,82,180,48,'#e1d0ae'),rect('counterSide','厨房台面',750,130,48,113,'#e1d0ae'),rect('fridge','冰箱',609,181,61,88,'#cfdbd5'),circle('bin','垃圾桶',807,279,16,'#d5c8c6'),
    rect('sofa','沙发',98,384,81,160,'#d7b3c0',13),rect('table','茶几',222,427,88,64,'#dbbd96',12),rect('chair','单人椅',323,381,53,57,'#b6c8b0',11),rect('tv','电视柜',416,367,41,129,'#c7b1a3',5),rect('shelf','书架',98,576,158,32,'#c5ac93',4),circle('plant','绿植',336,582,25,'#8fba99'),
    rect('dining','餐桌',611,400,113,78,'#e0c49f',13),rect('diningChair','餐椅',641,363,53,25,'#c9b8a5'),rect('diningChair','餐椅',641,486,53,25,'#c9b8a5'),rect('diningChair','餐椅',579,421,25,37,'#c9b8a5'),rect('diningChair','餐椅',731,421,25,37,'#c9b8a5'),circle('plant','绿植',791,368,24,'#8fba99'),rect('shoe','鞋柜',778,544,45,57,'#cfb49c')
  ];
  const objects=[...walls,...furniture];
  // The collision boundary is the visible rounded outline, never its shadow.
  function clearance(x,y,o){
    if(o.r!==undefined)return Math.hypot(x-o.x,y-o.y)-o.r;
    const c=o.corner||0,qx=Math.abs(x-o.x-o.w/2)-(o.w/2-c),qy=Math.abs(y-o.y-o.h/2)-(o.h/2-c);
    return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-c;
  }
  function hitAt(x,y,padding=0){
    if(x-R<50||x+R>850||y-R<45||y+R>H)return walls[0];
    return objects.find(o=>clearance(x,y,o)<=R+padding)||null;
  }
  // Flood-fill from outside the door, so every possible spawn has a real route out.
  const reachable=[],grid=10,seen=new Set(),queue=[{x:710,y:660}];
  seen.add('710,660');
  for(let n=0;n<queue.length;n++){
    const p=queue[n];if(p.y<614)reachable.push(p);
    for(const [dx,dy] of [[grid,0],[-grid,0],[0,grid],[0,-grid]]){
      const x=p.x+dx,y=p.y+dy,key=x+','+y;
      if(x<75||x>825||y<75||y>670||seen.has(key)||hitAt(x,y,3)||hitAt(p.x+dx/2,p.y+dy/2,3))continue;
      seen.add(key);queue.push({x,y});
    }
  }
  const zones=[{x:85,y:83,name:'卧室窗边'},{x:87,y:294,name:'卧室角落'},{x:345,y:281,name:'卧室门边'},{x:550,y:210,name:'浴室角落'},{x:710,y:160,name:'厨房台面旁'},{x:699,y:285,name:'厨房门边'},{x:88,y:356,name:'客厅角落'},{x:285,y:603,name:'书架旁边'},{x:539,y:591,name:'客厅另一头'},{x:806,y:517,name:'餐厅角落'}];
  const spawnPools=zones.map(z=>({name:z.name,points:reachable.filter(p=>Math.hypot(p.x-z.x,p.y-z.y)<45&&!hitAt(p.x,p.y,8))})).filter(z=>z.points.length);
  let record={wins:0,best:null,attempts:0};
  try{const raw=JSON.parse(localStorage.getItem(STORAGE));if(raw&&typeof raw==='object'){for(const k of ['wins','attempts'])if(Number.isSafeInteger(raw[k])&&raw[k]>=0)record[k]=raw[k];if(Number.isFinite(raw.best)&&raw.best>0)record.best=raw.best;}}catch(error){}
  let state='ready',player={x:90,y:290},spawnName='',elapsed=0,lastTime=0,soundOn=false,audio=null,slow=false,drag=null,collision=null,finishDelay=0,lastZone=-1;
  const keys=new Set(),touches=new Map();
  const directionCodes=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD']);
  function announce(message){$('announcement').textContent=message;}
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(record));}catch(error){}}
  function updateRecord(){$('wins').textContent=record.wins;$('best').textContent=record.best===null?'暂无':record.best.toFixed(1);$('bestUnit').hidden=record.best===null;}
  function updateTimer(){const s=elapsed/1000;$('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+(s%60).toFixed(1).padStart(4,'0');}
  function clearInput(){keys.clear();touches.clear();drag=null;if(view3d)view3d.pointer=null;document.querySelectorAll('.dpad button').forEach(b=>b.classList.remove('held'));}
  function chooseSpawn(){
    if(!spawnPools.length){$('status').textContent='没有可用的出生点';$('start').disabled=true;return false;}
    let index=Math.floor(Math.random()*spawnPools.length);if(index===lastZone&&spawnPools.length>1)index=(index+1)%spawnPools.length;lastZone=index;
    const zone=spawnPools[index],p=zone.points[Math.floor(Math.random()*zone.points.length)];player={x:p.x,y:p.y};spawnName=zone.name;return true;
  }
  function tone(freq,duration=.12,delay=0){
    if(!soundOn)return;
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio=audio||new Audio();if(audio.state==='suspended')audio.resume().catch(()=>{});const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+delay;osc.type='sine';osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.09,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+duration+.02);}catch(error){}
  }
  function start(){
    if(!view3d||view3d.contextLost||view3d.fatal)return;
    clearTimeout(finishDelay);if($('result').open)$('result').close();clearInput();collision=null;elapsed=0;
    if((state!=='ready'||!spawnName)&&!chooseSpawn())return;state='playing';if(view3d.mode==='person')view3d.resetView(player);record.attempts++;persist();updateRecord();updateTimer();$('pauseCover').hidden=true;$('pause').disabled=false;$('pause').textContent='暂停';$('startLabel').textContent='重新出生';$('status').textContent='出生在'+spawnName;$('board').classList.remove('bump');lastTime=performance.now();tone(520,.11);tone(700,.1,.09);canvas.focus({preventScroll:true});announce('游戏开始，出生在'+spawnName+'。找到粉色出口走出去。');
  }
  function pause(){
    if(view3d&&view3d.fatal)return;
    if(state==='playing'){state='paused';clearInput();$('pauseCover').hidden=false;$('pause').textContent='继续';$('status').textContent='暂停中';$('resume').focus({preventScroll:true});announce('游戏已暂停');}
    else if(state==='paused'){state='playing';lastTime=performance.now();$('pauseCover').hidden=true;$('pause').textContent='暂停';$('status').textContent='继续保持距离';canvas.focus({preventScroll:true});announce('继续游戏');}
  }
  function finish(won,object=null){
    if(state!=='playing')return;state=won?'won':'lost';collision=object;clearInput();$('pause').disabled=true;$('status').textContent=won?'成功出门，自由了！':'糟糕，碰到了'+object.name; $('startLabel').textContent='再逃一次';
    if(won){record.wins++;record.best=record.best===null?elapsed/1000:Math.min(record.best,elapsed/1000);[620,780,930].forEach((f,i)=>tone(f,.18,i*.12));}
    else{$('board').classList.add('bump');tone(260,.22);tone(195,.24,.1);}
    persist();updateRecord();updateTimer();announce(won?'逃婚成功！':'碰到了'+object.name+'，逃婚失败！');
    finishDelay=setTimeout(()=>showResult(won),reduce.matches?80:400);
  }
  function showResult(won){
    $('resultArt').classList.toggle('won',won);$('resultKicker').textContent=won?'逃婚成功 / YOU ARE FREE':'逃婚失败 / JUST MARRIED';$('resultTitle').textContent=won?'门外见，\n自由万岁！':'碰到我，\n就跟我结婚！';$('resultCopy').textContent=won?'所有东西都擦肩而过，你和自由撞了个满怀。':'你碰到了'+collision.name+'。说好的保持距离呢？';$('resultTime').textContent=(elapsed/1000).toFixed(1);$('resultAttempts').textContent=record.attempts;$('retry').textContent=won?'再试一个出生点':'我不服，再逃一次';$('downloadMessage').textContent='';$('cardPreview').hidden=true;$('cardPreview').removeAttribute('src');$('result').showModal();
  }
  // Substeps prevent tunnelling through walls on fast drags or slow frames.
  function move(dx,dy){
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));
    for(let i=0;i<steps&&state==='playing';i++){
      const x=player.x+dx/steps,y=player.y+dy/steps,hit=hitAt(x,y);
      if(hit){finish(false,hit);return;}
      player.x=x;player.y=y;
      if(y-R>639&&x-R>670&&x+R<758){finish(true);return;}
    }
  }
  function heldDirection(direction){for(const value of touches.values())if(value===direction)return true;return false;}
  function step(dt,clockDelta=dt){
    if(state==='playing'){
      elapsed+=clockDelta*1000;
      let dx=0,dy=0;
      if(keys.has('ArrowLeft')||keys.has('KeyA')||heldDirection('left'))dx--;
      if(keys.has('ArrowRight')||keys.has('KeyD')||heldDirection('right'))dx++;
      if(keys.has('ArrowUp')||keys.has('KeyW')||heldDirection('up'))dy--;
      if(keys.has('ArrowDown')||keys.has('KeyS')||heldDirection('down'))dy++;
      const speed=slow||keys.has('ShiftLeft')||keys.has('ShiftRight')?SLOW:SPEED;
      if(keys.has('KeyQ'))view3d.turn(-1.7*dt);if(keys.has('KeyE'))view3d.turn(1.7*dt);
      if(dx||dy){const length=Math.hypot(dx,dy),direction=view3d.movement(dx/length,dy/length);move(direction.x*speed*dt,direction.y*speed*dt);}
      else if(drag){dx=drag.x-player.x;dy=drag.y-player.y;const len=Math.hypot(dx,dy);if(len>.3){const distance=Math.min(len,speed*dt);move(dx/len*distance,dy/len*distance);}}
      updateTimer();
    }

  }
  function rr(c,x,y,w,h,r,fill,stroke=ink,lw=1.7){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function line(c,x1,y1,x2,y2,color=ink,width=1.4){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  function dot(c,x,y,r,fill,stroke=null,lw=1.5){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function label(c,text,x,y,size=12,color='#8c7976',weight=500){c.fillStyle=color;c.font=weight+' '+size+'px "PingFang SC","Microsoft YaHei",sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,x,y);}
  function buildScene(){
    try{view3d=new HouseScene(canvas,walls,furniture);view3d.setTheme(dark.matches);return true;}
    catch(error){$('renderError').hidden=false;$('start').disabled=true;$('status').textContent='当前设备无法开启 3D';return false;}
  }
  function draw(now){if(view3d)view3d.render(player,state,collision,now);}
  function resize(){if(view3d){view3d.resize();draw(performance.now());}}
  let frameId=0,contextLosses=0;
  function stopLoop(){if(frameId)cancelAnimationFrame(frameId);frameId=0;}
  function resumeLoop(){if(!document.hidden&&view3d&&!view3d.fatal&&!view3d.contextLost&&!frameId){lastTime=performance.now();frameId=requestAnimationFrame(frame);}}
  function rendererFallback(message){
    stopLoop();clearInput();if(state==='playing')state='paused';$('pause').disabled=true;$('start').disabled=true;
    $('renderError').hidden=false;$('renderError').textContent=message;$('status').textContent='3D 画面已暂停';
    if(view3d)view3d.fatal=true;
  }
  function frame(now){
    frameId=0;if(document.hidden||!view3d||view3d.fatal||view3d.contextLost)return;
    const clockDelta=Math.max((now-lastTime)/1000,0);
    if(clockDelta>=.032){lastTime=now;step(Math.min(clockDelta,.08),clockDelta);view3d.observeFrame(clockDelta);if(view3d.fatal){rendererFallback('当前设备暂时无法流畅运行 3D。游戏已暂停，请在支持图形加速的设备上重试。');return;}draw(now);}
    frameId=requestAnimationFrame(frame);
  }
  function setView(mode){
    if(!view3d||view3d.contextLost||view3d.fatal)return;clearInput();view3d.setView(mode,player);
    $('houseView').setAttribute('aria-pressed',mode==='house');$('personView').setAttribute('aria-pressed',mode==='person');$('crosshair').hidden=mode!=='person';
    $('viewHint').textContent=mode==='house'?'拖动空白处旋转，滚轮缩放':'拖动画面看四周，朝粉色门前进';
    canvas.focus({preventScroll:true});draw(performance.now());
  }
  $('houseView').addEventListener('click',()=>setView('house'));
  $('personView').addEventListener('click',()=>setView('person'));
  $('resetView').addEventListener('click',()=>{if(view3d){clearInput();view3d.resetView(player);draw(performance.now());}});
  $('start').addEventListener('click',start);$('retry').addEventListener('click',start);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',pause);
  $('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',soundOn);$('sound').textContent='音效：'+(soundOn?'开':'关');if(soundOn)tone(660);});
  $('slow').addEventListener('click',()=>{slow=!slow;$('slow').setAttribute('aria-pressed',slow);});
  document.addEventListener('keydown',e=>{
    if(!view3d||view3d.contextLost||$('result').open||e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.code==='KeyV'&&!e.repeat){e.preventDefault();setView(view3d.mode==='house'?'person':'house');return;}
    if(e.code==='KeyR'&&!e.repeat){e.preventDefault();start();return;}
    if(e.code==='Escape'&&!e.repeat){pause();return;}
    if(e.code==='Enter'&&state==='ready'&&e.target.tagName!=='BUTTON'){e.preventDefault();start();return;}
    if(state!=='playing')return;
    if(directionCodes.has(e.code)||e.code==='KeyQ'||e.code==='KeyE'||e.code==='ShiftLeft'||e.code==='ShiftRight'){e.preventDefault();keys.add(e.code);}
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{clearInput();if(state==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state==='playing')pause();stopLoop();clearTimeout(finishDelay);if(audio&&audio.suspend)audio.suspend().catch(()=>{});}else{if((state==='won'||state==='lost')&&!$('result').open)showResult(state==='won');resumeLoop();}});
  for(const b of document.querySelectorAll('[data-dir]')){
    b.addEventListener('pointerdown',e=>{if(state!=='playing')return;e.preventDefault();b.setPointerCapture(e.pointerId);touches.set(e.pointerId,b.dataset.dir);b.classList.add('held');});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,e=>{touches.delete(e.pointerId);b.classList.remove('held');});
    b.addEventListener('contextmenu',e=>e.preventDefault());
  }
  canvas.addEventListener('pointerdown',e=>{
    if(!view3d||view3d.contextLost||state==='paused'||$('result').open)return;
    canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    if(e.button===0&&state==='playing'&&view3d.canGrab(e,player)){
      const p=view3d.point(e);if(p)drag={x:player.x,y:player.y,offsetX:player.x-p.x,offsetY:player.y-p.y,id:e.pointerId};
    }else view3d.beginOrbit(e);
  });
  canvas.addEventListener('pointermove',e=>{
    if(drag&&drag.id===e.pointerId){const p=view3d.point(e);if(p){drag.x=p.x+drag.offsetX;drag.y=p.y+drag.offsetY;}}
    else if(view3d)view3d.orbit(e);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag&&drag.id===e.pointerId)drag=null;if(view3d)view3d.endOrbit(e.pointerId);});
  canvas.addEventListener('wheel',e=>{if(view3d&&state!=='paused'){e.preventDefault();view3d.wheel(e.deltaY);}},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLosses++;if(state==='playing')pause();stopLoop();if(view3d)view3d.contextLost=true;if(contextLosses>=2){rendererFallback('3D 画面多次中断，已停止渲染。请在开启图形加速的设备上重新打开。');return;}$('renderError').hidden=false;$('renderError').textContent='3D 画面暂时中断，正在等待浏览器恢复。';});
  canvas.addEventListener('webglcontextrestored',()=>{if(view3d&&!view3d.fatal){view3d.contextLost=false;view3d.setQuality('low');resize();$('renderError').hidden=true;$('status').textContent=state==='paused'?'画面已恢复，点击继续':'准备好，就出发';resumeLoop();}});
  $('result').addEventListener('close',()=>{$('start').focus({preventScroll:true});});
  $('save').addEventListener('click',async()=>{
    $('save').disabled=true;
    try{
      const card=document.createElement('canvas');card.width=1080;card.height=1350;const c=card.getContext('2d'),won=state==='won';
      c.fillStyle='#faf3f4';c.fillRect(0,0,1080,1350);rr(c,48,48,984,1254,28,'#fffdfb','#dfcbd1',2);
      label(c,'碰到我，就跟我结婚。',540,122,29,pink,750);label(c,won?'逃婚成功！':'被'+collision.name+'截胡了。',540,244,66,'#392d35',850);label(c,won?'一身轻松，出门就是自由。':'就差一点点，单身保卫战失败。',540,326,27,'#826e76');
      draw(performance.now());c.drawImage(canvas,80,367,920,920*H/W);line(c,114,1087,966,1087,'#e4d5da',2);label(c,(elapsed/1000).toFixed(1)+' 秒',330,1153,46,pink,750);label(c,'第 '+record.attempts+' 次挑战',770,1153,40,'#392d35',700);label(c,'本次用时',330,1206,22,'#826e76');label(c,'你能不碰任何东西，走出门吗？',770,1206,21,'#826e76');
      const data=card.toDataURL('image/png'),bridge=window.xhs&&window.xhs.miniTool;
      if(bridge&&typeof bridge.writeTempFile==='function'&&typeof bridge.saveImageToPhotosAlbum==='function'){
        $('downloadMessage').textContent='正在保存到相册…';
        const result=await window.xhs.miniTool.writeTempFile({data:data});
        if(!result||typeof result.filePath!=='string'||!result.filePath)throw new Error('临时图片未生成');
        await window.xhs.miniTool.saveImageToPhotosAlbum({filePath:result.filePath});
        $('downloadMessage').textContent='战绩卡已保存到相册。';
      }else{
        $('cardPreview').src=data;$('cardPreview').hidden=false;$('downloadMessage').textContent='战绩卡已生成，可截屏留念；在小红书内支持保存到相册。';
      }
    }catch(error){$('downloadMessage').textContent='图片未保存，请检查相册权限后重试，也可以截屏留念。';}
    finally{$('save').disabled=false;}

  });
  MiniCompat.onMedia(dark,()=>{if(view3d){view3d.setTheme(dark.matches);draw(performance.now());}});
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
  updateRecord();chooseSpawn();if(!buildScene())return;resize();lastTime=performance.now();resumeLoop();
})();
