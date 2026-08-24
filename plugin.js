/**
 * 小紅書 — Roche Plugin
 * 偷看 TA 的小紅書筆記
 */
(function () {
  'use strict';

  const xhsApp = {
    id: 'xiaohongshu-home',
    name: '小紅書',
    icon: 'auto_stories',
    iconImage: '',

    async mount(container, roche) {
      // ── 常量 ──
      const RED = '#FF2442';
      const RED_L = '#FFF0F0';
      const T1 = '#222';
      const T2 = '#666';
      const T3 = '#999';
      const BD = '#F0F0F0';

      const GRADS = [
        'linear-gradient(135deg,#667eea,#764ba2)',
        'linear-gradient(135deg,#f093fb,#f5576c)',
        'linear-gradient(135deg,#4facfe,#00f2fe)',
        'linear-gradient(135deg,#43e97b,#38f9d7)',
        'linear-gradient(135deg,#fa709a,#fee140)',
        'linear-gradient(135deg,#a18cd1,#fbc2eb)',
        'linear-gradient(135deg,#fccb90,#d57eeb)',
        'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
        'linear-gradient(135deg,#f5576c,#ff6a88)',
        'linear-gradient(135deg,#2af598,#009efd)',
      ];
      const rg = () => GRADS[Math.floor(Math.random() * GRADS.length)];
      const rh = () => 160 + Math.floor(Math.random() * 140);
      const rl = () => Math.floor(Math.random() * 2000) + 10;
      const rc = () => Math.floor(Math.random() * 80);

      // ── 狀態 ──
      const S = {
        view: 'discover',
        detail: null,
        showSettings: false,
        generating: false,
        posts: [],
        liked: {},
        cfg: { mode: 'custom', endpoint: '', apiKey: '', model: '', charName: '', systemPrompt: '' },
        char: { name: '角色', uid: '16601803', bio: '', following: 42, followers: 1205, likes: '8.8w' },
        models: [],
        fetchingModels: false,
        modelFetchMsg: '',
        modelFetchErr: false,
        lastRawResponse: '',
        imported: null,   // { name, handle, avatar, coreSummary, factMemories, recentMessages, importedAt }
        importMsg: '',
        importErr: false,
      };

      // ── roche.storage 讀取 ──
      try { const saved = await roche.storage.get('xhs_config'); if (saved) Object.assign(S.cfg, JSON.parse(saved)); } catch (_) {}
      try { const sp = await roche.storage.get('xhs_posts'); if (sp) S.posts = JSON.parse(sp); } catch (_) {}
      try { const im = await roche.storage.get('xhs_imported'); if (im) S.imported = JSON.parse(im); } catch (_) {}

      const saveCfg = () => roche.storage.set('xhs_config', JSON.stringify(S.cfg));
      const savePosts = () => roche.storage.set('xhs_posts', JSON.stringify(S.posts));
      const saveImported = () => roche.storage.set('xhs_imported', JSON.stringify(S.imported));
      const charName = () => S.cfg.charName || (S.imported && S.imported.name) || S.char.name;

      // ── 樣式 ──
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
        .xhs-card-cover .tag{position:absolute;top:6px;left:6px;background:rgba(0,0,0,.4);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px}
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

      // ── SVG 圖標 ──
      const icons = {
        back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>`,
        settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T2}" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
        refresh: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
        search: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        heart: (f, s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f ? RED : 'none'}" stroke="${f ? RED : T3}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        comment: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
        star: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
        share: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2" stroke-linecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`,
        home: (a) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="${a ? RED : 'none'}" stroke="${a ? RED : T3}" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22" stroke="${a ? '#fff' : T3}"/></svg>`,
        user: (a) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${a ? RED : T3}" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        plus: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        shop: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
        mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${T3}" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      };

      function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
      function toast(msg) { const t = document.createElement('div'); t.className='xhs-toast'; t.textContent=msg; root.appendChild(t); setTimeout(()=>t.remove(),2000); }

      // ── API ──
      async function callAPI(prompt) {
        // Roche 內建模式：走 Anthropic 原生格式
        if (S.cfg.mode === 'roche') {
          const headers = {'Content-Type':'application/json'};
          if (S.cfg.apiKey) headers['Authorization'] = 'Bearer '+S.cfg.apiKey;
          const body = {model:S.cfg.model||'claude-sonnet-4-6',max_tokens:2000,messages:[{role:'user',content:prompt}]};
          const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers,body:JSON.stringify(body)});
          const data = await res.json().catch(()=>({}));
          if (!res.ok) {
            const msg = data.error?.message || data.message || JSON.stringify(data).slice(0,200) || ('HTTP ' + res.status);
            throw new Error('API 錯誤 (' + res.status + ')：' + msg);
          }
          return (data.content?.map(b=>b.text||'').join(''))||'';
        }

        // 自訂 API 模式：走 OpenAI 相容格式（/chat/completions）
        const base = (S.cfg.endpoint || '').replace(/\/+$/, '');
        if (!base) throw new Error('尚未設定 Endpoint，請到設定裡填寫');
        const ep = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
        const headers = {'Content-Type':'application/json'};
        if (S.cfg.apiKey) headers['Authorization'] = 'Bearer '+S.cfg.apiKey;
        if (!S.cfg.model) throw new Error('尚未選擇 Model，請先在設定裡拉取模型或手動填寫');
        const body = {model:S.cfg.model,messages:[{role:'user',content:prompt}],max_tokens:2000};
        const res = await fetch(ep,{method:'POST',headers,body:JSON.stringify(body)});
        const data = await res.json().catch(()=>({}));
        if (!res.ok) {
          const msg = data.error?.message || data.message || JSON.stringify(data).slice(0,200) || ('HTTP ' + res.status);
          throw new Error('API 錯誤 (' + res.status + ')：' + msg);
        }
        return (data.choices?.[0]?.message?.content)||(data.content?.map(b=>b.text||'').join(''))||'';
      }

      async function generatePosts() {
        if (S.generating) return;
        S.generating = true; render();
        const name = charName();
        const im = S.imported;

        let context = '';
        if (im) {
          if (im.persona) context += `\n【角色人設（最高優先，含外貌、性格、說話風格與行為限制）】\n${im.persona}\n`;
          if (im.coreSummary) context += `\n【角色關係與近況摘要】\n${im.coreSummary}\n`;
          if (im.factMemories && im.factMemories.length) {
            context += `\n【近期發生的事（由近到遠）】\n${im.factMemories.map((f,i)=>`${i+1}. ${f}`).join('\n')}\n`;
          }
          if (im.recentMessages && im.recentMessages.length) {
            context += `\n【角色說話語氣參考（近期原話片段）】\n${im.recentMessages.slice(-12).map(t=>'- '+t).join('\n')}\n`;
          }
        }

        const prompt = `你是「${name}」，一個在小紅書上發布內容的角色。${S.cfg.systemPrompt?'\n角色設定：'+S.cfg.systemPrompt:''}
${context}
請以這個角色的身份，生成 3 篇小紅書風格的筆記，內容要符合上面提供的個性、近期經歷和語氣（如果有的話），像是這個角色真的會在自己小紅書上發的東西——可以是近期經歷的側寫、心情碎念、生活分享，不需要直接複述事件，而是用角色的口吻自然帶出。每篇筆記要有：
- title: 標題（吸引人的小紅書標題風格，可以用emoji）
- content: 正文內容（200-400字，小紅書風格，分段、有emoji）
- tags: 標籤陣列（3-5個）
- coverEmoji: 一個代表這篇筆記的 emoji
- date: 發布日期（最近一個月內，如「3天前」「1週前」）

直接回覆 JSON 陣列，不要有任何其他文字或markdown符號。`;
        try {
          const raw = await callAPI(prompt);
          S.lastRawResponse = raw; // 保留原始回應方便除錯
          if (!raw || !raw.trim()) {
            throw new Error('API 回應是空的，請檢查 Endpoint / API Key / Model 是否正確');
          }
          let parsed;
          try {
            const cleaned = raw.replace(/```json\n?|```\n?/g,'').trim();
            parsed = JSON.parse(cleaned);
          } catch (parseErr) {
            // 解析失敗時明確告知，不再靜默用假資料頂替
            console.error('[小紅書] JSON 解析失敗，原始回應：', raw);
            throw new Error('AI 回應的格式不是預期的 JSON，可能是 model 不支援或回應被截斷。原始回應前 100 字：「' + raw.slice(0,100) + '」');
          }
          if (!Array.isArray(parsed)) parsed = [parsed];
          if (!parsed.length || !parsed[0] || !parsed[0].title) {
            throw new Error('AI 回應的資料結構不對，缺少 title 欄位');
          }
          const news = parsed.map(p=>({...p,author:name,gradient:rg(),avatarGrad:'linear-gradient(135deg,#667eea,#764ba2)',coverH:rh(),likes:rl(),comments:rc()}));
          S.posts = [...news,...S.posts]; savePosts();
          toast('✨ 生成了 '+news.length+' 篇筆記');
        } catch(e) {
          toast('生成失敗：'+e.message);
          console.error('[小紅書] 生成失敗：', e);
        }
        finally { S.generating=false; render(); }
      }

      // ── 解析 Roche 匯出檔（自動判斷：角色卡 or 聊天備份）──
      function parseImportFile(raw) {
        const data = JSON.parse(raw);

        // 角色卡格式：{ type: 'roche_contact_card', contact: {...} }
        if (data.type === 'roche_contact_card' && data.contact) {
          const c = data.contact;
          return {
            kind: 'card',
            name: c.name || c.handle || '角色',
            handle: c.handle || c.name || '',
            persona: c.persona || '',
            bio: c.bio || '',
          };
        }

        // 聊天備份格式：{ conversation, messages, coreMemory, factMemories }
        if (data.conversation && data.messages) {
          const conv = data.conversation;
          const core = (data.coreMemory && data.coreMemory.summary) || '';
          const facts = (data.factMemories || [])
            .slice()
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            .slice(0, 8)
            .map(f => f.summaryText || f.action || '')
            .filter(Boolean);
          const recent = (data.messages || [])
            .slice(-60)
            .filter(m => !m.isMe && m.text)
            .slice(-20)
            .map(m => m.text);
          return {
            kind: 'backup',
            name: conv.name || conv.handle || '角色',
            handle: conv.handle || conv.name || '',
            coreSummary: core,
            factMemories: facts,
            recentMessages: recent,
          };
        }

        throw new Error('無法辨識的檔案格式（需要角色卡或聊天備份 JSON）');
      }

      // 合併角色卡 + 聊天備份 為單一 imported 物件；同名角色的資料互補疊加，不同名則以最新匯入為準
      function mergeImported(prev, incoming) {
        const base = (prev && prev.name === incoming.name) ? { ...prev } : {
          name: incoming.name, handle: incoming.handle,
          persona: '', bio: '', coreSummary: '', factMemories: [], recentMessages: [],
        };
        if (incoming.kind === 'card') {
          base.persona = incoming.persona || base.persona;
          base.bio = incoming.bio || base.bio;
        } else {
          base.coreSummary = incoming.coreSummary || base.coreSummary;
          if (incoming.factMemories && incoming.factMemories.length) base.factMemories = incoming.factMemories;
          if (incoming.recentMessages && incoming.recentMessages.length) base.recentMessages = incoming.recentMessages;
        }
        base.name = incoming.name || base.name;
        base.handle = incoming.handle || base.handle;
        base.importedAt = Date.now();
        return base;
      }

      // ── 拉取模型清單 ──
      async function fetchModels() {
        const ep = (S.cfg.endpoint || '').replace(/\/+$/, '');
        if (!ep) { S.modelFetchMsg = '請先填寫 Endpoint'; S.modelFetchErr = true; render(); return; }
        S.fetchingModels = true; S.modelFetchMsg = ''; render();
        try {
          const headers = {};
          if (S.cfg.apiKey) headers['Authorization'] = 'Bearer ' + S.cfg.apiKey;
          const res = await fetch(ep + '/models', { headers });
          const data = await res.json().catch(()=>({}));
          if (!res.ok) {
            const msg = data.error?.message || data.message || ('HTTP ' + res.status);
            throw new Error(msg);
          }
          const list = (data.data || data.models || []).map(m => m.id || m.name || m).filter(Boolean);
          if (!list.length) throw new Error('沒有找到可用模型');
          S.models = list;
          if (!S.cfg.model || !list.includes(S.cfg.model)) S.cfg.model = list[0];
          S.modelFetchMsg = `已取得 ${list.length} 個模型`;
          S.modelFetchErr = false;
        } catch (e) {
          S.modelFetchMsg = '拉取失敗：' + e.message;
          S.modelFetchErr = true;
        } finally {
          S.fetchingModels = false;
          render();
        }
      }

      // ── 渲染 ──
      const root = document.createElement('div'); root.className='xhs-root'; container.appendChild(root);

      function render() {
        let h = '';
        h += `<div class="xhs-hdr"><button class="xhs-hdr-btn" data-act="exit-app" title="退出">${icons.back}</button><span class="xhs-hdr-title">小紅書</span><div style="display:flex;gap:2px"><button class="xhs-hdr-btn" data-act="settings">${icons.settings}</button><button class="xhs-hdr-btn" data-act="generate" ${S.generating?'disabled':''}>${S.generating?'⏳':icons.refresh}</button></div></div>`;
        h += `<div class="xhs-body">${S.view==='discover'?renderDiscover():renderProfile()}</div>`;
        h += `<div class="xhs-nav"><button class="xhs-nav-btn" data-act="nav-discover">${icons.home(S.view==='discover')}<span style="color:${S.view==='discover'?RED:T3}">首頁</span></button><button class="xhs-nav-btn">${icons.shop}<span>購物</span></button><button class="xhs-nav-plus" data-act="generate" ${S.generating?'disabled':''}>${icons.plus}</button><button class="xhs-nav-btn">${icons.mail}<span>消息</span></button><button class="xhs-nav-btn" data-act="nav-profile">${icons.user(S.view==='profile')}<span style="color:${S.view==='profile'?RED:T3}">我</span></button></div>`;
        if (S.detail) h += renderDetail(S.detail);
        if (S.showSettings) h += renderSettings();
        root.innerHTML = h;
      }

      function renderDiscover() {
        let h = `<div class="xhs-search"><div class="xhs-search-inner">${icons.search}<span>搜尋小紅書</span></div></div>`;
        h += `<div class="xhs-cats">${['推薦','穿搭','美食','旅行','日常','攝影'].map((t,i)=>`<span class="${i===0?'active':''}">${t}</span>`).join('')}</div>`;
        if (!S.posts.length) {
          h += `<div class="xhs-empty"><div class="icon">🌿</div><p>還沒有內容，讓 AI 幫角色生成一些吧</p><button class="xhs-btn" data-act="generate" ${S.generating?'disabled':''}>${S.generating?'⏳ 生成中...':'✨ 生成筆記'}</button></div>`;
        } else {
          h += `<div class="xhs-waterfall">${S.posts.map((p,i)=>`<div class="xhs-card" data-act="open-post" data-idx="${i}"><div class="xhs-card-cover" style="height:${p.coverH||180}px;background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}</div><div class="xhs-card-body"><div class="xhs-card-title">${esc(p.title)}</div><div class="xhs-card-meta"><div class="xhs-card-author"><div class="av" style="background:${p.avatarGrad||'#ddd'}"></div><span>${esc(p.author)}</span></div><div class="xhs-card-likes">${icons.heart(false,12)}<span>${p.likes}</span></div></div></div></div>`).join('')}</div>`;
          h += `<div style="text-align:center;padding:14px 0 6px"><button class="xhs-btn-outline" data-act="generate" ${S.generating?'disabled':''}>${icons.refresh} ${S.generating?'生成中...':'生成更多'}</button></div>`;
        }
        return h;
      }

      function renderProfile() {
        const name = charName(), my = S.posts.filter(p=>p.author===name);
        const bioText = S.cfg.systemPrompt || (S.imported && (S.imported.bio || S.imported.persona || S.imported.coreSummary)) || S.char.bio || 'The silence is loud.';
        let h = `<div class="xhs-profile-hdr"><div class="xhs-avatar" style="background:linear-gradient(135deg,#667eea,#764ba2)">${name[0]||'?'}</div><div class="xhs-profile-name">${esc(name)}</div><span class="xhs-profile-uid">小紅書號：${S.char.uid}</span><div class="xhs-profile-stats"><div><div class="val">${S.char.following}</div><div class="lbl">關注</div></div><div><div class="val">${S.char.followers}</div><div class="lbl">粉絲</div></div><div><div class="val">${S.char.likes}</div><div class="lbl">獲讚與收藏</div></div></div><div class="xhs-profile-btns"><button class="xhs-follow-btn">關注</button><button class="xhs-msg-btn">💬</button></div><p class="xhs-profile-bio">${esc(bioText.slice(0,90))}</p></div>`;
        h += `<div class="xhs-tabs"><div class="xhs-tab active">筆記</div><div class="xhs-tab">讚過</div></div>`;
        if (!my.length) {
          h += `<div class="xhs-empty"><div class="icon">📝</div><p>還沒有筆記</p><button class="xhs-btn" data-act="generate" ${S.generating?'disabled':''}>${S.generating?'生成中...':'✨ AI 生成筆記'}</button></div>`;
        } else {
          h += `<div class="xhs-grid">${my.map(p=>{const ri=S.posts.indexOf(p);return`<div class="xhs-grid-item" data-act="open-post" data-idx="${ri}" style="background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}<div class="overlay"><span>${esc(p.title)}</span></div></div>`;}).join('')}</div>`;
        }
        return h;
      }

      function renderDetail(p) {
        const idx=S.posts.indexOf(p), liked=S.liked[idx];
        return `<div class="xhs-detail"><div class="xhs-hdr" style="border-bottom:1px solid ${BD}"><button class="xhs-hdr-btn" data-act="close-detail">${icons.back}</button><div style="display:flex;align-items:center;gap:6px"><div style="width:26px;height:26px;border-radius:50%;background:${p.avatarGrad||'#ddd'}"></div><span style="font-size:13px;font-weight:600">${esc(p.author)}</span></div><button style="background:${RED};color:#fff;border:none;border-radius:14px;padding:4px 14px;font-size:12px;font-weight:600;cursor:pointer">關注</button></div><div class="xhs-detail-cover" style="background:${p.gradient}">${p.coverEmoji?`<span class="emoji">${p.coverEmoji}</span>`:''}</div><div class="xhs-detail-body"><h2>${esc(p.title)}</h2><div class="content">${esc(p.content)}</div>${p.tags&&p.tags.length?`<div class="xhs-detail-tags">${p.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div>`:''}<div class="xhs-detail-date">${esc(p.date||'')}</div><div class="xhs-detail-actions"><button class="xhs-act-btn" data-act="like" data-idx="${idx}">${icons.heart(liked,18)}<span style="color:${liked?RED:T3}">${liked?p.likes+1:p.likes}</span></button><button class="xhs-act-btn">${icons.comment}<span>${p.comments||0}</span></button><button class="xhs-act-btn">${icons.star}<span>收藏</span></button><button class="xhs-act-btn">${icons.share}<span>分享</span></button></div></div></div>`;
      }

      function renderSettings() {
        const c = S.cfg;
        let h = `<div class="xhs-settings-mask"><div class="xhs-settings"><div class="xhs-settings-hdr"><span>API 設定</span><button data-act="close-settings">✕</button></div>`;
        h += `<label class="xhs-s-label">API 來源</label><div class="xhs-s-modes"><button class="xhs-s-mode ${c.mode==='roche'?'active':''}" data-act="set-mode" data-mode="roche">Roche 內建</button><button class="xhs-s-mode ${c.mode==='custom'?'active':''}" data-act="set-mode" data-mode="custom">自訂 API</button></div>`;
        if (c.mode==='custom') {
          h += `<label class="xhs-s-label">Endpoint</label><input class="xhs-s-input" data-field="endpoint" value="${esc(c.endpoint)}" placeholder="https://api.example.com/v1（不含 /chat/completions）"><label class="xhs-s-label">API Key</label><input class="xhs-s-input" data-field="apiKey" value="${esc(c.apiKey)}" type="password" placeholder="sk-..."><label class="xhs-s-label">Model</label><div style="display:flex;gap:6px;align-items:center">${S.models.length?`<select class="xhs-s-input" data-field="model" style="flex:1">${S.models.map(m=>`<option value="${esc(m)}" ${m===c.model?'selected':''}>${esc(m)}</option>`).join('')}</select>`:`<input class="xhs-s-input" data-field="model" value="${esc(c.model)}" placeholder="先點右側拉取模型" style="flex:1">`}<button data-act="fetch-models" style="flex-shrink:0;padding:9px 12px;border-radius:10px;border:1px solid ${RED};background:${RED_L};color:${RED};font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap" ${S.fetchingModels?'disabled':''}>${S.fetchingModels?'⏳':'拉取模型'}</button></div>${S.modelFetchMsg?`<div style="font-size:11px;color:${S.modelFetchErr?RED:T2};margin-top:4px">${esc(S.modelFetchMsg)}</div>`:''}`;
        }
        h += `<label class="xhs-s-label">角色名稱</label><input class="xhs-s-input" data-field="charName" value="${esc(c.charName)}" placeholder="角色名"><label class="xhs-s-label">角色設定 / System Prompt（選填）</label><textarea class="xhs-s-input" data-field="systemPrompt" rows="4" placeholder="描述角色的人設、語氣、興趣等..." style="resize:vertical">${esc(c.systemPrompt)}</textarea>`;

        // ── 匯入角色資料（備份 JSON）──
        h += `<label class="xhs-s-label" style="margin-top:16px;padding-top:12px;border-top:1px solid ${BD}">匯入角色資料（Roche 備份 JSON）</label>`;
        if (S.imported) {
          const d = new Date(S.imported.importedAt);
          const dstr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
          h += `<div style="font-size:12px;color:${T2};background:#FAFAFA;border:1px solid ${BD};border-radius:10px;padding:9px 12px;margin-top:4px">
            已匯入：<strong>${esc(S.imported.name)}</strong>　·　角色卡 ${S.imported.persona ? '✓' : '✕'}　·　近況摘要 ${S.imported.coreSummary ? '✓' : '✕'}　·　近期記憶 ${(S.imported.factMemories||[]).length} 筆　·　語氣樣本 ${(S.imported.recentMessages||[]).length} 則<br>
            <span style="color:${T3};font-size:11px">匯入時間：${dstr}</span>
          </div>`;
        } else {
          h += `<div style="font-size:12px;color:${T3};margin-top:2px">尚未匯入。可匯入角色卡（含完整人設）和/或聊天備份（含近期記憶與語氣），兩者可分開匯入、自動合併。</div>`;
        }
        h += `<div style="display:flex;gap:6px;margin-top:8px">
          <label style="flex:1;text-align:center;padding:9px 0;border-radius:10px;border:1px solid ${RED};background:${RED_L};color:${RED};font-size:12px;font-weight:600;cursor:pointer">
            📂 選擇備份 JSON
            <input type="file" accept=".json,application/json" data-act="import-file" style="display:none">
          </label>
          ${S.imported ? `<button data-act="clear-imported" style="flex-shrink:0;padding:9px 14px;border-radius:10px;border:1px solid ${BD};background:#fff;color:${T2};font-size:12px;cursor:pointer">清除</button>` : ''}
        </div>`;
        if (S.importMsg) h += `<div style="font-size:11px;color:${S.importErr?RED:'#2d8a5f'};margin-top:6px">${esc(S.importMsg)}</div>`;
        h += `<div style="font-size:10.5px;color:${T3};margin-top:6px;line-height:1.5">角色卡：Roche → 該角色資料卡 → 匯出角色卡。聊天備份：該角色聊天設定 → 匯出備份。兩種檔案都只存在你自己裝置上（透過 roche.storage），不會上傳到任何地方。</div>`;

        h += `<button class="xhs-s-save" data-act="save-settings">儲存設定</button><button class="xhs-s-save" data-act="clear-posts" style="background:#fff;color:${RED};border:1px solid ${RED};margin-top:8px">🗑️ 清除所有筆記</button></div></div>`;
        return h;
      }

      // ── 事件委派 ──
      function handleClick(e) {
        const btn = e.target.closest('[data-act]'); if (!btn) return;
        const act = btn.dataset.act;
        if (act==='settings') { S.showSettings=true; render(); }
        else if (act==='close-settings') { S.showSettings=false; render(); }
        else if (act==='exit-app') { if (roche.ui && roche.ui.closeApp) roche.ui.closeApp(); }
        else if (act==='generate') { generatePosts(); }
        else if (act==='fetch-models') {
          // 先把畫面上還沒儲存的 endpoint / apiKey 同步進 S.cfg，這樣拉取才會用到使用者剛輸入的值
          root.querySelectorAll('.xhs-s-input[data-field]').forEach(el=>{ S.cfg[el.dataset.field]=el.value; });
          fetchModels();
        }
        else if (act==='nav-discover') { S.view='discover'; render(); }
        else if (act==='nav-profile') { S.view='profile'; render(); }
        else if (act==='open-post') { const idx=parseInt(btn.dataset.idx); if (!isNaN(idx)&&S.posts[idx]) { S.detail=S.posts[idx]; render(); } }
        else if (act==='close-detail') { S.detail=null; render(); }
        else if (act==='like') { const idx=parseInt(btn.dataset.idx); S.liked[idx]=!S.liked[idx]; render(); }
        else if (act==='set-mode') { S.cfg.mode=btn.dataset.mode; render(); }
        else if (act==='save-settings') {
          root.querySelectorAll('.xhs-s-input[data-field]').forEach(el=>{ S.cfg[el.dataset.field]=el.value; });
          saveCfg(); S.showSettings=false; toast('設定已儲存'); render();
        }
        else if (act==='clear-posts') { S.posts=[]; S.liked={}; savePosts(); S.showSettings=false; toast('已清除所有筆記'); render(); }
        else if (act==='clear-imported') { S.imported=null; saveImported(); S.importMsg='已清除匯入的角色資料'; S.importErr=false; render(); }
      }

      function handleChange(e) {
        const el = e.target;
        if (el.dataset.act === 'import-file') {
          const file = el.files && el.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const incoming = parseImportFile(ev.target.result);
              S.imported = mergeImported(S.imported, incoming);
              await saveImported();
              // 如果角色名稱欄位是空的，順便帶入
              if (!S.cfg.charName) S.cfg.charName = S.imported.name;
              const kindLabel = incoming.kind === 'card' ? '角色卡' : '聊天備份';
              S.importMsg = `已匯入「${S.imported.name}」的${kindLabel}資料`;
              S.importErr = false;
              toast('✨ 角色資料匯入成功');
            } catch (err) {
              S.importMsg = '匯入失敗：' + err.message;
              S.importErr = true;
            }
            render();
          };
          reader.onerror = () => { S.importMsg = '讀取檔案失敗'; S.importErr = true; render(); };
          reader.readAsText(file);
        }
      }

      root.addEventListener('click', handleClick);
      root.addEventListener('change', handleChange);
      render();

      // 儲存清理
      this._rootEl = root;
      this._styleEl = style;
      this._handler = handleClick;
      this._changeHandler = handleChange;
    },

    async unmount(container) {
      if (this._rootEl) {
        this._rootEl.removeEventListener('click', this._handler);
        this._rootEl.removeEventListener('change', this._changeHandler);
        this._rootEl.remove();
      }
      if (this._styleEl) this._styleEl.remove();
      container.replaceChildren();
    }
  };

  // ── 註冊插件（正確結構：apps 陣列）──
  window.RochePlugin.register({
    id: 'roche-xiaohongshu',
    name: '小紅書',
    version: '2.0.2',
    description: '偷看 TA 的小紅書',
    author: '予佟',
    apps: [xhsApp]
  });
})();
