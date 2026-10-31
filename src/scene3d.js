/* Three.js is embedded locally in the built HTML. All models and textures below
   are procedural game geometry; no external assets, requests, or loaders. */
"use strict";
class HouseScene {
  constructor(canvas, walls, furniture) {
    this.canvas=canvas;this.walls=walls;this.furniture=furniture;
    this.mode='house';this.azimuth=.48;this.elevation=1.02;this.zoom=1;
    this.lookYaw=0;this.lookPitch=-.12;this.pointer=null;this.lastPlayer=null;
    this.materials=new Map();this.geometries=new Map();this.wallGroups=[];this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
    this.objectGroups=new Map();this.lastCollision=null;this.contextLost=false;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.5:2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#faf4f4');
    this.houseCamera=new THREE.OrthographicCamera(-16,16,12,-12,.1,160);
    this.personCamera=new THREE.PerspectiveCamera(72,1,.035,100);
    this.camera=this.houseCamera;
    this.scene.add(new THREE.HemisphereLight('#fff9ee','#b7a5a2',1.65));
    const sun=new THREE.DirectionalLight('#fff1da',2.3);sun.position.set(-10,24,12);
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:65});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;this.scene.add(sun);
    const fill=new THREE.DirectionalLight('#e2edff',.7);fill.position.set(10,12,-10);this.scene.add(fill);
    this.raycaster=new THREE.Raycaster();this.groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.pointerVector=new THREE.Vector2();this.intersection=new THREE.Vector3();
    this.buildRoom();for(const object of furniture)this.buildFurniture(object);
    this.buildPlayer();this.resize();
  }
  material(color){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.74,metalness:0}));return this.materials.get(color);}
  roundedGeometry(w,h,d,r){
    const key=[w,h,d,r].join(',');if(this.geometries.has(key))return this.geometries.get(key);
    const b=Math.min(.055,h*.2,r*.45),a=w/2-b,k=d/2-b,cr=Math.max(.001,Math.min(r-b,a,k));
    const s=new THREE.Shape();s.moveTo(-a+cr,-k);s.lineTo(a-cr,-k);s.quadraticCurveTo(a,-k,a,-k+cr);s.lineTo(a,k-cr);s.quadraticCurveTo(a,k,a-cr,k);s.lineTo(-a+cr,k);s.quadraticCurveTo(-a,k,-a,k-cr);s.lineTo(-a,-k+cr);s.quadraticCurveTo(-a,-k,-a+cr,-k);
    const g=new THREE.ExtrudeGeometry(s,{depth:h-2*b,bevelEnabled:b>0,bevelSegments:2,steps:1,bevelSize:b,bevelThickness:b,curveSegments:5});g.rotateX(-Math.PI/2);g.translate(0,-h/2+b,0);this.geometries.set(key,g);return g;
  }
  box(parent,x,y,z,w,h,d,color,r=.04){
    const g=r>0?this.roundedGeometry(w,h,d,r):new THREE.BoxGeometry(w,h,d),m=new THREE.Mesh(g,this.material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  sphere(parent,x,y,z,rx,ry,rz,color){
    if(!this.ballGeometry)this.ballGeometry=new THREE.SphereGeometry(1,16,12);
    const m=new THREE.Mesh(this.ballGeometry,this.material(color));m.position.set(x,y,z);m.scale.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  cylinder(parent,x,y,z,rt,rb,h,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,24),this.material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  textTexture(text,color='#b63b5c',background=null){
    const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
    if(background){x.fillStyle=background;x.beginPath();x.roundRect(0,0,512,128,24);x.fill();}
    x.font='bold 56px "PingFang SC","Microsoft YaHei",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(text,256,67);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  }
  floorTexture(){
    const c=document.createElement('canvas');c.width=1600;c.height=1188;const x=c.getContext('2d');x.scale(2,2);x.translate(-50,-45);
    x.fillStyle='#e8d0ad';x.fillRect(50,45,800,594);
    for(let y=45,n=0;y<639;y+=29,n++){
      x.fillStyle=n%2?'#ead6b8':'#efdcbd';x.fillRect(50,y,800,28);
      x.strokeStyle='#d8bf9f';x.lineWidth=.6;x.beginPath();x.moveTo(50,y);x.lineTo(850,y);x.stroke();
      for(let a=50+(n%2)*75;a<850;a+=150){x.beginPath();x.moveTo(a,y);x.lineTo(a,y+29);x.stroke();}
    }
    for(const room of [{x:388,y:59,w:186,h:181,color:'#dce8dc',line:'#c1d2c3',size:31},{x:588,y:59,w:248,h:256,color:'#efe4cc',line:'#ddd0b6',size:36}]){
      x.fillStyle=room.color;x.fillRect(room.x,room.y,room.w,room.h);x.strokeStyle=room.line;x.lineWidth=1;
      for(let a=room.x;a<=room.x+room.w;a+=room.size){x.beginPath();x.moveTo(a,room.y);x.lineTo(a,room.y+room.h);x.stroke();}
      for(let b=room.y;b<=room.y+room.h;b+=room.size){x.beginPath();x.moveTo(room.x,b);x.lineTo(room.x+room.w,b);x.stroke();}
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(this.renderer.capabilities.getMaxAnisotropy(),4);return t;
  }
  buildRoom(){
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),this.material('#f1e5e7'));this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-.62;this.ground.receiveShadow=true;this.scene.add(this.ground);
    this.box(this.scene,0,-.29,.05,20.6,.56,15.45,'#d6bdaa',.14);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,14.85),new THREE.MeshStandardMaterial({map:this.floorTexture(),roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.set(0,.006,.05);floor.receiveShadow=true;this.scene.add(floor);
    for(let i=0;i<this.walls.length;i++){
      const o=this.walls[i],group=new THREE.Group();group.position.set((o.x+o.w/2-450)/40,0,(o.y+o.h/2-340)/40);this.scene.add(group);
      this.box(group,0,1.5,0,o.w/40,3,o.h/40,i===0?'#f3e4d6':'#eee0d2',.025);
      this.box(group,0,.07,0,o.w/40+.014,.14,o.h/40+.014,'#cdb8a3',.012);
      this.wallGroups.push({group,index:i});this.objectGroups.set(o,group);
      if(i===0)for(const [x,w] of [[131,125],[659,107]]){
        const local=(x+w/2-450)/40-group.position.x,z=o.h/80+.012;
        this.box(group,local,1.91,z,w/40,1.24,.09,'#fff5e4',.025);
        this.box(group,local,1.91,z+.055,w/40-.15,1.08,.045,'#bcdad7',.015);
        this.box(group,local,1.91,z+.083,.055,1.1,.035,'#fff8eb',.009);
        this.box(group,local,1.89,z+.083,w/40-.11,.052,.035,'#fff8eb',.009);
        this.box(group,local,1.26,z+.08,w/40+.14,.10,.30,'#f8ebd8',.02);
      }
    }
    // Open door rests outside the exit lane; its threshold is the win boundary.
    this.doorGroup=new THREE.Group();this.doorGroup.position.set((758-450)/40,0,(632-340)/40);this.scene.add(this.doorGroup);
    this.box(this.doorGroup,.07,1.35,1.02,.14,2.7,2.04,'#cb6b88',.025);
    this.box(this.doorGroup,-.007,1.58,1.06,.04,1.7,1.6,'#e699b0',.01);
    this.sphere(this.doorGroup,-.07,1.16,1.82,.075,.075,.075,'#e6c288');
    this.box(this.scene,6.6,-.22,8,2.17,.38,1.5,'#cfb0ac',.07);
    const exit=new THREE.Mesh(new THREE.PlaneGeometry(2.05,.55),new THREE.MeshBasicMaterial({map:this.textTexture('出 门 ↓'),transparent:true,depthWrite:false}));exit.rotation.x=-Math.PI/2;exit.position.set(6.6,.024,8.02);this.scene.add(exit);
    this.box(this.scene,6.6,.009,7.42,2.1,.016,.12,'#ce537c',.005);
    // A small sign sits on the far wall, like a real household decoration.
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.63),new THREE.MeshBasicMaterial({map:this.textTexture('HOME, SWEET HOME','#977461','#fff3df')}));sign.position.set(-.35,2.1,-7.16);this.scene.add(sign);this.wallSign=sign;
  }
  buildFurniture(o){
    const g=new THREE.Group(),w=(o.w||o.r*2)/40,d=(o.h||o.r*2)/40;
    g.position.set((o.x+(o.w?o.w/2:0)-450)/40,0,(o.y+(o.h?o.h/2:0)-340)/40);this.scene.add(g);this.objectGroups.set(o,g);
    const b=(x,y,z,bw,bh,bd,c,r=.04)=>this.box(g,x,y,z,bw,bh,bd,c,r),s=(x,y,z,a,h,k,c)=>this.sphere(g,x,y,z,a,h,k,c),cy=(x,y,z,rt,rb,h,c)=>this.cylinder(g,x,y,z,rt,rb,h,c);
    const legs=(height=.7)=>{for(const x of [-w*.34,w*.34])for(const z of [-d*.32,d*.32])b(x,height/2,z,.12,height,.12,'#a78261',.025);};
    switch(o.type){
      case 'bed':
        b(0,.23,0,w,.46,d,'#b99077',o.corner/40);b(0,.53,.05,w-.12,.28,d-.12,'#fff7e7',.19);b(0,.8,-d/2+.14,w,.95,.28,'#db9dab',.09);
        b(0,.76,.60,w-.19,.24,d-1.45,'#d987a2',.13);b(0,.86,-.55,w-.17,.11,.50,'#e8acbf',.06);
        for(const x of [-w*.245,w*.245])b(x,.79,-d/2+.66,w*.40,.25,.69,'#fff1df',.15);break;
      case 'wardrobe':
        b(0,1.20,0,w,2.4,d,'#c2a17f',.10);
        for(const x of [-w*.245,w*.245])b(x,1.23,d/2+.01,w*.475,2.18,.025,'#d9bb96',.025);
        for(const x of [-.10,.10])b(x,1.16,d/2+.048,.035,.3,.04,'#9c7455',.01);break;
      case 'nightstand':
        b(0,.38,0,w,.76,d,'#c69b79',.10);b(0,.8,0,w,.09,d,'#e1bf95',.06);b(0,.47,d/2,.7,.35,.03,'#dcba93');s(0,.48,d/2+.03,.045,.045,.025,'#956a53');
        cy(0,.87,0,.20,.22,.06,'#bdaa85');cy(0,1.08,0,.035,.035,.40,'#b49e7c');cy(0,1.33,0,.16,.29,.32,'#ffedbe');break;
      case 'tub':
        b(0,.40,0,w,.8,d,'#f8f5e9',.40);b(0,.82,0,w-.18,.06,d-.22,'#bccfc6',.33);b(0,.865,0,w-.38,.05,d-.45,'#b9dcd1',.32);
        cy(0,1.00,-d/2+.21,.035,.035,.35,'#b1b8ac');b(0,1.17,-d/2+.36,.07,.07,.32,'#b1b8ac',.02);break;
      case 'toilet':
        b(0,.68,-d*.32,w,.90,d*.30,'#f4f1e7',.12);s(0,.45,d*.08,w*.47,.29,d*.40,'#faf6ed');s(0,.7,d*.08,w*.34,.035,d*.29,'#bbcfc7');s(0,.16,d*.08,w*.28,.17,d*.25,'#ecece3');break;
      case 'sink':
        b(0,.48,0,w,.96,d,'#bed1bd',.08);b(0,1.0,0,w,.10,d,'#fff9eb',.07);s(0,1.057,0,w*.31,.013,d*.32,'#c0d5c8');cy(0,1.17,-d*.32,.026,.026,.3,'#abb7a9');break;
      case 'counter':case 'counterSide':
        b(0,.5,0,w,1,d,'#b4c4ad',.08);b(0,1.06,0,w,.15,d,'#f7edd9',.04);
        if(o.type==='counter'){
          for(let i=0;i<4;i++){const x=-w/2+.58+i*(w-1.16)/3;b(x,.53,d/2+.006,.92,.78,.022,'#ccd6bd',.02);b(x,.84,d/2+.031,.24,.025,.03,'#a3916f',.01);}
          b(-w*.29,1.15,0,1.16,.04,.77,'#9faaa0',.10);b(-w*.29,1.178,0,.93,.02,.57,'#c9d8cd',.12);cy(-w*.29,1.34,-.43,.028,.028,.48,'#9da496');
          b(w*.28,1.154,0,1.49,.035,.82,'#555457',.07);for(const a of [-.32,.32])cy(w*.28+a,1.178,0,.23,.23,.02,'#99988c');
        }else{b(0,1.17,.54,.68,.08,.97,'#d7ae7e',.09);s(0,1.27,.54,.14,.09,.2,'#a9b877');}
        break;
      case 'fridge':
        b(0,1.11,0,w,2.22,d,'#b4c6c0',.10);b(0,1.16,d/2-.015,w-.08,.035,.045,'#7f9890',.005);b(-w*.32,1.60,d/2+.024,.045,.43,.052,'#708f87',.01);b(-w*.32,.76,d/2+.024,.045,.40,.052,'#708f87',.01);b(w*.2,1.82,d/2+.013,.34,.30,.012,'#f2d9a1',.003);break;
      case 'bin':cy(0,.33,0,w*.44,w*.36,.66,'#baaaa9');cy(0,.68,0,w*.49,w*.48,.065,'#dbcfcb');b(0,.73,0,.25,.07,.08,'#988b8b');break;
      case 'sofa':
        b(0,.29,0,w,.58,d,'#c3839d',o.corner/40);b(-w*.34,.75,0,w*.32,1.05,d,'#d294ac',.18);
        for(const z of [-d*.455,d*.455])b(0,.67,z,w,.62,d*.09,'#dba1b6',.12);
        for(const z of [-d*.23,d*.23]){b(w*.12,.63,z,w*.62,.32,d*.42,'#e8b1c3',.16);b(-w*.14,.98,z,w*.23,.56,d*.4,'#e2a5bb',.14);}
        b(w*.19,.91,-d*.27,.58,.25,.65,'#f5d5ce',.14).rotation.z=-.16;break;
      case 'table':
        legs(.58);b(0,.66,0,w,.20,d,'#ddb88b',o.corner/40);b(-.36,.80,.01,.60,.075,.79,'#fbefdc',.03);b(-.36,.845,.01,.52,.01,.7,'#cb8ba6',.02);cy(.53,.8,.05,.24,.24,.05,'#efdbc5');cy(.53,.94,.05,.14,.12,.24,'#fff1d9');cy(.53,1.065,.05,.11,.11,.01,'#9b7054');break;
      case 'chair':
        legs(.36);b(0,.50,0,w,.35,d,'#b5c69e',.21);b(0,.88,-d*.32,w,.69,d*.33,'#a4b792',.16);for(const x of [-w*.39,w*.39])b(x,.68,0,w*.18,.4,d*.8,'#b4c49c',.10);break;
      case 'tv':
        b(0,.36,0,w,.72,d,'#b89378',.10);b(0,.95,0,.10,.38,1.28,'#55515a',.02);b(0,1.57,0,.17,1.18,d*.77,'#48454f',.035);
        for(const x of [-.092,.092])b(x,1.57,0,.014,.98,d*.70,'#8aa7a4',.008);break;
      case 'shelf':
        b(0,.52,0,w,1.04,d,'#b38f72',.08);b(0,.58,-d*.09,w-.18,.77,d*.74,'#816952',.02);
        for(let i=0;i<15;i++){const h=.4+(i%3)*.11;b(-w/2+.25+i*(w-.5)/14,.19+h/2,d*.14,.15,h,d*.58,['#d59bac','#a7b49a','#e6c786','#c1ab9c'][i%4],.015);}
        b(0,.12,d*.1,w,.18,d*.8,'#bc997c',.02);break;
      case 'plant':
        cy(0,.31,0,w*.29,w*.22,.62,'#d5b093');cy(0,.62,0,w*.27,w*.27,.025,'#7c6954');cy(0,.85,0,.035,.045,.57,'#758964');
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7,leaf=s(Math.sin(a)*w*.27,.95+(i%3)*.16,Math.cos(a)*d*.27,w*.18,.36,d*.13,i%2?'#80a981':'#a1bd8f');leaf.rotation.z=Math.sin(a)*.6;leaf.rotation.x=Math.cos(a)*.6;}break;
      case 'dining':
        legs(.95);b(0,1.04,0,w,.19,d,'#e1bd8f',o.corner/40);
        for(const x of [-w*.29,w*.29]){cy(x,1.16,0,.34,.34,.04,'#fff2d9');cy(x,1.185,0,.26,.26,.015,'#e9d9b9');}
        cy(0,1.28,0,.14,.1,.32,'#d89bac');s(0,1.55,0,.17,.15,.17,'#a6be8e');break;
      case 'diningChair':
        legs(.53);b(0,.62,0,w,.16,d,'#c6af91',.07);
        if(w>d)b(0,.95,(o.y<420?-1:1)*(d/2-.08),w,.67,.13,'#d9c4a6',.045);
        else b((o.x<650?-1:1)*(w/2-.08),.95,0,.13,.67,d,'#d9c4a6',.045);break;
      case 'shoe':
        b(0,.64,0,w,1.28,d,'#c19a7b',.10);for(const y of [.36,.93]){b(0,y,d/2-.008,w-.12,.49,.03,'#d9b994',.025);b(0,y+.13,d/2+.023,.3,.035,.04,'#99704f',.01);}break;
    }
  }
  buildPlayer(){
    this.avatar=new THREE.Group();this.scene.add(this.avatar);
    this.body=new THREE.Group();this.avatar.add(this.body);
    this.sphere(this.body,0,.43,0,.25,.34,.23,'#c93668');
    for(const x of [-.115,.115])this.sphere(this.body,x,.10,.035,.095,.095,.13,'#973253');
    for(const x of [-.085,.085]){this.sphere(this.body,x,.52,.208,.043,.058,.024,'#fff8ec');this.sphere(this.body,x,.515,.23,.016,.024,.009,'#563644');}
    this.sphere(this.body,0,.397,.218,.042,.018,.012,'#f8dce7');
    const halo=new THREE.Mesh(new THREE.RingGeometry(.31,.37,40),new THREE.MeshBasicMaterial({color:'#c83d6b',transparent:true,opacity:.6,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.028;this.avatar.add(halo);this.halo=halo;
    this.playerTag=new THREE.Sprite(new THREE.SpriteMaterial({map:this.textTexture('你在这里','#c33663','#fff7f8'),depthTest:false,depthWrite:false}));this.playerTag.scale.set(1.75,.4375,1);this.playerTag.position.y=1.16;this.playerTag.renderOrder=10;this.avatar.add(this.playerTag);
    this.collisionRing=new THREE.Mesh(new THREE.RingGeometry(.3,.45,40),new THREE.MeshBasicMaterial({color:'#e53769',side:THREE.DoubleSide,transparent:true,opacity:.7}));this.collisionRing.rotation.x=-Math.PI/2;this.collisionRing.position.y=.035;this.collisionRing.visible=false;this.scene.add(this.collisionRing);
  }
  setTheme(isDark){this.scene.background.set(isDark?'#28232d':'#faf4f4');this.ground.material=this.material(isDark?'#332d39':'#f1e5e7');}
  setView(mode,player){
    this.mode=mode;this.pointer=null;this.camera=mode==='house'?this.houseCamera:this.personCamera;
    if(mode==='person'){this.lookYaw=Math.atan2(714-player.x,-(652-player.y));this.lookPitch=-.12;}
    this.avatar.visible=mode==='house';this.resize();this.updateCamera(player);
  }
  resetView(player){this.azimuth=.48;this.elevation=1.02;this.zoom=1;this.lookYaw=Math.atan2(714-player.x,-(652-player.y));this.lookPitch=-.12;this.resize();this.updateCamera(player);}
  updateCamera(player){
    if(this.mode==='house'){
      const distance=35;this.houseCamera.position.set(Math.sin(this.azimuth)*Math.cos(this.elevation)*distance,Math.sin(this.elevation)*distance,Math.cos(this.azimuth)*Math.cos(this.elevation)*distance);this.houseCamera.lookAt(0,.35,.35);
    }else{const x=(player.x-450)/40,z=(player.y-340)/40;this.personCamera.position.set(x,1.34,z);this.personCamera.lookAt(x+Math.sin(this.lookYaw)*Math.cos(this.lookPitch),1.34+Math.sin(this.lookPitch),z-Math.cos(this.lookYaw)*Math.cos(this.lookPitch));}
    for(const {group,index} of this.wallGroups){
      let height=3;if(this.mode==='house'){
        if(index===0)height=Math.cos(this.azimuth)<0?.48:3;
        else if(index===1)height=Math.sin(this.azimuth)<0?.48:3;
        else if(index===2)height=Math.sin(this.azimuth)>0?.48:3;
        else if(index===3||index===4)height=Math.cos(this.azimuth)>0?.48:3;
        else height=.66;
      }group.scale.y=height/3;
    }
    this.wallSign.visible=this.mode==='person'||Math.cos(this.azimuth)>0;
    this.camera.updateMatrixWorld();
  }
  movement(dx,dy){const a=this.mode==='house'?this.azimuth:-this.lookYaw;return{x:dx*Math.cos(a)+dy*Math.sin(a),y:-dx*Math.sin(a)+dy*Math.cos(a)};}
  turn(amount){if(this.mode==='house')this.azimuth+=amount;else this.lookYaw+=amount;}
  beginOrbit(e){this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY};}
  orbit(e){
    if(!this.pointer||this.pointer.id!==e.pointerId)return;const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;this.pointer.x=e.clientX;this.pointer.y=e.clientY;
    if(this.mode==='house'){this.azimuth-=dx*.007;this.elevation=THREE.MathUtils.clamp(this.elevation+dy*.004,.58,1.43);}
    else{this.lookYaw+=dx*.006;this.lookPitch=THREE.MathUtils.clamp(this.lookPitch-dy*.005,-1.15,.9);}
  }
  endOrbit(id){if(this.pointer&&this.pointer.id===id)this.pointer=null;}
  wheel(delta){if(this.mode==='house'){this.zoom=THREE.MathUtils.clamp(this.zoom*Math.exp(-delta*.001),.72,1.6);this.resize();}}
  canGrab(e,player){
    if(this.mode!=='house')return false;const b=this.canvas.getBoundingClientRect(),v=new THREE.Vector3((player.x-450)/40,.47,(player.y-340)/40).project(this.camera),x=b.left+(v.x+1)*b.width/2,y=b.top+(1-v.y)*b.height/2;return Math.hypot(e.clientX-x,e.clientY-y)<23;
  }
  point(e){
    const b=this.canvas.getBoundingClientRect();this.pointerVector.set((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2);this.raycaster.setFromCamera(this.pointerVector,this.camera);
    if(!this.raycaster.ray.intersectPlane(this.groundPlane,this.intersection))return null;
    return{x:this.intersection.x*40+450,y:this.intersection.z*40+340};
  }
  resize(){
    const b=this.canvas.getBoundingClientRect(),w=Math.max(1,b.width),h=Math.max(1,b.height),a=w/h;
    this.renderer.setSize(w,h,false);const half=Math.max(10.5,14.2/a)/this.zoom;
    Object.assign(this.houseCamera,{left:-half*a,right:half*a,top:half,bottom:-half});this.houseCamera.updateProjectionMatrix();this.personCamera.aspect=a;this.personCamera.updateProjectionMatrix();
  }
  render(player,state,collision,now){
    if(this.contextLost)return;
    let moving=false;if(this.lastPlayer){const dx=player.x-this.lastPlayer.x,dy=player.y-this.lastPlayer.y;moving=Math.hypot(dx,dy)>.01;if(moving)this.body.rotation.y=Math.atan2(dx,dy);}
    this.lastPlayer={x:player.x,y:player.y};this.avatar.position.set((player.x-450)/40,0,(player.y-340)/40);this.body.position.y=moving&&!this.reduceMotion.matches?Math.sin(now/80)*.025:0;
    this.avatar.visible=this.mode==='house';this.playerTag.visible=state==='ready'||state==='playing';this.playerTag.scale.set(state==='ready'?1.75:1.35,state==='ready'?.4375:.3375,1);
    this.halo.visible=state==='ready'||state==='playing';this.collisionRing.visible=state==='lost';this.collisionRing.position.x=this.avatar.position.x;this.collisionRing.position.z=this.avatar.position.z;
    if(collision!==this.lastCollision){
      if(this.lastCollision){const old=this.objectGroups.get(this.lastCollision);old.traverse(o=>{if(o.isMesh&&o.userData.originalMaterial){o.material=o.userData.originalMaterial;delete o.userData.originalMaterial;}});}
      if(collision){const group=this.objectGroups.get(collision);group.traverse(o=>{if(o.isMesh){o.userData.originalMaterial=o.material;o.material=this.material('#e185a0');}});}this.lastCollision=collision;
    }
    this.updateCamera(player);this.renderer.render(this.scene,this.camera);
  }
}
