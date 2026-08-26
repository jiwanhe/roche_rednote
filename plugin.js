/**
 * 小紅書 — Roche Plugin v3
 * 偷看 TA 的小紅書
 * - 選擇偷看哪個 char
 * - 首頁 = NPC 貼文（char 會刷到的）
 * - 我的 = char 自己發的筆記
 * - 收藏 = AI 生成 char 會收藏的貼文
 * - 全走 roche.ai.chat()
 */
(function(){
'use strict';
const xhsApp={
  id:'xiaohongshu-home',name:'小紅書',icon:'auto_stories',iconImage:'',

  async mount(container,roche){
    const RED='#FF2442',RED_L='#FFF0F0',T1='#222',T2='#666',T3='#999',BD='#F0F0F0';
    const GRADS=['linear-gradient(135deg,#667eea,#764ba2)','linear-gradient(135deg,#f093fb,#f5576c)','linear-gradient(135deg,#4facfe,#00f2fe)','linear-gradient(135deg,#43e97b,#38f9d7)','linear-gradient(135deg,#fa709a,#fee140)','linear-gradient(135deg,#a18cd1,#fbc2eb)','linear-gradient(135deg,#fccb90,#d57eeb)','linear-gradient(135deg,#e0c3fc,#8ec5fc)','linear-gradient(135deg,#f5576c,#ff6a88)','linear-gradient(135deg,#2af598,#009efd)'];
    const rg=()=>GRADS[Math.floor(Math.random()*GRADS.length)];
    const rh=()=>160+Math.floor(Math.random()*140);
    const rl=()=>Math.floor(Math.random()*2000)+10;
    const rc=()=>Math.floor(Math.random()*80);
    const rNpcG=()=>['linear-gradient(135deg,#ff9a9e,#fad0c4)','linear-gradient(135deg,#a1c4fd,#c2e9fb)','linear-gradient(135deg,#fbc2eb,#a6c1ee)','linear-gradient(135deg,#84fab0,#8fd3f4)','linear-gradient(135deg,#fccb90,#d57eeb)'][Math.floor(Math.random()*5)];

    // ── State ──
    const S={
      view:'discover',detail:null,showSettings:false,generating:false,
      feedPosts:[],myPosts:[],savedPosts:[],liked:{},
      cfg:{charId:'',charName:'',userId:'',userName:'',genCount:5},
      // 選角用
      charList:[],userList:[],
      // 匯入的角色資料
      imported:null,
      importMsg:'',importErr:false,
      lastError:'',
      profileTab:'works',
      autoFetching:false,
      generatingComments:false,
    };

    // ── Storage ──
    const load=async(k)=>{try{const s=await roche.storage.get(k);return s?JSON.parse(s):null;}catch(_){return null;}};
    const save=async(k,v)=>{try{await roche.storage.set(k,JSON.stringify(v));}catch(_){}};
    Object.assign(S.cfg,(await load('xhs3_cfg'))||{});
    S.feedPosts=(await load('xhs3_feed'))||[];
    S.myPosts=(await load('xhs3_mine'))||[];
    S.savedPosts=(await load('xhs3_saved'))||[];
    S.imported=(await load('xhs3_imported'))||null;
    const saveCfg=()=>save('xhs3_cfg',S.cfg);
    const saveFeed=()=>save('xhs3_feed',S.feedPosts);
    const saveMine=()=>save('xhs3_mine',S.myPosts);
    const saveSaved=()=>save('xhs3_saved',S.savedPosts);
    const saveImported=()=>save('xhs3_imported',S.imported);
    const charName=()=>S.cfg.charName||S.imported?.name||'角色';

    // ── 初始化：拉角色和 persona 列表 ──
    try{S.charList=await roche.character.list()||[];}catch(_){}
    try{S.userList=await roche.persona.getUserPersonas()||[];}catch(_){}
    // 自動選第一個
    if(!S.cfg.charId&&S.charList.length){S.cfg.charId=S.charList[0].id;S.cfg.charName=S.charList[0].name;}
    if(!S.cfg.userId&&S.userList.length){S.cfg.userId=S.userList[0].id;S.cfg.userName=S.userList[0].name;}

    // ── Style ──
    const style=document.createElement('style');
    style.textContent=`
      .xr{width:100%;height:100%;position:relative;overflow:hidden;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif;background:#fff;display:flex;flex-direction:column;color:${T1}}
      .xr *{box-sizing:border-box}
      .xr-hdr{height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-bottom:1px solid ${BD};flex-shrink:0;background:#fff;z-index:20}
      .xr-hdr-btn{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;cursor:pointer;color:${T1}}
      .xr-hdr-title{color:${RED};font-weight:900;font-size:16px;letter-spacing:1px}
      .xr-body{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
      .xr-nav{display:flex;align-items:center;justify-content:space-around;padding:6px 0 max(env(safe-area-inset-bottom),8px);border-top:1px solid ${BD};flex-shrink:0;background:#fff;z-index:20}
      .xr-nav-btn{display:flex;flex-direction:column;align-items:center;background:none;border:none;cursor:pointer;padding:4px 8px;gap:2px}
      .xr-nav-btn span{font-size:10px}
      .xr-nav-plus{width:42px;height:30px;border-radius:8px;background:${RED};border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(255,36,66,.3)}
      .xr-search{padding:8px 12px;position:sticky;top:0;background:#fff;z-index:10}
      .xr-search-inner{display:flex;align-items:center;gap:8px;background:#F5F5F5;border-radius:20px;padding:8px 14px}
      .xr-cats{display:flex;gap:14px;padding:4px 14px 10px;overflow-x:auto}
      .xr-cats span{font-size:13px;color:${T3};white-space:nowrap;cursor:pointer;padding-bottom:4px}
      .xr-cats span.active{font-weight:700;color:${T1};border-bottom:2px solid ${RED}}
      .xr-wf{column-count:2;column-gap:8px;padding:0 8px}
      .xr-card{break-inside:avoid;margin-bottom:8px;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.06)}
      .xr-card-cover{width:100%;display:flex;align-items:center;justify-content:center;position:relative}
      .xr-card-cover .emoji{font-size:40px;opacity:.6}
      .xr-card-body{padding:8px 10px}
      .xr-card-title{font-size:13px;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .xr-card-meta{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
      .xr-card-author{display:flex;align-items:center;gap:4px}
      .xr-card-author .av{width:16px;height:16px;border-radius:50%}
      .xr-card-author span{font-size:10px;color:${T3}}
      .xr-card-likes{display:flex;align-items:center;gap:3px;font-size:10px;color:${T3}}
      .xr-empty{text-align:center;padding:70px 20px;color:${T3}}
      .xr-empty .icon{font-size:44px;margin-bottom:12px}
      .xr-empty p{font-size:14px;margin:0 0 16px}
      .xr-btn{padding:10px 26px;border-radius:20px;background:${RED};color:#fff;border:none;font-weight:600;font-size:14px;cursor:pointer}
      .xr-btn:disabled{opacity:.5}
      .xr-btn-o{padding:8px 22px;border-radius:16px;background:${RED_L};color:${RED};border:1px solid ${RED}30;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .xr-phdr{padding:16px 20px 0;display:flex;flex-direction:column;align-items:center;gap:6px}
      .xr-avatar{width:68px;height:68px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:700}
      .xr-pname{font-weight:800;font-size:17px}
      .xr-pstats{display:flex;gap:32px;margin:8px 0}
      .xr-pstats div{text-align:center}
      .xr-pstats .v{font-weight:700;font-size:16px}
      .xr-pstats .l{font-size:10px;color:${T3};margin-top:2px}
      .xr-pbio{font-size:13px;color:${T2};text-align:center;line-height:1.5;margin:4px 0 0;white-space:pre-wrap;max-width:280px}
      .xr-tabs{display:flex;border-bottom:1px solid ${BD};margin-top:10px;position:sticky;top:0;background:#fff;z-index:10}
      .xr-tab{flex:1;text-align:center;padding:12px 0;font-size:14px;font-weight:600;cursor:pointer;position:relative;color:${T3}}
      .xr-tab.on{color:${T1}}
      .xr-tab.on::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:22px;height:2.5px;background:${RED};border-radius:2px}
      .xr-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:2px}
      .xr-gi{aspect-ratio:3/4;position:relative;cursor:pointer;overflow:hidden}
      .xr-gi .emoji{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:32px;opacity:.5}
      .xr-gi .ov{position:absolute;bottom:0;left:0;right:0;padding:20px 8px 8px;background:linear-gradient(transparent,rgba(0,0,0,.5))}
      .xr-gi .ov span{font-size:11px;color:#fff;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .xr-dt{position:absolute;inset:0;z-index:100;background:#fff;overflow-y:auto;display:flex;flex-direction:column}
      .xr-dt-cover{width:100%;min-height:280px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .xr-dt-body{padding:16px 16px 100px}
      .xr-dt-body h2{font-size:17px;font-weight:700;margin:0 0 10px;line-height:1.4}
      .xr-dt-body .ct{font-size:14px;color:${T2};line-height:1.7;white-space:pre-wrap}
      .xr-dt-tags{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px}
      .xr-dt-tags span{font-size:12px;color:#3478F6;background:#EEF4FF;padding:3px 8px;border-radius:4px}
      .xr-dt-acts{display:flex;gap:18px;margin-top:18px;padding-top:14px;border-top:1px solid ${BD}}
      .xr-act{display:flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;font-size:12px;color:${T3}}
      .xr-cm-sec{margin-top:18px;padding-top:14px;border-top:1px solid ${BD}}
      .xr-cm-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .xr-cm-hdr span{font-size:13px;font-weight:700;color:${T1}}
      .xr-cm-item{display:flex;gap:8px;margin-bottom:14px}
      .xr-cm-av{width:32px;height:32px;border-radius:50%;flex-shrink:0}
      .xr-cm-body{flex:1;min-width:0}
      .xr-cm-name{font-size:12px;color:${T3};margin-bottom:2px}
      .xr-cm-text{font-size:13.5px;color:${T1};line-height:1.5}
      .xr-cm-meta{display:flex;align-items:center;gap:12px;margin-top:4px}
      .xr-cm-meta span{font-size:11px;color:${T3}}
      .xr-cm-like{display:flex;align-items:center;gap:3px;background:none;border:none;cursor:pointer;color:${T3}}
      .xr-cm-reply{margin-top:8px;margin-left:8px;padding-left:10px;border-left:2px solid ${BD}}
      .xr-cm-gen-btn{width:100%;padding:9px 0;border-radius:16px;background:${RED_L};color:${RED};border:1px solid ${RED}30;font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
      .xr-mask{position:absolute;inset:0;z-index:200;background:rgba(0,0,0,.45);display:flex;align-items:flex-end}
      .xr-set{width:100%;background:#fff;border-radius:16px 16px 0 0;padding:18px;max-height:80%;overflow-y:auto}
      .xr-set-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
      .xr-sl{display:block;font-size:12px;font-weight:600;color:${T2};margin:10px 0 4px}
      .xr-si{width:100%;padding:9px 12px;border-radius:10px;border:1px solid ${BD};font-size:13px;outline:none;background:#FAFAFA;font-family:inherit}
      .xr-si:focus{border-color:${RED}60}
      .xr-sbtn{width:100%;padding:11px 0;border-radius:24px;background:${RED};color:#fff;border:none;font-weight:700;font-size:14px;margin-top:14px;cursor:pointer}
      .xr-toast{position:absolute;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:300;pointer-events:none;animation:xf .3s}
      @keyframes xf{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    `;
    container.appendChild(style);

    // ── Icons ──
    const I={
      back:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`,
      gear:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T2}" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
      refresh:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
      search:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
      heart:(f,s=14)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f?RED:'none'}" stroke="${f?RED:T3}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
      comment:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
      star:(f)=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="${f?'#FFD700':'none'}" stroke="${f?'#FFD700':T3}" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
      share:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
      home:(a)=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="${a?RED:'none'}" stroke="${a?RED:T3}" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22" stroke="${a?'#fff':T3}"/></svg>`,
      user:(a)=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${a?RED:T3}" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      plus:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    };
    function esc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):''}
    function toast(m){const t=document.createElement('div');t.className='xr-toast';t.textContent=m;root.appendChild(t);setTimeout(()=>t.remove(),2500)}

    // ── Context builder ──
    function ctxLite(){
      const im=S.imported;if(!im)return '';let c='';
      if(im.persona)c+=`\n【角色個性】\n${im.persona.slice(0,600)}\n`;
      if(im.coreSummary)c+=`\n【近況】\n${im.coreSummary.slice(0,400)}\n`;
      if(im.factMemories?.length)c+=`\n【最近的事】\n${im.factMemories.slice(0,4).map((f,i)=>`${i+1}. ${f.slice(0,120)}`).join('\n')}\n`;
      return c;
    }
    function ctxFull(){
      const im=S.imported;if(!im)return '';let c='';
      if(im.persona)c+=`\n【角色人設】\n${im.persona}\n`;
      if(im.coreSummary)c+=`\n【角色近況】\n${im.coreSummary}\n`;
      if(im.factMemories?.length)c+=`\n【近期事件】\n${im.factMemories.map((f,i)=>`${i+1}. ${f}`).join('\n')}\n`;
      if(im.recentMessages?.length)c+=`\n【說話語氣】\n${im.recentMessages.slice(-10).map(t=>'- '+t).join('\n')}\n`;
      return c;
    }

    // ── API ──
    async function callAI(prompt,sysMsg){
      const msgs=[];
      if(sysMsg)msgs.push({role:'system',content:sysMsg});
      msgs.push({role:'user',content:prompt});
      const r=await roche.ai.chat({messages:msgs,max_tokens:8000});
      if(!r)throw new Error('AI 回應為空');
      return r.text||r.choices?.[0]?.message?.content||'';
    }
    function parseJSON(raw){
      const c=raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
      try{return JSON.parse(c)}catch(_){}
      const m=c.match(/\[[\s\S]*\]/);if(m)try{return JSON.parse(m[0])}catch(_){}
      const m2=c.match(/\{[\s\S]*\}/);if(m2)try{return JSON.parse(m2[0])}catch(_){}
      return null;
    }

    // ── 自動抓取角色資料 ──
    async function fetchChar(){
      S.autoFetching=true;render();
      try{
        const im={importedAt:Date.now(),persona:'',bio:'',coreSummary:'',factMemories:[],recentMessages:[],name:'',handle:''};
        const cid=S.cfg.charId;
        if(cid){
          try{const f=await roche.character.get(cid);if(f){im.name=f.name||f.handle||'';im.handle=f.handle||'';im.persona=f.persona||'';im.bio=f.bio||'';}}catch(_){}
        }
        if(!im.name){const ch=S.charList.find(c=>c.id===cid);if(ch)im.name=ch.name||ch.handle||'';}
        try{
          const ltm=await roche.memory.getLongTerm();
          if(ltm?.core?.length)im.coreSummary=ltm.core.map(c=>c.summary||'').filter(Boolean).join('\n\n');
          if(ltm?.facts?.length)im.factMemories=ltm.facts.slice(0,10).map(f=>(f.action||'').slice(0,200)).filter(Boolean);
        }catch(_){}
        try{
          const stm=await roche.memory.getShortTerm();
          if(Array.isArray(stm))im.recentMessages=stm.filter(m=>!m.isMe&&m.text).slice(-20).map(m=>m.text);
        }catch(_){}
        if(im.name||im.persona||im.coreSummary){
          S.imported=im;await saveImported();
          if(!S.cfg.charName)S.cfg.charName=im.name;
          toast('✨ 已抓取 '+im.name);
          S.importMsg=`人設${im.persona?'✓':'✕'}(${im.persona.length}字) 摘要${im.coreSummary?'✓':'✕'} 記憶${im.factMemories.length}筆 語氣${im.recentMessages.length}則`;
          S.importErr=false;
        }else{S.importMsg='沒有抓到資料';S.importErr=true;}
      }catch(e){S.importMsg='失敗：'+e.message;S.importErr=true;}
      S.autoFetching=false;render();
    }

    // ═══ 生成：首頁 NPC 貼文 ═══
    const SYS_FEED=`你是小紅書貼文模擬器。生成像真實小紅書/抖音用戶寫的貼文。
重要比例規則：
- 每批貼文中，最多只有 1-2 篇跟角色興趣直接相關，其餘全部是隨機話題——就像真實推薦頁一樣什麼都有
- 話題要盡量分散且不重複：每篇必須是不同領域、不同情境、不同情緒的內容
- 禁止連續出現同類型貼文（比如連續兩篇都是美食，或連續兩篇都是吐槽）
- 每次生成的內容要跟之前的不一樣，盡量想出新鮮有趣的話題

語氣規則：
- 語氣像真正的中國大陸+台灣小紅書網友混搭：口語化、自嘲、吐槽、誇張接地氣
- 善用流行語：家人們誰懂啊、救命、絕了、DNA動了、離大譜、笑不活了、不是哥們、真的栓Q了、好嗑、上頭、破防了、泰褲辣、哈基咪、真的很可以、確定不是在整我、閨蜜看了都沉默、這波在大氣層、格局打開了、人類高質量xx、xx天花板
- 抖音風摻一點：離了個大譜、老鐵們、家人們我真的哭死、你們城裡人真會玩、建議全國推廣
- 標題：震驚體、反問體、數字體、求救體
- 正文：短句換行、emoji穿插、口語感、偶爾哈哈哈哈哈/？？？/嗚嗚嗚
- 暱稱有個性（加班到禿的社畜、奶茶續命中、減肥第一天就破功、房東的噩夢、被貓養的人）

內容類型池（每次隨機抽，確保多樣）：
美食踩雷種草、社死現場、職場吐槽、沙雕日常、冷知識震驚、租房裝修、健身掙扎、深夜emo帶自嘲、旅行探店、追劇遊戲、時事吐槽、寵物搞笑、穿搭翻車、數碼3C測評、省錢攻略、交通奇遇、快遞外賣故事、相親/戀愛吐槽、考試讀書、天氣吐槽、鄰居/室友奇葩、網購開箱翻車、醫院看病體驗、家長催婚、星座玄學、DIY手工、二手交易故事

只回 JSON 陣列，不要任何其他文字。
格式：[{"author":"暱稱","title":"標題","content":"正文","tags":["標籤"],"coverEmoji":"emoji","date":"時間"}]`;

    async function genFeed(){
      if(S.generating)return;S.generating=true;S.lastError='';render();
      const n=charName(),cnt=parseInt(S.cfg.genCount)||5,ctx=ctxLite();
      const p=`生成 ${cnt} 篇小紅書推薦頁貼文。注意：大部分是完全隨機的熱門話題，只有 1-2 篇跟這個人有關。隨機種子：${Date.now()}\n${ctx?`\n以下是刷小紅書的人的資料（僅供 1-2 篇參考，其餘不要用）：\n${ctx}`:''}`;
      try{
        const raw=await callAI(p,SYS_FEED);
        let arr=parseJSON(raw);
        if(!arr||!Array.isArray(arr))throw new Error('JSON 解析失敗：'+raw.slice(0,120));
        const news=arr.map((p,i)=>({...p,id:'f'+Date.now()+'_'+i,author:p.author||'路人',gradient:rg(),avatarGrad:rNpcG(),coverH:rh(),likes:rl(),comments:rc()}));
        S.feedPosts=[...news,...S.feedPosts];saveFeed();toast('✨ 刷到 '+news.length+' 篇');
      }catch(e){S.lastError=e.message;toast('⚠ 失敗');}
      S.generating=false;render();
    }

    // ═══ 生成：char 自己的筆記 ═══
    async function genMine(){
      if(S.generating)return;S.generating=true;S.lastError='';render();
      const n=charName(),cnt=Math.min(parseInt(S.cfg.genCount)||3,5),ctx=ctxFull();
      const p=`你是「${n}」。\n${ctx}\n以「${n}」的身份生成 ${cnt} 篇TA自己會發的小紅書筆記。內容要完全貼合角色的個性、語氣、近期經歷。可以是心情碎念、生活側寫、工作感悟。用角色自己的說話方式，不要用通用小紅書語氣。\n\n每篇要有 title、content(200-400字)、tags(3-5個)、coverEmoji、date\n只回 JSON 陣列。`;
      try{
        const raw=await callAI(p);
        let arr=parseJSON(raw);
        if(!arr||!Array.isArray(arr))throw new Error('JSON 解析失敗：'+raw.slice(0,120));
        const news=arr.map((p,i)=>({...p,id:'m'+Date.now()+'_'+i,author:n,gradient:rg(),avatarGrad:'linear-gradient(135deg,#667eea,#764ba2)',coverH:rh(),likes:rl(),comments:rc()}));
        S.myPosts=[...news,...S.myPosts];saveMine();toast('✨ 發布 '+news.length+' 篇');
      }catch(e){S.lastError=e.message;toast('⚠ 失敗');}
      S.generating=false;render();
    }

    // ═══ 生成：char 會收藏的貼文 ═══
    async function genSaved(){
      if(S.generating)return;S.generating=true;S.lastError='';render();
      const n=charName(),cnt=Math.min(parseInt(S.cfg.genCount)||3,5),ctx=ctxLite();
      const sys=`你是小紅書貼文模擬器。生成「${n}」會收藏的貼文——這些是路人發的、但內容深深觸動了TA或非常符合TA審美/興趣的帖子。語氣跟普通小紅書用戶一樣（不是TA自己寫的），但選題要精準命中TA的喜好。只回 JSON 陣列。格式同上。`;
      const p=`生成 ${cnt} 篇「${n}」會主動收藏的小紅書貼文。${ctx?`\nTA的資料：\n${ctx}`:''}`;
      try{
        const raw=await callAI(p,sys);
        let arr=parseJSON(raw);
        if(!arr||!Array.isArray(arr))throw new Error('JSON 解析失敗：'+raw.slice(0,120));
        const news=arr.map((p,i)=>({...p,id:'s'+Date.now()+'_'+i,author:p.author||'路人',gradient:rg(),avatarGrad:rNpcG(),coverH:rh(),likes:rl(),comments:rc()}));
        S.savedPosts=[...news,...S.savedPosts];saveSaved();toast('⭐ '+news.length+' 篇收藏');
      }catch(e){S.lastError=e.message;toast('⚠ 失敗');}
      S.generating=false;render();
    }

    // ═══ 生成：貼文的評論區 ═══
    const SYS_COMMENTS=`你是小紅書評論區模擬器。針對一篇貼文生成一批真實網友的留言。
規則：
- 留言要像真實小紅書評論：短、口語化、有梗、有互相調侃
- 混合類型：附和共鳴（"啊啊啊我也是"）、抬槓吐槽、玩梗接龍、求連結/求教程、關心提問、陰陽怪氣但不惡毒、簡短誇獎、歪樓神評
- 長度差異大：有些留言只有幾個字（"笑死"、"救命"、"樓主好美"），有些長一點
- 部分留言可以有 1-2 則簡短回覆（樓中樓），製造互動感
- 每則留言需要：author（暱稱）、text（留言內容）、likes（數字，多數個位數到兩位數，少數可以破百）
- 部分留言可以有 replies 陣列（0-2則回覆），每則回覆同樣有 author、text、likes
- 只回 JSON 陣列，不要任何其他文字
- 格式：[{"author":"暱稱","text":"留言","likes":12,"replies":[{"author":"暱稱","text":"回覆","likes":3}]}]`;

    async function genComments(post){
      if(S.generatingComments)return;
      S.generatingComments=true;render();
      const isMine=S.myPosts.includes(post);
      const n=charName();
      const p=`貼文標題：「${post.title}」\n貼文內容：${post.content}\n${isMine?`\n這是「${n}」自己發的貼文。生成的留言裡，可以讓 1-2 則路人留言得到「${n}」本人的簡短回覆（回覆時 author 直接寫「${n}」，語氣要符合TA本人）。`:''}\n生成 6-10 則留言。`;
      try{
        const raw=await callAI(p,SYS_COMMENTS);
        let arr=parseJSON(raw);
        if(!arr||!Array.isArray(arr))throw new Error('留言解析失敗');
        post.commentList=arr;
        // 更新 comments 數字為實際留言數（含回覆）
        post.comments=arr.reduce((sum,c)=>sum+1+((c.replies||[]).length),0);
        // 存回對應的陣列
        if(S.feedPosts.includes(post))saveFeed();
        else if(S.myPosts.includes(post))saveMine();
        else if(S.savedPosts.includes(post))saveSaved();
        toast('💬 生成了 '+arr.length+' 則留言');
      }catch(e){toast('⚠ 留言生成失敗：'+e.message);}
      S.generatingComments=false;render();
    }

    // ── Render ──
    const root=document.createElement('div');root.className='xr';container.appendChild(root);
    function render(){
      let h='';
      h+=`<div class="xr-hdr"><button class="xr-hdr-btn" data-a="exit">${I.back}</button><span class="xr-hdr-title">小紅書</span><div style="display:flex;gap:2px"><button class="xr-hdr-btn" data-a="settings">${I.gear}</button><button class="xr-hdr-btn" data-a="gen-feed" ${S.generating?'disabled':''}>${S.generating?'⏳':I.refresh}</button></div></div>`;
      h+=`<div class="xr-body">${S.view==='discover'?vDiscover():vProfile()}</div>`;
      h+=`<div class="xr-nav"><button class="xr-nav-btn" data-a="go-discover">${I.home(S.view==='discover')}<span style="color:${S.view==='discover'?RED:T3}">首頁</span></button><button class="xr-nav-btn" disabled>${I.star(false)}<span>購物</span></button><button class="xr-nav-plus" data-a="gen-feed" ${S.generating?'disabled':''}>${I.plus}</button><button class="xr-nav-btn" disabled>${I.comment}<span>消息</span></button><button class="xr-nav-btn" data-a="go-profile">${I.user(S.view==='profile')}<span style="color:${S.view==='profile'?RED:T3}">我</span></button></div>`;
      if(S.detail)h+=vDetail(S.detail);
      if(S.showSettings)h+=vSettings();
      root.innerHTML=h;
    }

    function cardHTML(p,idx,src){
      return `<div class="xr-card" data-a="open" data-s="${src}" data-i="${idx}"><div class="xr-card-cover" style="height:${p.coverH||180}px;background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}</div><div class="xr-card-body"><div class="xr-card-title">${esc(p.title)}</div><div class="xr-card-meta"><div class="xr-card-author"><div class="av" style="background:${p.avatarGrad||'#ddd'}"></div><span>${esc(p.author)}</span></div><div class="xr-card-likes">${I.heart(false,12)}<span>${p.likes}</span></div></div></div></div>`;
    }

    function vDiscover(){
      let h=`<div class="xr-search"><div class="xr-search-inner">${I.search}<span>搜尋小紅書</span></div></div>`;
      h+=`<div class="xr-cats">${['推薦','穿搭','美食','旅行','日常','攝影'].map((t,i)=>`<span class="${i===0?'active':''}">${t}</span>`).join('')}</div>`;
      if(S.lastError)h+=`<div style="margin:8px 12px;padding:10px 12px;border-radius:10px;background:#FFF5F5;border:1px solid #FFDDDD;font-size:12px;color:#CC3333;line-height:1.5">⚠ ${esc(S.lastError)}</div>`;
      if(!S.imported&&!S.feedPosts.length)h+=`<div style="margin:0 12px 8px;padding:8px 12px;border-radius:8px;background:#FFF8E8;border:1px solid #F0E0B0;font-size:11px;color:#996600">💡 先到設定選擇角色並抓取資料</div>`;
      if(!S.feedPosts.length){
        h+=`<div class="xr-empty"><div class="icon">🌿</div><p>TA 還沒刷小紅書</p><button class="xr-btn" data-a="gen-feed" ${S.generating?'disabled':''}>${S.generating?'⏳':'✨ 刷一刷'}</button></div>`;
      }else{
        h+=`<div class="xr-wf">${S.feedPosts.map((p,i)=>cardHTML(p,i,'feed')).join('')}</div>`;
        h+=`<div style="text-align:center;padding:14px 0 6px"><button class="xr-btn-o" data-a="gen-feed" ${S.generating?'disabled':''}>${I.refresh} ${S.generating?'生成中...':'刷更多'}</button></div>`;
      }
      return h;
    }

    function vProfile(){
      const n=charName(),bio=S.imported?.bio||S.imported?.coreSummary||'';
      let h=`<div class="xr-phdr"><div class="xr-avatar" style="background:linear-gradient(135deg,#667eea,#764ba2)">${n[0]||'?'}</div><div class="xr-pname">${esc(n)}</div><div class="xr-pstats"><div><div class="v">42</div><div class="l">關注</div></div><div><div class="v">1.2k</div><div class="l">粉絲</div></div><div><div class="v">8.8w</div><div class="l">獲讚</div></div></div>${bio?`<p class="xr-pbio">${esc(bio.slice(0,90))}</p>`:''}</div>`;
      h+=`<div class="xr-tabs"><div class="xr-tab ${S.profileTab==='works'?'on':''}" data-a="ptab" data-t="works">筆記</div><div class="xr-tab ${S.profileTab==='saved'?'on':''}" data-a="ptab" data-t="saved">收藏</div></div>`;
      if(S.profileTab==='works'){
        if(!S.myPosts.length){
          h+=`<div class="xr-empty"><div class="icon">📝</div><p>TA 還沒發筆記</p><button class="xr-btn" data-a="gen-mine" ${S.generating?'disabled':''}>${S.generating?'生成中...':'✨ 生成筆記'}</button></div>`;
        }else{
          h+=`<div class="xr-grid">${S.myPosts.map((p,i)=>`<div class="xr-gi" data-a="open" data-s="mine" data-i="${i}" style="background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}<div class="ov"><span>${esc(p.title)}</span></div></div>`).join('')}</div>`;
          h+=`<div style="text-align:center;padding:14px 0"><button class="xr-btn-o" data-a="gen-mine" ${S.generating?'disabled':''}>${I.refresh} 生成更多</button></div>`;
        }
      }else{
        if(!S.savedPosts.length){
          h+=`<div class="xr-empty"><div class="icon">⭐</div><p>TA 還沒收藏貼文</p><button class="xr-btn" data-a="gen-saved" ${S.generating?'disabled':''}>${S.generating?'生成中...':'✨ 生成收藏'}</button></div>`;
        }else{
          h+=`<div class="xr-grid">${S.savedPosts.map((p,i)=>`<div class="xr-gi" data-a="open" data-s="saved" data-i="${i}" style="background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}<div class="ov"><span>${esc(p.title)}</span></div></div>`).join('')}</div>`;
          h+=`<div style="text-align:center;padding:14px 0"><button class="xr-btn-o" data-a="gen-saved" ${S.generating?'disabled':''}>${I.refresh} 生成更多</button></div>`;
        }
      }
      return h;
    }

    function commentHTML(c){
      return `<div class="xr-cm-item"><div class="xr-cm-av" style="background:${rNpcG()}"></div><div class="xr-cm-body"><div class="xr-cm-name">${esc(c.author)}</div><div class="xr-cm-text">${esc(c.text)}</div><div class="xr-cm-meta"><span>${Math.floor(Math.random()*20)+1}小時前</span><button class="xr-cm-like">${I.heart(false,12)}<span>${c.likes||0}</span></button></div>${(c.replies||[]).length?`<div class="xr-cm-reply">${c.replies.map(r=>`<div class="xr-cm-item" style="margin-bottom:8px"><div class="xr-cm-av" style="width:24px;height:24px;background:${rNpcG()}"></div><div class="xr-cm-body"><div class="xr-cm-name">${esc(r.author)}</div><div class="xr-cm-text" style="font-size:12.5px">${esc(r.text)}</div><div class="xr-cm-meta"><button class="xr-cm-like">${I.heart(false,11)}<span>${r.likes||0}</span></button></div></div></div>`).join('')}</div>`:''}</div></div>`;
    }

    function vDetail(p){
      const src=S.feedPosts.includes(p)?'feed':S.myPosts.includes(p)?'mine':'saved';
      const idx=src==='feed'?S.feedPosts.indexOf(p):src==='mine'?S.myPosts.indexOf(p):S.savedPosts.indexOf(p);
      const k=src[0]+idx,liked=S.liked[k];
      let commentsHTML=`<div class="xr-cm-sec"><div class="xr-cm-hdr"><span>💬 共 ${p.comments||0} 條評論</span></div>`;
      if(p.commentList&&p.commentList.length){
        commentsHTML+=p.commentList.map(c=>commentHTML(c)).join('');
        commentsHTML+=`<button class="xr-cm-gen-btn" data-a="gen-comments" data-s="${src}" data-i="${idx}" ${S.generatingComments?'disabled':''}>${S.generatingComments?'⏳ 生成中...':I.refresh+' 重新生成留言'}</button>`;
      }else{
        commentsHTML+=`<button class="xr-cm-gen-btn" data-a="gen-comments" data-s="${src}" data-i="${idx}" ${S.generatingComments?'disabled':''}>${S.generatingComments?'⏳ 生成留言中...':'💬 生成評論區'}</button>`;
      }
      commentsHTML+=`</div>`;
      return `<div class="xr-dt"><div class="xr-hdr" style="border-bottom:1px solid ${BD}"><button class="xr-hdr-btn" data-a="close-dt">${I.back}</button><div style="display:flex;align-items:center;gap:6px"><div style="width:26px;height:26px;border-radius:50%;background:${p.avatarGrad||'#ddd'}"></div><span style="font-size:13px;font-weight:600">${esc(p.author)}</span></div><button style="background:${RED};color:#fff;border:none;border-radius:14px;padding:4px 14px;font-size:12px;font-weight:600;cursor:pointer">關注</button></div><div class="xr-dt-cover" style="background:${p.gradient}">${p.coverEmoji?`<span style="font-size:64px;opacity:.5">${p.coverEmoji}</span>`:''}</div><div class="xr-dt-body"><h2>${esc(p.title)}</h2><div class="ct">${esc(p.content)}</div>${p.tags?.length?`<div class="xr-dt-tags">${p.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}<div style="font-size:12px;color:${T3};margin-top:12px">${esc(p.date||'')}</div><div class="xr-dt-acts"><button class="xr-act" data-a="like" data-k="${k}">${I.heart(liked,18)}<span style="color:${liked?RED:T3}">${liked?p.likes+1:p.likes}</span></button><button class="xr-act">${I.comment}<span>${p.comments||0}</span></button><button class="xr-act">${I.share}<span>分享</span></button></div>${commentsHTML}</div></div>`;
    }

    function vSettings(){
      const c=S.cfg;
      let h=`<div class="xr-mask"><div class="xr-set"><div class="xr-set-hdr"><span style="font-weight:700;font-size:15px">設定</span><button data-a="close-set" style="background:none;border:none;font-size:18px;color:${T3};cursor:pointer">✕</button></div>`;
      // 偷看誰
      h+=`<label class="xr-sl">👀 偷看誰的小紅書？</label>`;
      h+=`<select class="xr-si" data-f="charId">${S.charList.map(ch=>`<option value="${esc(ch.id)}" ${ch.id===c.charId?'selected':''}>${esc(ch.name||ch.handle)}</option>`).join('')}</select>`;
      h+=`<label class="xr-sl">🙋 你是誰？（User Persona）</label>`;
      h+=`<select class="xr-si" data-f="userId">${S.userList.map(u=>`<option value="${esc(u.id)}" ${u.id===c.userId?'selected':''}>${esc(u.name||u.handle)}</option>`).join('')}</select>`;
      // 生成筆數
      h+=`<label class="xr-sl">每次生成幾篇</label><input class="xr-si" data-f="genCount" type="number" min="1" max="10" value="${c.genCount||5}" style="width:80px">`;
      // 角色資料
      h+=`<label class="xr-sl" style="margin-top:16px;padding-top:12px;border-top:1px solid ${BD}">角色資料</label>`;
      h+=`<button data-a="fetch-char" class="xr-sbtn" style="background:#2d8a5f;margin-top:0" ${S.autoFetching?'disabled':''}>${S.autoFetching?'⏳ 抓取中...':'🚀 自動抓取所選角色資料'}</button>`;
      if(S.imported)h+=`<div style="font-size:11px;color:${T2};background:#FAFAFA;border:1px solid ${BD};border-radius:8px;padding:8px;margin-top:8px">已抓取：<strong>${esc(S.imported.name)}</strong>　${S.importMsg||''}</div>`;
      if(S.importErr)h+=`<div style="font-size:11px;color:${RED};margin-top:4px">${esc(S.importMsg)}</div>`;
      // 操作
      h+=`<button data-a="save-set" class="xr-sbtn">儲存設定</button>`;
      h+=`<button data-a="clear-all" class="xr-sbtn" style="background:#fff;color:${RED};border:1px solid ${RED};margin-top:8px">🗑️ 清除所有內容</button>`;
      h+=`</div></div>`;
      return h;
    }

    // ── Events ──
    function onClick(e){
      const b=e.target.closest('[data-a]');if(!b)return;
      const a=b.dataset.a;
      if(a==='settings'){S.showSettings=true;render();}
      else if(a==='close-set'){S.showSettings=false;render();}
      else if(a==='exit'){roche.ui?.closeApp?.();}
      else if(a==='gen-feed'){genFeed();}
      else if(a==='gen-mine'){genMine();}
      else if(a==='gen-saved'){genSaved();}
      else if(a==='go-discover'){S.view='discover';render();}
      else if(a==='go-profile'){S.view='profile';render();}
      else if(a==='ptab'){S.profileTab=b.dataset.t;render();}
      else if(a==='open'){
        const s=b.dataset.s,i=parseInt(b.dataset.i);
        const list=s==='feed'?S.feedPosts:s==='mine'?S.myPosts:S.savedPosts;
        if(!isNaN(i)&&list[i]){S.detail=list[i];render();}
      }
      else if(a==='close-dt'){S.detail=null;render();}
      else if(a==='gen-comments'){
        const s=b.dataset.s,i=parseInt(b.dataset.i);
        const list=s==='feed'?S.feedPosts:s==='mine'?S.myPosts:S.savedPosts;
        if(!isNaN(i)&&list[i])genComments(list[i]);
      }
      else if(a==='like'){const k=b.dataset.k;S.liked[k]=!S.liked[k];render();}
      else if(a==='fetch-char'){
        // 先把下拉選項同步到 cfg
        root.querySelectorAll('[data-f]').forEach(el=>{S.cfg[el.dataset.f]=el.value;});
        const ch=S.charList.find(c=>c.id===S.cfg.charId);
        if(ch)S.cfg.charName=ch.name||ch.handle||'';
        const us=S.userList.find(u=>u.id===S.cfg.userId);
        if(us)S.cfg.userName=us.name||us.handle||'';
        saveCfg();fetchChar();
      }
      else if(a==='save-set'){
        root.querySelectorAll('[data-f]').forEach(el=>{S.cfg[el.dataset.f]=el.value;});
        const ch=S.charList.find(c=>c.id===S.cfg.charId);
        if(ch)S.cfg.charName=ch.name||ch.handle||'';
        const us=S.userList.find(u=>u.id===S.cfg.userId);
        if(us)S.cfg.userName=us.name||us.handle||'';
        saveCfg();S.showSettings=false;toast('已儲存');render();
      }
      else if(a==='clear-all'){S.feedPosts=[];S.myPosts=[];S.savedPosts=[];S.liked={};saveFeed();saveMine();saveSaved();S.showSettings=false;toast('已清除');render();}
    }
    root.addEventListener('click',onClick);
    render();
    this._el=root;this._st=style;this._fn=onClick;
  },

  async unmount(container){
    if(this._el){this._el.removeEventListener('click',this._fn);this._el.remove();}
    if(this._st)this._st.remove();
    container.replaceChildren();
  }
};

window.RochePlugin.register({id:'roche-xiaohongshu',name:'小紅書',version:'3.0.0',description:'偷看 TA 的小紅書',author:'予佟',apps:[xhsApp]});
})();
