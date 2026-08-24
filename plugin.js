/**
 * 小紅書 — Roche Plugin v2
 * 偷看 TA 的小紅書：首頁=刷到的路人貼文，我的=char自己發的
 */
(function () {
  'use strict';

  const xhsApp = {
    id: 'xiaohongshu-home',
    name: '小紅書',
    icon: 'auto_stories',
    iconImage: '',

    async mount(container, roche) {
      // ── 掃描 roche 物件結構 ──
      function inspectObj(obj, prefix, depth) {
        if (depth > 3 || !obj) return [];
        const results = [];
        const seen = new Set();
        // own properties + prototype chain
        let cur = obj;
        for (let d = 0; d < 3 && cur; d++) {
          for (const key of Object.getOwnPropertyNames(cur)) {
            if (seen.has(key) || key === 'constructor') continue;
            seen.add(key);
            const path = prefix ? prefix + '.' + key : key;
            try {
              const val = obj[key];
              const type = typeof val;
              if (type === 'function') {
                results.push(path + '()');
              } else if (type === 'object' && val !== null && !Array.isArray(val)) {
                results.push(path + ' {object}');
                results.push(...inspectObj(val, path, depth + 1));
              } else if (Array.isArray(val)) {
                results.push(path + ' [array, len=' + val.length + ']');
              } else {
                results.push(path + ' = ' + String(val).slice(0, 80));
              }
            } catch (_) {
              results.push(path + ' (inaccessible)');
            }
          }
          cur = Object.getPrototypeOf(cur);
          if (cur === Object.prototype) break;
        }
        return results;
      }
      const _rocheAPI = inspectObj(roche, 'roche', 0);
      console.log('[小紅書] roche API 結構：', _rocheAPI);

      const RED = '#FF2442', RED_L = '#FFF0F0', T1 = '#222', T2 = '#666', T3 = '#999', BD = '#F0F0F0';
      const GRADS = [
        'linear-gradient(135deg,#667eea,#764ba2)','linear-gradient(135deg,#f093fb,#f5576c)',
        'linear-gradient(135deg,#4facfe,#00f2fe)','linear-gradient(135deg,#43e97b,#38f9d7)',
        'linear-gradient(135deg,#fa709a,#fee140)','linear-gradient(135deg,#a18cd1,#fbc2eb)',
        'linear-gradient(135deg,#fccb90,#d57eeb)','linear-gradient(135deg,#e0c3fc,#8ec5fc)',
        'linear-gradient(135deg,#f5576c,#ff6a88)','linear-gradient(135deg,#2af598,#009efd)',
      ];
      const rg=()=>GRADS[Math.floor(Math.random()*GRADS.length)];
      const rh=()=>160+Math.floor(Math.random()*140);
      const rl=()=>Math.floor(Math.random()*2000)+10;
      const rc=()=>Math.floor(Math.random()*80);

      const NPC_NAMES = ['小魚','阿晴','番茄醬','深夜食堂老闆','隔壁的貓','豆腐腦愛好者','城市漫步者','拿鐵不加糖','凌晨三點','椰子水女孩','老王隔壁','退休少女','暴躁奶茶','月亮代表我','吃瓜群眾本瓜'];
      const NPC_GRADS = [
        'linear-gradient(135deg,#ff9a9e,#fad0c4)','linear-gradient(135deg,#a1c4fd,#c2e9fb)',
        'linear-gradient(135deg,#fbc2eb,#a6c1ee)','linear-gradient(135deg,#84fab0,#8fd3f4)',
        'linear-gradient(135deg,#fccb90,#d57eeb)','linear-gradient(135deg,#e0c3fc,#8ec5fc)',
      ];
      const rNpc=()=>NPC_NAMES[Math.floor(Math.random()*NPC_NAMES.length)];
      const rNpcG=()=>NPC_GRADS[Math.floor(Math.random()*NPC_GRADS.length)];

      // ── State ──
      const S = {
        view: 'discover', detail: null, showSettings: false, generating: false,
        feedPosts: [],   // 首頁：路人 NPC 貼文
        myPosts: [],     // 我的：char 自己的貼文
        savedIds: {},    // feedPost id → true（收藏）
        liked: {},
        cfg: { mode:'custom', endpoint:'', apiKey:'', model:'', charName:'', systemPrompt:'', genCount:5 },
        char: { name:'角色', uid:'16601803', bio:'', following:42, followers:1205, likes:'8.8w' },
        models:[], fetchingModels:false, modelFetchMsg:'', modelFetchErr:false,
        lastRawResponse:'', lastError:'',
        imported: null, importMsg:'', importErr:false,
        profileTab: 'works',
        rocheAPI: _rocheAPI,
        probeResults: null,  // API 探測結果
        probing: false,
        autoFetching: false,
      };

      // ── Storage ──
      try { const s=await roche.storage.get('xhs_config'); if(s) Object.assign(S.cfg,JSON.parse(s)); } catch(_){}
      try { const s=await roche.storage.get('xhs_feed'); if(s) S.feedPosts=JSON.parse(s); } catch(_){}
      try { const s=await roche.storage.get('xhs_mine'); if(s) S.myPosts=JSON.parse(s); } catch(_){}
      try { const s=await roche.storage.get('xhs_saved'); if(s) S.savedIds=JSON.parse(s); } catch(_){}
      try { const s=await roche.storage.get('xhs_imported'); if(s) S.imported=JSON.parse(s); } catch(_){}
      // migrate old posts if any
      try { const s=await roche.storage.get('xhs_posts'); if(s){const p=JSON.parse(s); if(p.length){S.myPosts=[...p,...S.myPosts]; await roche.storage.set('xhs_posts','');}} } catch(_){}

      const saveCfg=()=>roche.storage.set('xhs_config',JSON.stringify(S.cfg));
      const saveFeed=()=>roche.storage.set('xhs_feed',JSON.stringify(S.feedPosts));
      const saveMine=()=>roche.storage.set('xhs_mine',JSON.stringify(S.myPosts));
      const saveSaved=()=>roche.storage.set('xhs_saved',JSON.stringify(S.savedIds));
      const saveImported=()=>roche.storage.set('xhs_imported',JSON.stringify(S.imported));
      const charName=()=>S.cfg.charName||(S.imported&&S.imported.name)||S.char.name;

      // ── Style ──
      const style = document.createElement('style');
      style.textContent = `
        .xhs-root{width:100%;height:100%;position:relative;overflow:hidden;font-family:-apple-system,"PingFang SC","Helvetica Neue",sans-serif;background:#fff;display:flex;flex-direction:column;color:${T1}}
        .xhs-root *{box-sizing:border-box}
        .xhs-hdr{height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-bottom:1px solid ${BD};flex-shrink:0;background:#fff;z-index:20}
        .xhs-hdr-btn{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:none;border:none;border-radius:50%;cursor:pointer;color:${T1}}
        .xhs-hdr-title{color:${RED};font-weight:900;font-size:16px;letter-spacing:1px}
        .xhs-body{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
        .xhs-nav{display:flex;align-items:center;justify-content:space-around;padding:6px 0 max(env(safe-area-inset-bottom),8px);border-top:1px solid ${BD};flex-shrink:0;background:#fff;z-index:20}
        .xhs-nav-btn{display:flex;flex-direction:column;align-items:center;background:none;border:none;cursor:pointer;padding:4px 8px;gap:2px}
        .xhs-nav-btn span{font-size:10px}
        .xhs-nav-plus{width:42px;height:30px;border-radius:8px;background:${RED};border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(255,36,66,.3)}
        .xhs-search{padding:8px 12px;position:sticky;top:0;background:#fff;z-index:10}
        .xhs-search-inner{display:flex;align-items:center;gap:8px;background:#F5F5F5;border-radius:20px;padding:8px 14px}
        .xhs-search-inner span{font-size:13px;color:${T3}}
        .xhs-cats{display:flex;gap:14px;padding:4px 14px 10px;overflow-x:auto}
        .xhs-cats span{font-size:13px;color:${T3};white-space:nowrap;cursor:pointer;padding-bottom:4px}
        .xhs-cats span.active{font-weight:700;color:${T1};border-bottom:2px solid ${RED}}
        .xhs-waterfall{column-count:2;column-gap:8px;padding:0 8px}
        .xhs-card{break-inside:avoid;margin-bottom:8px;border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.06)}
        .xhs-card-cover{width:100%;display:flex;align-items:center;justify-content:center;position:relative}
        .xhs-card-cover .emoji{font-size:40px;opacity:.6}
        .xhs-card-body{padding:8px 10px}
        .xhs-card-title{font-size:13px;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .xhs-card-meta{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
        .xhs-card-author{display:flex;align-items:center;gap:4px}
        .xhs-card-author .av{width:16px;height:16px;border-radius:50%}
        .xhs-card-author span{font-size:10px;color:${T3}}
        .xhs-card-likes{display:flex;align-items:center;gap:3px;font-size:10px;color:${T3}}
        .xhs-empty{text-align:center;padding:70px 20px;color:${T3}}
        .xhs-empty .icon{font-size:44px;margin-bottom:12px}
        .xhs-empty p{font-size:14px;margin:0 0 16px}
        .xhs-btn{padding:10px 26px;border-radius:20px;background:${RED};color:#fff;border:none;font-weight:600;font-size:14px;cursor:pointer}
        .xhs-btn:disabled{opacity:.5}
        .xhs-btn-outline{padding:8px 22px;border-radius:16px;background:${RED_L};color:${RED};border:1px solid ${RED}30;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
        .xhs-profile-hdr{padding:16px 20px 0;display:flex;flex-direction:column;align-items:center;gap:6px}
        .xhs-avatar{width:68px;height:68px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:700}
        .xhs-profile-name{font-weight:800;font-size:17px}
        .xhs-profile-uid{font-size:10px;color:${T3};background:#F5F5F5;padding:2px 8px;border-radius:4px;font-family:monospace}
        .xhs-profile-stats{display:flex;gap:32px;margin:8px 0}
        .xhs-profile-stats div{text-align:center}
        .xhs-profile-stats .val{font-weight:700;font-size:16px}
        .xhs-profile-stats .lbl{font-size:10px;color:${T3};margin-top:2px}
        .xhs-profile-bio{font-size:13px;color:${T2};text-align:center;line-height:1.5;margin:4px 0 0;white-space:pre-wrap;max-width:280px}
        .xhs-profile-btns{display:flex;gap:8px;width:100%;padding:0 24px;margin-top:4px}
        .xhs-follow-btn{flex:1;padding:8px 0;border-radius:20px;background:${RED};color:#fff;border:none;font-weight:700;font-size:13px;cursor:pointer}
        .xhs-msg-btn{width:38px;height:34px;border-radius:20px;border:1px solid ${BD};background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px}
        .xhs-tabs{display:flex;border-bottom:1px solid ${BD};margin-top:10px;position:sticky;top:0;background:#fff;z-index:10}
        .xhs-tab{flex:1;text-align:center;padding:12px 0;font-size:14px;font-weight:600;cursor:pointer;position:relative;color:${T3}}
        .xhs-tab.active{color:${T1}}
        .xhs-tab.active::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:22px;height:2.5px;background:${RED};border-radius:2px}
        .xhs-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:2px}
        .xhs-grid-item{aspect-ratio:3/4;position:relative;cursor:pointer;overflow:hidden}
        .xhs-grid-item .emoji{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:32px;opacity:.5}
        .xhs-grid-item .overlay{position:absolute;bottom:0;left:0;right:0;padding:20px 8px 8px;background:linear-gradient(transparent,rgba(0,0,0,.5))}
        .xhs-grid-item .overlay span{font-size:11px;color:#fff;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .xhs-detail{position:absolute;inset:0;z-index:100;background:#fff;overflow-y:auto;display:flex;flex-direction:column}
        .xhs-detail-cover{width:100%;min-height:280px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .xhs-detail-cover .emoji{font-size:64px;opacity:.5}
        .xhs-detail-body{padding:16px 16px 100px}
        .xhs-detail-body h2{font-size:17px;font-weight:700;margin:0 0 10px;line-height:1.4}
        .xhs-detail-body .content{font-size:14px;color:${T2};line-height:1.7;white-space:pre-wrap}
        .xhs-detail-tags{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px}
        .xhs-detail-tags span{font-size:12px;color:#3478F6;background:#EEF4FF;padding:3px 8px;border-radius:4px}
        .xhs-detail-date{font-size:12px;color:${T3};margin-top:12px}
        .xhs-detail-actions{display:flex;gap:18px;margin-top:18px;padding-top:14px;border-top:1px solid ${BD}}
        .xhs-act-btn{display:flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;font-size:12px;color:${T3}}
        .xhs-settings-mask{position:absolute;inset:0;z-index:200;background:rgba(0,0,0,.45);display:flex;align-items:flex-end}
        .xhs-settings{width:100%;background:#fff;border-radius:16px 16px 0 0;padding:18px;max-height:80%;overflow-y:auto}
        .xhs-settings-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
        .xhs-settings-hdr span{font-weight:700;font-size:15px}
        .xhs-settings-hdr button{background:none;border:none;font-size:18px;color:${T3};cursor:pointer}
        .xhs-s-label{display:block;font-size:12px;font-weight:600;color:${T2};margin:10px 0 4px}
        .xhs-s-input{width:100%;padding:9px 12px;border-radius:10px;border:1px solid ${BD};font-size:13px;outline:none;background:#FAFAFA;font-family:inherit}
        .xhs-s-input:focus{border-color:${RED}60}
        .xhs-s-modes{display:flex;gap:8px;margin-bottom:10px}
        .xhs-s-mode{flex:1;padding:8px 0;border-radius:8px;border:1.5px solid ${BD};background:#fff;color:${T2};font-weight:600;font-size:12px;cursor:pointer;text-align:center}
        .xhs-s-mode.active{border-color:${RED};background:${RED_L};color:${RED}}
        .xhs-s-save{width:100%;padding:11px 0;border-radius:24px;background:${RED};color:#fff;border:none;font-weight:700;font-size:14px;margin-top:14px;cursor:pointer}
        .xhs-toast{position:absolute;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:300;pointer-events:none;animation:xhsFade .3s}
        @keyframes xhsFade{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `;
      container.appendChild(style);

      // ── Icons ──
      const icons = {
        back:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>`,
        settings:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T2}" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        refresh:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
        search:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        heart:(f,s=14)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f?RED:'none'}" stroke="${f?RED:T3}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        comment:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        star:(f)=>`<svg width="18" height="18" viewBox="0 0 24 24" fill="${f?'#FFD700':'none'}" stroke="${f?'#FFD700':T3}" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        share:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2" stroke-linecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
        home:(a)=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="${a?RED:'none'}" stroke="${a?RED:T3}" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22" stroke="${a?'#fff':T3}"/></svg>`,
        user:(a)=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${a?RED:T3}" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        plus:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        shop:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
        mail:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      };
      function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
      function toast(msg){const t=document.createElement('div');t.className='xhs-toast';t.textContent=msg;root.appendChild(t);setTimeout(()=>t.remove(),2500);}

      // ── Parse import files ──
      function parseImportFile(raw){
        const data=JSON.parse(raw);
        if(data.type==='roche_contact_card'&&data.contact){
          const c=data.contact;
          return{kind:'card',name:c.name||c.handle||'角色',handle:c.handle||'',persona:c.persona||'',bio:c.bio||''};
        }
        if(data.conversation&&data.messages){
          const conv=data.conversation;
          const core=(data.coreMemory&&data.coreMemory.summary)||'';
          const facts=(data.factMemories||[]).slice().sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,8).map(f=>f.summaryText||f.action||'').filter(Boolean);
          const recent=(data.messages||[]).slice(-60).filter(m=>!m.isMe&&m.text).slice(-20).map(m=>m.text);
          return{kind:'backup',name:conv.name||conv.handle||'角色',handle:conv.handle||'',coreSummary:core,factMemories:facts,recentMessages:recent};
        }
        throw new Error('無法辨識的檔案格式');
      }
      function mergeImported(prev,incoming){
        const base=(prev&&prev.name===incoming.name)?{...prev}:{name:incoming.name,handle:incoming.handle,persona:'',bio:'',coreSummary:'',factMemories:[],recentMessages:[]};
        if(incoming.kind==='card'){base.persona=incoming.persona||base.persona;base.bio=incoming.bio||base.bio;}
        else{base.coreSummary=incoming.coreSummary||base.coreSummary;if(incoming.factMemories&&incoming.factMemories.length)base.factMemories=incoming.factMemories;if(incoming.recentMessages&&incoming.recentMessages.length)base.recentMessages=incoming.recentMessages;}
        base.name=incoming.name||base.name;base.handle=incoming.handle||base.handle;base.importedAt=Date.now();
        return base;
      }

      // ── Build char context for prompts ──
      // 完整版（char 自己發文用）
      function buildCharContext(){
        const im=S.imported; if(!im) return '';
        let ctx='';
        if(im.persona) ctx+=`\n【角色人設】\n${im.persona}\n`;
        if(im.coreSummary) ctx+=`\n【角色近況摘要】\n${im.coreSummary}\n`;
        if(im.factMemories&&im.factMemories.length) ctx+=`\n【近期事件】\n${im.factMemories.map((f,i)=>`${i+1}. ${f}`).join('\n')}\n`;
        if(im.recentMessages&&im.recentMessages.length) ctx+=`\n【角色說話語氣（原話片段）】\n${im.recentMessages.slice(-10).map(t=>'- '+t).join('\n')}\n`;
        return ctx;
      }
      // 精簡版（NPC 推薦用，只需要知道角色興趣和近況就好，不需要完整人設）
      function buildCharContextLite(){
        const im=S.imported; if(!im) return '';
        let ctx='';
        // 只取 persona 前 600 字（性格和愛好部分），避免 prompt 太長
        if(im.persona) ctx+=`\n【角色個性與興趣摘要】\n${im.persona.slice(0,600)}\n`;
        if(im.coreSummary) ctx+=`\n【角色近況】\n${im.coreSummary.slice(0,400)}\n`;
        if(im.factMemories&&im.factMemories.length) ctx+=`\n【最近發生的事】\n${im.factMemories.slice(0,4).map((f,i)=>`${i+1}. ${f.slice(0,120)}`).join('\n')}\n`;
        return ctx;
      }

      // ── 探測 Roche API 回傳格式 ──
      async function probeRocheAPI(){
        S.probing=true; render();
        const results = {};
        const tryCall = async (label, fn) => {
          try { const r = await fn(); results[label] = JSON.stringify(r, null, 2).slice(0, 1500); }
          catch(e) { results[label] = '❌ ' + e.message; }
        };
        // character
        await tryCall('character.list()', () => roche.character.list());
        await tryCall('character.get()', () => roche.character.get());
        // conversation
        await tryCall('conversation.list()', () => roche.conversation.list());
        await tryCall('conversation.get()', () => roche.conversation.get());
        // memory - try without args first, then with conversation context
        await tryCall('memory.getShortTerm()', () => roche.memory.getShortTerm());
        await tryCall('memory.getLongTerm()', () => roche.memory.getLongTerm());
        // persona
        await tryCall('persona.getActiveUserPersona()', () => roche.persona.getActiveUserPersona());
        // ai.chat - just test with a tiny prompt
        await tryCall('ai.chat({...})', () => roche.ai.chat({ messages:[{role:'user',content:'說「測試成功」兩個字'}], max_tokens:20 }));
        S.probeResults = results;
        S.probing = false;
        console.log('[小紅書] API 探測結果：', results);
        render();
      }

      // ── 自動抓取角色資料 ──
      async function autoFetchCharData(){
        S.autoFetching=true; render();
        try {
          const imported = { importedAt: Date.now(), persona:'', bio:'', coreSummary:'', factMemories:[], recentMessages:[], name:'', handle:'' };
          let charData = null;

          // 1. 嘗試抓角色列表，找到當前角色
          try {
            const chars = await roche.character.list();
            if (chars && chars.length) {
              // 如果有指定角色名稱，找匹配的；否則用第一個
              const target = S.cfg.charName || '';
              charData = target ? chars.find(c => (c.name||c.handle||'') === target) || chars[0] : chars[0];
            }
          } catch(_){}

          // 2. 如果 list 拿到了角色，嘗試 get 取完整資料
          if (charData) {
            const charId = charData.id || charData.contactId || charData.handle;
            if (charId) {
              try {
                const full = await roche.character.get(charId);
                if (full) charData = full;
              } catch(_){}
            }
            imported.name = charData.name || charData.handle || '角色';
            imported.handle = charData.handle || charData.name || '';
            imported.persona = charData.persona || charData.description || charData.systemPrompt || '';
            imported.bio = charData.bio || charData.greeting || '';
          }

          // 3. 抓長期記憶
          try {
            const ltm = await roche.memory.getLongTerm();
            if (ltm) {
              // 可能是 { summary, factMemories } 或直接是陣列
              if (typeof ltm === 'string') {
                imported.coreSummary = ltm;
              } else if (ltm.summary) {
                imported.coreSummary = ltm.summary;
              }
              if (ltm.factMemories && Array.isArray(ltm.factMemories)) {
                imported.factMemories = ltm.factMemories.slice(0,8).map(f => f.summaryText || f.action || String(f)).filter(Boolean);
              } else if (Array.isArray(ltm)) {
                imported.factMemories = ltm.slice(0,8).map(f => typeof f === 'string' ? f : (f.summaryText || f.action || JSON.stringify(f).slice(0,120))).filter(Boolean);
              }
            }
          } catch(_){}

          // 4. 抓短期記憶（近期對話）
          try {
            const stm = await roche.memory.getShortTerm();
            if (stm && Array.isArray(stm)) {
              imported.recentMessages = stm
                .filter(m => !m.isMe && (m.text || m.content))
                .slice(-20)
                .map(m => m.text || m.content || '');
            } else if (typeof stm === 'string') {
              imported.coreSummary = imported.coreSummary || stm;
            }
          } catch(_){}

          // 5. 合併到 S.imported
          if (imported.name || imported.persona || imported.coreSummary || imported.factMemories.length) {
            S.imported = imported;
            await saveImported();
            if (!S.cfg.charName && imported.name) S.cfg.charName = imported.name;
            toast('✨ 自動抓取成功：' + (imported.name || '角色'));
            S.importMsg = `已自動抓取「${imported.name}」：角色卡 ${imported.persona?'✓':'✕'}　記憶 ${imported.factMemories.length}筆　語氣 ${imported.recentMessages.length}則`;
            S.importErr = false;
          } else {
            toast('⚠ 沒有抓到資料，請確認角色是否存在');
            S.importMsg = '自動抓取未取得資料，可能需要先開啟一個角色對話';
            S.importErr = true;
          }
        } catch(e) {
          toast('⚠ 抓取失敗：' + e.message);
          S.importMsg = '自動抓取失敗：' + e.message;
          S.importErr = true;
        }
        S.autoFetching = false;
        render();
      }

      // ── API ──
      async function callAPI(prompt, sysMsg){
        const msgs = [];
        if(sysMsg) msgs.push({role:'system',content:sysMsg});
        msgs.push({role:'user',content:prompt});
        if(S.cfg.mode==='roche'){
          // 使用 Roche 內建的 AI 呼叫，不需要自己填 API key
          try {
            const result = await roche.ai.chat({ messages: msgs, max_tokens: 8000 });
            // result 可能是字串、物件、或帶 content 的回應
            if (typeof result === 'string') return result;
            if (result && result.content) {
              if (Array.isArray(result.content)) return result.content.map(b=>b.text||'').join('');
              return String(result.content);
            }
            if (result && result.text) return result.text;
            if (result && result.choices) return result.choices[0]?.message?.content || '';
            return JSON.stringify(result);
          } catch(e) {
            throw new Error('roche.ai.chat() 失敗：' + e.message);
          }
        }
        const base=(S.cfg.endpoint||'').replace(/\/+$/,'');
        if(!base)throw new Error('尚未設定 Endpoint');
        const ep=base.endsWith('/chat/completions')?base:base+'/chat/completions';
        const h={'Content-Type':'application/json'};
        if(S.cfg.apiKey)h['Authorization']='Bearer '+S.cfg.apiKey;
        if(!S.cfg.model)throw new Error('尚未選擇 Model');
        const body={model:S.cfg.model,messages:msgs,max_tokens:8000};
        const res=await fetch(ep,{method:'POST',headers:h,body:JSON.stringify(body)});
        const data=await res.json().catch(()=>({}));
        if(!res.ok)throw new Error('API 錯誤 ('+res.status+')：'+(data.error?.message||data.message||JSON.stringify(data).slice(0,200)));
        return(data.choices?.[0]?.message?.content)||(data.content?.map(b=>b.text||'').join(''))||'';
      }
      async function fetchModels(){
        const ep=(S.cfg.endpoint||'').replace(/\/+$/,'');
        if(!ep){S.modelFetchMsg='請先填寫 Endpoint';S.modelFetchErr=true;render();return;}
        S.fetchingModels=true;S.modelFetchMsg='';render();
        try{
          const h={};if(S.cfg.apiKey)h['Authorization']='Bearer '+S.cfg.apiKey;
          const res=await fetch(ep+'/models',{headers:h});
          const data=await res.json().catch(()=>({}));
          if(!res.ok)throw new Error(data.error?.message||'HTTP '+res.status);
          const list=(data.data||data.models||[]).map(m=>m.id||m.name||m).filter(Boolean);
          if(!list.length)throw new Error('沒有找到模型');
          S.models=list;if(!S.cfg.model||!list.includes(S.cfg.model))S.cfg.model=list[0];
          S.modelFetchMsg='已取得 '+list.length+' 個模型';S.modelFetchErr=false;
        }catch(e){S.modelFetchMsg='拉取失敗：'+e.message;S.modelFetchErr=true;}
        finally{S.fetchingModels=false;render();}
      }

      // ── Parse JSON from AI response ──
      function parseJSON(raw){
        const cleaned=raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
        try{return JSON.parse(cleaned);}catch(_){}
        const m=cleaned.match(/\[[\s\S]*\]/);if(m)try{return JSON.parse(m[0]);}catch(_){}
        const m2=cleaned.match(/\{[\s\S]*\}/);if(m2)try{return JSON.parse(m2[0]);}catch(_){}
        return null;
      }

      // ══════════════════════════════════
      //  生成：首頁 NPC 貼文（char 會刷到的）
      // ══════════════════════════════════
      async function generateFeed(){
        if(S.generating)return;
        S.generating=true;S.lastError='';render();
        const name=charName();
        const count=parseInt(S.cfg.genCount)||5;
        const ctx=buildCharContextLite();

        const sysMsg=`你是一個小紅書貼文模擬器。你的任務是生成像真實小紅書用戶寫的貼文。
規則：
- 語氣必須像真正的小紅書網友：口語化、自嘲、吐槽、誇張但接地氣
- 善用流行語（姐妹們我真的會謝、救命、絕了、DNA動了、離大譜、笑不活了、家人們誰懂啊、不是哥們等）
- 標題用小紅書特色格式（震驚體、反問體、踩雷體）
- 正文短句、頻繁換行、emoji穿插但不過度、打字有隨意感（哈哈哈哈哈、？？？、嗚嗚嗚）
- 每篇由不同路人帳號發出，暱稱要有個性（像「加班到禿頭的打工人」「奶茶續命中」）
- 類型混搭：美食踩雷種草、社死現場、職場吐槽、搞笑日常、冷知識、租房裝修、健身掙扎、深夜emo帶自嘲、旅行探店、追劇遊戲、時事吐槽
- 只回覆 JSON 陣列，不要有任何其他文字或解釋
- 格式：[{"author":"暱稱","title":"標題","content":"正文","tags":["標籤"],"coverEmoji":"emoji","date":"時間"}]`;

        const prompt=`生成 ${count} 篇小紅書推薦頁貼文。${ctx?`\n以下是刷小紅書的這個人的資料，部分貼文要踩中TA的興趣：\n${ctx}`:''}`;
        try{
          const raw=await callAPI(prompt,sysMsg);S.lastRawResponse=raw;
          if(!raw||!raw.trim())throw new Error('API 回應是空的');
          let parsed=parseJSON(raw);
          if(!parsed)throw new Error('無法解析 JSON。回應前 120 字：「'+raw.slice(0,120)+'…」');
          if(!Array.isArray(parsed))parsed=[parsed];
          if(!parsed.length||!parsed[0]||!parsed[0].title)throw new Error('資料結構不對');
          const news=parsed.map((p,i)=>({...p,id:'feed_'+Date.now()+'_'+i,author:p.author||rNpc(),gradient:rg(),avatarGrad:rNpcG(),coverH:rh(),likes:rl(),comments:rc()}));
          S.feedPosts=[...news,...S.feedPosts];saveFeed();
          toast('✨ 刷到了 '+news.length+' 篇新內容');
        }catch(e){S.lastError=e.message;toast('⚠ 生成失敗');console.error('[小紅書]',e);}
        finally{S.generating=false;render();}
      }

      // ══════════════════════════════════
      //  生成：char 自己的貼文（我的主頁）
      // ══════════════════════════════════
      async function generateMyPosts(){
        if(S.generating)return;
        S.generating=true;S.lastError='';render();
        const name=charName();
        const count=Math.min(parseInt(S.cfg.genCount)||3,5);
        const ctx=buildCharContext();
        const prompt=`你是「${name}」。${S.cfg.systemPrompt?'\n角色設定：'+S.cfg.systemPrompt:''}
${ctx}
請以「${name}」的身份，生成 ${count} 篇TA自己會在小紅書上發的筆記。內容要符合角色的個性、近期經歷和說話語氣，像是這個人真的會發的東西——可以是近期經歷的側寫、心情碎念、生活分享、工作感悟，不需要直接複述事件，而是用角色的口吻自然帶出。

每篇要有：title、content（200-400字）、tags（3-5個）、coverEmoji、date

直接回覆 JSON 陣列，不要有任何其他文字。`;
        try{
          const raw=await callAPI(prompt);S.lastRawResponse=raw;
          if(!raw||!raw.trim())throw new Error('API 回應是空的');
          let parsed=parseJSON(raw);
          if(!parsed)throw new Error('無法解析 JSON。回應前 120 字：「'+raw.slice(0,120)+'…」');
          if(!Array.isArray(parsed))parsed=[parsed];
          if(!parsed.length||!parsed[0]||!parsed[0].title)throw new Error('資料結構不對');
          const news=parsed.map((p,i)=>({...p,id:'mine_'+Date.now()+'_'+i,author:name,gradient:rg(),avatarGrad:'linear-gradient(135deg,#667eea,#764ba2)',coverH:rh(),likes:rl(),comments:rc()}));
          S.myPosts=[...news,...S.myPosts];saveMine();
          toast('✨ 發布了 '+news.length+' 篇筆記');
        }catch(e){S.lastError=e.message;toast('⚠ 生成失敗');console.error('[小紅書]',e);}
        finally{S.generating=false;render();}
      }

      // ── Render ──
      const root=document.createElement('div');root.className='xhs-root';container.appendChild(root);
      function render(){
        let h='';
        h+=`<div class="xhs-hdr"><button class="xhs-hdr-btn" data-act="exit-app" title="退出">${icons.back}</button><span class="xhs-hdr-title">小紅書</span><div style="display:flex;gap:2px"><button class="xhs-hdr-btn" data-act="settings">${icons.settings}</button><button class="xhs-hdr-btn" data-act="gen-feed" ${S.generating?'disabled':''}>${S.generating?'⏳':icons.refresh}</button></div></div>`;
        h+=`<div class="xhs-body">${S.view==='discover'?renderDiscover():renderProfile()}</div>`;
        h+=`<div class="xhs-nav"><button class="xhs-nav-btn" data-act="nav-discover">${icons.home(S.view==='discover')}<span style="color:${S.view==='discover'?RED:T3}">首頁</span></button><button class="xhs-nav-btn">${icons.shop}<span>購物</span></button><button class="xhs-nav-plus" data-act="gen-feed" ${S.generating?'disabled':''}>${icons.plus}</button><button class="xhs-nav-btn">${icons.mail}<span>消息</span></button><button class="xhs-nav-btn" data-act="nav-profile">${icons.user(S.view==='profile')}<span style="color:${S.view==='profile'?RED:T3}">我</span></button></div>`;
        if(S.detail)h+=renderDetail(S.detail);
        if(S.showSettings)h+=renderSettings();
        root.innerHTML=h;
      }

      function renderPostCard(p,idx,src){
        return `<div class="xhs-card" data-act="open-post" data-src="${src}" data-idx="${idx}"><div class="xhs-card-cover" style="height:${p.coverH||180}px;background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}</div><div class="xhs-card-body"><div class="xhs-card-title">${esc(p.title)}</div><div class="xhs-card-meta"><div class="xhs-card-author"><div class="av" style="background:${p.avatarGrad||'#ddd'}"></div><span>${esc(p.author)}</span></div><div class="xhs-card-likes">${icons.heart(false,12)}<span>${p.likes}</span></div></div></div></div>`;
      }

      function renderDiscover(){
        let h=`<div class="xhs-search"><div class="xhs-search-inner">${icons.search}<span>搜尋小紅書</span></div></div>`;
        h+=`<div class="xhs-cats">${['推薦','穿搭','美食','旅行','日常','攝影'].map((t,i)=>`<span class="${i===0?'active':''}">${t}</span>`).join('')}</div>`;
        if(S.lastError)h+=`<div style="margin:8px 12px;padding:10px 12px;border-radius:10px;background:#FFF5F5;border:1px solid #FFDDDD;font-size:12px;color:#CC3333;line-height:1.5">⚠ ${esc(S.lastError)}</div>`;
        if(!S.imported&&!S.feedPosts.length)h+=`<div style="margin:0 12px 8px;padding:8px 12px;border-radius:8px;background:#FFF8E8;border:1px solid #F0E0B0;font-size:11px;color:#996600;line-height:1.4">💡 點左上齒輪匯入角色卡或聊天備份，推薦內容才會貼合角色喜好。</div>`;
        if(!S.feedPosts.length){
          h+=`<div class="xhs-empty"><div class="icon">🌿</div><p>TA 還沒刷小紅書呢</p><button class="xhs-btn" data-act="gen-feed" ${S.generating?'disabled':''}>${S.generating?'⏳ 生成中...':'✨ 刷一刷'}</button></div>`;
        }else{
          h+=`<div class="xhs-waterfall">${S.feedPosts.map((p,i)=>renderPostCard(p,i,'feed')).join('')}</div>`;
          h+=`<div style="text-align:center;padding:14px 0 6px"><button class="xhs-btn-outline" data-act="gen-feed" ${S.generating?'disabled':''}>${icons.refresh} ${S.generating?'生成中...':'刷更多'}</button></div>`;
        }
        return h;
      }

      function renderProfile(){
        const name=charName();
        const bioText=S.cfg.systemPrompt||(S.imported&&(S.imported.bio||S.imported.coreSummary))||S.char.bio||'';
        let h=`<div class="xhs-profile-hdr"><div class="xhs-avatar" style="background:linear-gradient(135deg,#667eea,#764ba2)">${name[0]||'?'}</div><div class="xhs-profile-name">${esc(name)}</div><span class="xhs-profile-uid">小紅書號：${S.char.uid}</span><div class="xhs-profile-stats"><div><div class="val">${S.char.following}</div><div class="lbl">關注</div></div><div><div class="val">${S.char.followers}</div><div class="lbl">粉絲</div></div><div><div class="val">${S.char.likes}</div><div class="lbl">獲讚與收藏</div></div></div><div class="xhs-profile-btns"><button class="xhs-follow-btn">關注</button><button class="xhs-msg-btn">💬</button></div>${bioText?`<p class="xhs-profile-bio">${esc(bioText.slice(0,90))}</p>`:''}</div>`;
        // Tabs: 筆記 | 收藏
        h+=`<div class="xhs-tabs"><div class="xhs-tab ${S.profileTab==='works'?'active':''}" data-act="profile-tab" data-tab="works">筆記</div><div class="xhs-tab ${S.profileTab==='saved'?'active':''}" data-act="profile-tab" data-tab="saved">收藏</div></div>`;
        if(S.profileTab==='works'){
          if(!S.myPosts.length){
            h+=`<div class="xhs-empty"><div class="icon">📝</div><p>TA 還沒發過筆記</p><button class="xhs-btn" data-act="gen-mine" ${S.generating?'disabled':''}>${S.generating?'生成中...':'✨ AI 生成筆記'}</button></div>`;
          }else{
            h+=`<div class="xhs-grid">${S.myPosts.map((p,i)=>`<div class="xhs-grid-item" data-act="open-post" data-src="mine" data-idx="${i}" style="background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}<div class="overlay"><span>${esc(p.title)}</span></div></div>`).join('')}</div>`;
            h+=`<div style="text-align:center;padding:14px 0 6px"><button class="xhs-btn-outline" data-act="gen-mine" ${S.generating?'disabled':''}>${icons.refresh} ${S.generating?'生成中...':'生成更多'}</button></div>`;
          }
        }else{
          // 收藏：從 feedPosts 裡找 savedIds 有標記的
          const saved=S.feedPosts.filter(p=>S.savedIds[p.id]);
          if(!saved.length){
            h+=`<div class="xhs-empty"><div class="icon">⭐</div><p>TA 還沒收藏任何貼文</p><div style="font-size:12px;color:${T3}">在首頁瀏覽貼文時點收藏就會出現在這裡</div></div>`;
          }else{
            h+=`<div class="xhs-grid">${saved.map((p,i)=>{const ri=S.feedPosts.indexOf(p);return`<div class="xhs-grid-item" data-act="open-post" data-src="feed" data-idx="${ri}" style="background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}<div class="overlay"><span>${esc(p.title)}</span></div></div>`;}).join('')}</div>`;
          }
        }
        return h;
      }

      function renderDetail(p){
        const isFeed=S.feedPosts.includes(p);
        const idx=isFeed?S.feedPosts.indexOf(p):S.myPosts.indexOf(p);
        const key=(isFeed?'f':'m')+'_'+idx;
        const liked=S.liked[key];
        const saved=isFeed&&S.savedIds[p.id];
        return `<div class="xhs-detail"><div class="xhs-hdr" style="border-bottom:1px solid ${BD}"><button class="xhs-hdr-btn" data-act="close-detail">${icons.back}</button><div style="display:flex;align-items:center;gap:6px"><div style="width:26px;height:26px;border-radius:50%;background:${p.avatarGrad||'#ddd'}"></div><span style="font-size:13px;font-weight:600">${esc(p.author)}</span></div><button style="background:${RED};color:#fff;border:none;border-radius:14px;padding:4px 14px;font-size:12px;font-weight:600;cursor:pointer">關注</button></div><div class="xhs-detail-cover" style="background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}</div><div class="xhs-detail-body"><h2>${esc(p.title)}</h2><div class="content">${esc(p.content)}</div>${p.tags&&p.tags.length?`<div class="xhs-detail-tags">${p.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}<div class="xhs-detail-date">${esc(p.date||'')}</div><div class="xhs-detail-actions"><button class="xhs-act-btn" data-act="like" data-key="${key}">${icons.heart(liked,18)}<span style="color:${liked?RED:T3}">${liked?p.likes+1:p.likes}</span></button><button class="xhs-act-btn">${icons.comment}<span>${p.comments||0}</span></button>${isFeed?`<button class="xhs-act-btn" data-act="save-post" data-id="${p.id}">${icons.star(saved)}<span style="color:${saved?'#FFD700':T3}">${saved?'已收藏':'收藏'}</span></button>`:''}<button class="xhs-act-btn">${icons.share}<span>分享</span></button></div></div></div>`;
      }

      function renderSettings(){
        const c=S.cfg;
        let h=`<div class="xhs-settings-mask"><div class="xhs-settings"><div class="xhs-settings-hdr"><span>設定</span><button data-act="close-settings">✕</button></div>`;
        // API
        h+=`<label class="xhs-s-label">API 來源</label><div class="xhs-s-modes"><button class="xhs-s-mode ${c.mode==='roche'?'active':''}" data-act="set-mode" data-mode="roche">Roche 內建</button><button class="xhs-s-mode ${c.mode==='custom'?'active':''}" data-act="set-mode" data-mode="custom">自訂 API</button></div>`;
        if(c.mode==='custom'){
          h+=`<label class="xhs-s-label">Endpoint</label><input class="xhs-s-input" data-field="endpoint" value="${esc(c.endpoint)}" placeholder="https://api.example.com/v1"><label class="xhs-s-label">API Key</label><input class="xhs-s-input" data-field="apiKey" value="${esc(c.apiKey)}" type="password" placeholder="sk-..."><label class="xhs-s-label">Model</label><div style="display:flex;gap:6px;align-items:center">${S.models.length?`<select class="xhs-s-input" data-field="model" style="flex:1">${S.models.map(m=>`<option value="${esc(m)}" ${m===c.model?'selected':''}>${esc(m)}</option>`).join('')}</select>`:`<input class="xhs-s-input" data-field="model" value="${esc(c.model)}" placeholder="先點拉取模型" style="flex:1">`}<button data-act="fetch-models" style="flex-shrink:0;padding:9px 12px;border-radius:10px;border:1px solid ${RED};background:${RED_L};color:${RED};font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap" ${S.fetchingModels?'disabled':''}>${S.fetchingModels?'⏳':'拉取模型'}</button></div>${S.modelFetchMsg?`<div style="font-size:11px;color:${S.modelFetchErr?RED:T2};margin-top:4px">${esc(S.modelFetchMsg)}</div>`:''}`;
        }
        // Gen count
        h+=`<label class="xhs-s-label">每次生成筆數</label><input class="xhs-s-input" data-field="genCount" value="${c.genCount||5}" type="number" min="1" max="10" placeholder="5" style="width:80px">`;
        // Char
        h+=`<label class="xhs-s-label">角色名稱</label><input class="xhs-s-input" data-field="charName" value="${esc(c.charName)}" placeholder="角色名"><label class="xhs-s-label">角色補充設定（選填）</label><textarea class="xhs-s-input" data-field="systemPrompt" rows="3" placeholder="額外的角色描述..." style="resize:vertical">${esc(c.systemPrompt)}</textarea>`;
        // Import
        h+=`<label class="xhs-s-label" style="margin-top:16px;padding-top:12px;border-top:1px solid ${BD}">匯入角色資料</label>`;
        if(S.imported){
          const d=new Date(S.imported.importedAt);const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          h+=`<div style="font-size:12px;color:${T2};background:#FAFAFA;border:1px solid ${BD};border-radius:10px;padding:9px 12px;margin-top:4px">已匯入：<strong>${esc(S.imported.name)}</strong>　角色卡 ${S.imported.persona?'✓':'✕'}　近況 ${S.imported.coreSummary?'✓':'✕'}　記憶 ${(S.imported.factMemories||[]).length}筆　語氣 ${(S.imported.recentMessages||[]).length}則<br><span style="color:${T3};font-size:11px">${ds}</span></div>`;
        }else{
          h+=`<div style="font-size:12px;color:${T3};margin-top:2px">可匯入角色卡和/或聊天備份，兩者自動合併。</div>`;
        }
        h+=`<div style="display:flex;gap:6px;margin-top:8px"><label style="flex:1;text-align:center;padding:9px 0;border-radius:10px;border:1px solid ${RED};background:${RED_L};color:${RED};font-size:12px;font-weight:600;cursor:pointer">📂 選擇 JSON<input type="file" accept=".json" data-act="import-file" style="display:none"></label>${S.imported?`<button data-act="clear-imported" style="flex-shrink:0;padding:9px 14px;border-radius:10px;border:1px solid ${BD};background:#fff;color:${T2};font-size:12px;cursor:pointer">清除</button>`:''}</div>`;
        if(S.importMsg)h+=`<div style="font-size:11px;color:${S.importErr?RED:'#2d8a5f'};margin-top:6px">${esc(S.importMsg)}</div>`;
        // Buttons
        h+=`<button class="xhs-s-save" data-act="save-settings">儲存設定</button>`;
        h+=`<button class="xhs-s-save" data-act="clear-all" style="background:#fff;color:${RED};border:1px solid ${RED};margin-top:8px">🗑️ 清除所有內容</button>`;
        // Roche API 結構顯示
        if(S.rocheAPI&&S.rocheAPI.length){
          h+=`<label class="xhs-s-label" style="margin-top:16px;padding-top:12px;border-top:1px solid ${BD}">🔍 Roche 插件 API</label>`;
          h+=`<div style="font-size:11px;font-family:monospace;color:${T2};background:#F5F5F5;border:1px solid ${BD};border-radius:10px;padding:10px;max-height:150px;overflow-y:auto;line-height:1.6;white-space:pre-wrap">${S.rocheAPI.map(l=>esc(l)).join('\n')}</div>`;
          h+=`<button data-act="probe-api" class="xhs-s-save" style="background:#333;margin-top:8px" ${S.probing?'disabled':''}>${S.probing?'⏳ 探測中...':'🧪 探測 API 回傳格式'}</button>`;
          h+=`<button data-act="auto-fetch" class="xhs-s-save" style="background:#2d8a5f;margin-top:8px" ${S.autoFetching?'disabled':''}>${S.autoFetching?'⏳ 抓取中...':'🚀 自動抓取角色資料'}</button>`;
        }
        if(S.probeResults){
          h+=`<label class="xhs-s-label">🧪 API 探測結果（貼給開發者）</label>`;
          const entries=Object.entries(S.probeResults);
          for(const [k,v] of entries){
            h+=`<div style="margin-top:6px"><strong style="font-size:11px;color:${T1}">${esc(k)}</strong><div style="font-size:10px;font-family:monospace;color:${T2};background:#F5F5F5;border:1px solid ${BD};border-radius:8px;padding:8px;max-height:120px;overflow-y:auto;white-space:pre-wrap;margin-top:2px">${esc(v)}</div></div>`;
          }
        }
        h+=`</div></div>`;
        return h;
      }

      // ── Events ──
      function handleClick(e){
        const btn=e.target.closest('[data-act]');if(!btn)return;
        const act=btn.dataset.act;
        if(act==='settings'){S.showSettings=true;render();}
        else if(act==='close-settings'){S.showSettings=false;render();}
        else if(act==='exit-app'){if(roche.ui&&roche.ui.closeApp)roche.ui.closeApp();}
        else if(act==='gen-feed'){generateFeed();}
        else if(act==='gen-mine'){generateMyPosts();}
        else if(act==='fetch-models'){
          root.querySelectorAll('.xhs-s-input[data-field]').forEach(el=>{S.cfg[el.dataset.field]=el.value;});
          fetchModels();
        }
        else if(act==='nav-discover'){S.view='discover';render();}
        else if(act==='nav-profile'){S.view='profile';render();}
        else if(act==='profile-tab'){S.profileTab=btn.dataset.tab;render();}
        else if(act==='open-post'){
          const src=btn.dataset.src,idx=parseInt(btn.dataset.idx);
          const list=src==='feed'?S.feedPosts:S.myPosts;
          if(!isNaN(idx)&&list[idx]){S.detail=list[idx];render();}
        }
        else if(act==='close-detail'){S.detail=null;render();}
        else if(act==='like'){const k=btn.dataset.key;S.liked[k]=!S.liked[k];render();}
        else if(act==='save-post'){
          const id=btn.dataset.id;
          S.savedIds[id]=!S.savedIds[id];if(!S.savedIds[id])delete S.savedIds[id];
          saveSaved();render();
          toast(S.savedIds[id]?'⭐ 已收藏':'取消收藏');
        }
        else if(act==='set-mode'){S.cfg.mode=btn.dataset.mode;render();}
        else if(act==='save-settings'){
          root.querySelectorAll('.xhs-s-input[data-field]').forEach(el=>{S.cfg[el.dataset.field]=el.value;});
          saveCfg();S.showSettings=false;toast('設定已儲存');render();
        }
        else if(act==='clear-all'){S.feedPosts=[];S.myPosts=[];S.savedIds={};S.liked={};saveFeed();saveMine();saveSaved();S.showSettings=false;toast('已清除所有內容');render();}
        else if(act==='clear-imported'){S.imported=null;saveImported();S.importMsg='已清除';S.importErr=false;render();}
        else if(act==='probe-api'){probeRocheAPI();}
        else if(act==='auto-fetch'){autoFetchCharData();}
      }
      function handleChange(e){
        const el=e.target;
        if(el.dataset.act==='import-file'){
          const file=el.files&&el.files[0];if(!file)return;
          const reader=new FileReader();
          reader.onload=async(ev)=>{
            try{
              const raw=ev.target.result.replace(/^\uFEFF/,''); // strip BOM
              const incoming=parseImportFile(raw);
              S.imported=mergeImported(S.imported,incoming);
              await saveImported();
              if(!S.cfg.charName)S.cfg.charName=S.imported.name;
              const kl=incoming.kind==='card'?'角色卡':'聊天備份';
              S.importMsg=`已匯入「${S.imported.name}」的${kl}`;S.importErr=false;
              toast('✨ 匯入成功');
            }catch(err){S.importMsg='匯入失敗：'+err.message;S.importErr=true;}
            render();
          };
          reader.onerror=()=>{S.importMsg='讀取失敗';S.importErr=true;render();};
          reader.readAsText(file);
        }
      }
      root.addEventListener('click',handleClick);
      root.addEventListener('change',handleChange);
      render();
      this._rootEl=root;this._styleEl=style;this._handler=handleClick;this._changeHandler=handleChange;
    },

    async unmount(container){
      if(this._rootEl){this._rootEl.removeEventListener('click',this._handler);this._rootEl.removeEventListener('change',this._changeHandler);this._rootEl.remove();}
      if(this._styleEl)this._styleEl.remove();
      container.replaceChildren();
    }
  };

  window.RochePlugin.register({
    id:'roche-xiaohongshu',name:'小紅書',version:'2.1.1',
    description:'偷看 TA 的小紅書',author:'予佟',
    apps:[xhsApp]
  });
})();
