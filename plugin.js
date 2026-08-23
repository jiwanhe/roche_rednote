/**
 * 小紅書 — Roche Plugin
 * 偷看 TA 的小紅書筆記
 *
 * mount / unmount 生命週期
 * roche.storage 持久化 API 設定
 * 事件委派（event delegation）
 */
window.RochePlugin.register({
  /* ══════════════════════════════════════════════
     MOUNT
     ══════════════════════════════════════════════ */
  async mount(container, roche) {
    // ── 常量 ──
    const RED = '#FF2442';
    const RED_L = '#FFF0F0';
    const BG = '#FAFAFA';
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
      view: 'discover',   // discover | profile
      detail: null,        // 貼文詳情物件
      showSettings: false,
      generating: false,
      posts: [],
      liked: {},           // { idx: true }
      cfg: {
        mode: 'custom',
        endpoint: '',
        apiKey: '',
        model: '',
        charName: '',
        systemPrompt: '',
      },
      char: {
        name: '角色',
        uid: '16601803',
        bio: '',
        following: 42,
        followers: 1205,
        likes: '8.8w',
      },
    };

    // ── 從 roche.storage 讀取 ──
    try {
      const saved = await roche.storage.get('xhs_config');
      if (saved) Object.assign(S.cfg, JSON.parse(saved));
    } catch (_) {}
    try {
      const sp = await roche.storage.get('xhs_posts');
      if (sp) S.posts = JSON.parse(sp);
    } catch (_) {}

    // ── 工具函式 ──
    const saveCfg = () => roche.storage.set('xhs_config', JSON.stringify(S.cfg));
    const savePosts = () => roche.storage.set('xhs_posts', JSON.stringify(S.posts));
    const charName = () => S.cfg.charName || S.char.name;

    // ── 樣式注入 ──
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

      /* 搜尋列 */
      .xhs-search{padding:8px 12px;position:sticky;top:0;background:#fff;z-index:10}
      .xhs-search-inner{display:flex;align-items:center;gap:8px;background:#F5F5F5;border-radius:20px;padding:8px 14px}
      .xhs-search-inner span{font-size:13px;color:${T3}}

      /* 分類 */
      .xhs-cats{display:flex;gap:14px;padding:4px 14px 10px;overflow-x:auto}
      .xhs-cats span{font-size:13px;color:${T3};white-space:nowrap;cursor:pointer;padding-bottom:4px}
      .xhs-cats span.active{font-weight:700;color:${T1};border-bottom:2px solid ${RED}}

      /* 瀑布流 */
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

      /* 空狀態 */
      .xhs-empty{text-align:center;padding:70px 20px;color:${T3}}
      .xhs-empty .icon{font-size:44px;margin-bottom:12px}
      .xhs-empty p{font-size:14px;margin:0 0 16px}
      .xhs-btn{padding:10px 26px;border-radius:20px;background:${RED};color:#fff;border:none;font-weight:600;font-size:14px;cursor:pointer}
      .xhs-btn:disabled{opacity:.5}
      .xhs-btn-outline{padding:8px 22px;border-radius:16px;background:${RED_L};color:${RED};border:1px solid ${RED}30;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}

      /* 個人主頁 */
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

      /* Tabs */
      .xhs-tabs{display:flex;border-bottom:1px solid ${BD};margin-top:10px;position:sticky;top:0;background:#fff;z-index:10}
      .xhs-tab{flex:1;text-align:center;padding:12px 0;font-size:14px;font-weight:600;cursor:pointer;position:relative;color:${T3}}
      .xhs-tab.active{color:${T1}}
      .xhs-tab.active::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:22px;height:2.5px;background:${RED};border-radius:2px}

      /* 九宮格 */
      .xhs-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:2px}
      .xhs-grid-item{aspect-ratio:3/4;position:relative;cursor:pointer;overflow:hidden}
      .xhs-grid-item .emoji{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:32px;opacity:.5}
      .xhs-grid-item .overlay{position:absolute;bottom:0;left:0;right:0;padding:20px 8px 8px;background:linear-gradient(transparent,rgba(0,0,0,.5))}
      .xhs-grid-item .overlay span{font-size:11px;color:#fff;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

      /* 詳情頁 */
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

      /* 設定面板 */
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

      /* toast */
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

    // ── Toast ──
    function toast(msg) {
      const t = document.createElement('div');
      t.className = 'xhs-toast';
      t.textContent = msg;
      root.appendChild(t);
      setTimeout(() => t.remove(), 2000);
    }

    // ── API 呼叫 ──
    async function callAPI(prompt) {
      const ep = S.cfg.mode === 'roche'
        ? 'https://api.anthropic.com/v1/messages'
        : (S.cfg.endpoint || 'https://api.anthropic.com/v1/messages');
      const headers = { 'Content-Type': 'application/json' };
      if (S.cfg.apiKey) headers['Authorization'] = `Bearer ${S.cfg.apiKey}`;
      const body = {
        model: S.cfg.model || 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      };
      const res = await fetch(ep, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      return (data.choices?.[0]?.message?.content) ||
             (data.content?.map(b => b.text || '').join('')) || '';
    }

    // ── 生成貼文 ──
    async function generatePosts() {
      if (S.generating) return;
      S.generating = true;
      render();
      const name = charName();
      const prompt = `你是「${name}」，一個在小紅書上發布內容的角色。${S.cfg.systemPrompt ? '\n角色設定：' + S.cfg.systemPrompt : ''}

請以這個角色的身份，生成 3 篇小紅書風格的筆記。每篇筆記要有：
- title: 標題（吸引人的小紅書標題風格，可以用emoji）
- content: 正文內容（200-400字，小紅書風格，分段、有emoji）
- tags: 標籤陣列（3-5個）
- coverEmoji: 一個代表這篇筆記的 emoji
- date: 發布日期（最近一個月內，如「3天前」「1週前」）

直接回覆 JSON 陣列，不要有任何其他文字或markdown符號。`;

      try {
        const raw = await callAPI(prompt);
        let parsed;
        try {
          parsed = JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim());
        } catch {
          // fallback
          parsed = [
            { title: '今日份的咖啡與陽光 ☕', content: '在街角的咖啡店，點了一杯dirty...\n\n陽光從窗外灑進來，映在杯壁上。有時候覺得，一個人的時光也挺好的。\n\n店裡放著很舒服的爵士樂，點了一份提拉米蘇。\n\n這種不被打擾的午後，才是真正的奢侈。', tags: ['咖啡日記', '獨處時光', 'citylife'], coverEmoji: '☕', date: '3天前' },
            { title: '深夜碎碎念 🌙', content: '又是一個失眠的夜晚。\n\n翻來覆去想了很多事情，最後決定起來泡一杯茶。\n\n窗外的城市燈火通明，突然覺得這個世界很安靜。\n\n也許失眠不是壞事，至少能看到這個城市最真實的樣子。', tags: ['深夜', '碎碎念', '失眠日記'], coverEmoji: '🌙', date: '1天前' },
            { title: '本週穿搭 all black 🖤', content: '最近迷上了這種暗色調的搭配。\n\n黑色大衣 + 灰色高領毛衣 + 直筒褲\n簡單但是很有質感。\n\n有時候覺得，穿搭就是一種無聲的表達。\n\n今天被同事說像是從電影裡走出來的（？', tags: ['穿搭', 'OOTD', '極簡風'], coverEmoji: '🖤', date: '5天前' },
          ];
        }
        const news = (Array.isArray(parsed) ? parsed : [parsed]).map(p => ({
          ...p,
          author: name,
          gradient: rg(),
          avatarGrad: 'linear-gradient(135deg,#667eea,#764ba2)',
          coverH: rh(),
          likes: rl(),
          comments: rc(),
        }));
        S.posts = [...news, ...S.posts];
        savePosts();
        toast('✨ 生成了 ' + news.length + ' 篇筆記');
      } catch (e) {
        toast('生成失敗：' + e.message);
      } finally {
        S.generating = false;
        render();
      }
    }

    // ══════════════════════════════════════════════
    //  渲染
    // ══════════════════════════════════════════════
    const root = document.createElement('div');
    root.className = 'xhs-root';
    container.appendChild(root);

    function render() {
      // 如果有詳情頁或設定面板，不動主體
      const hasDetail = !!S.detail;
      const hasSettings = S.showSettings;

      let h = '';

      // ── Header ──
      h += `<div class="xhs-hdr">
        <button class="xhs-hdr-btn" data-act="settings">${icons.settings}</button>
        <span class="xhs-hdr-title">小紅書</span>
        <button class="xhs-hdr-btn" data-act="generate" ${S.generating ? 'disabled' : ''}>${S.generating ? '⏳' : icons.refresh}</button>
      </div>`;

      // ── Body ──
      h += `<div class="xhs-body">`;
      if (S.view === 'discover') h += renderDiscover();
      else h += renderProfile();
      h += `</div>`;

      // ── Bottom Nav ──
      h += `<div class="xhs-nav">
        <button class="xhs-nav-btn" data-act="nav-discover">${icons.home(S.view === 'discover')}<span style="color:${S.view === 'discover' ? RED : T3}">首頁</span></button>
        <button class="xhs-nav-btn">${icons.shop}<span>購物</span></button>
        <button class="xhs-nav-plus" data-act="generate" ${S.generating ? 'disabled' : ''}>${icons.plus}</button>
        <button class="xhs-nav-btn">${icons.mail}<span>消息</span></button>
        <button class="xhs-nav-btn" data-act="nav-profile">${icons.user(S.view === 'profile')}<span style="color:${S.view === 'profile' ? RED : T3}">我</span></button>
      </div>`;

      // ── Detail overlay ──
      if (hasDetail) h += renderDetail(S.detail);

      // ── Settings overlay ──
      if (hasSettings) h += renderSettings();

      root.innerHTML = h;
    }

    // ── 發現頁 ──
    function renderDiscover() {
      let h = '';
      h += `<div class="xhs-search"><div class="xhs-search-inner">${icons.search}<span>搜尋小紅書</span></div></div>`;
      h += `<div class="xhs-cats">`;
      ['推薦', '穿搭', '美食', '旅行', '日常', '攝影'].forEach((t, i) => {
        h += `<span class="${i === 0 ? 'active' : ''}">${t}</span>`;
      });
      h += `</div>`;

      if (S.posts.length === 0) {
        h += `<div class="xhs-empty"><div class="icon">🌿</div><p>還沒有內容，讓 AI 幫角色生成一些吧</p>
          <button class="xhs-btn" data-act="generate" ${S.generating ? 'disabled' : ''}>${S.generating ? '⏳ 生成中...' : '✨ 生成筆記'}</button></div>`;
      } else {
        h += `<div class="xhs-waterfall">`;
        S.posts.forEach((p, i) => {
          h += `<div class="xhs-card" data-act="open-post" data-idx="${i}">
            <div class="xhs-card-cover" style="height:${p.coverH || 180}px;background:${p.gradient}">
              ${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
              ${p.coverEmoji ? `<span class="emoji">${p.coverEmoji}</span>` : ''}
            </div>
            <div class="xhs-card-body">
              <div class="xhs-card-title">${esc(p.title)}</div>
              <div class="xhs-card-meta">
                <div class="xhs-card-author"><div class="av" style="background:${p.avatarGrad || '#ddd'}"></div><span>${esc(p.author)}</span></div>
                <div class="xhs-card-likes">${icons.heart(false, 12)}<span>${p.likes}</span></div>
              </div>
            </div>
          </div>`;
        });
        h += `</div>`;
        h += `<div style="text-align:center;padding:14px 0 6px"><button class="xhs-btn-outline" data-act="generate" ${S.generating ? 'disabled' : ''}>${icons.refresh} ${S.generating ? '生成中...' : '生成更多'}</button></div>`;
      }
      return h;
    }

    // ── 個人主頁 ──
    function renderProfile() {
      const name = charName();
      const my = S.posts.filter(p => p.author === name);
      let h = '';

      h += `<div class="xhs-profile-hdr">
        <div class="xhs-avatar" style="background:linear-gradient(135deg,#667eea,#764ba2)">${name[0] || '?'}</div>
        <div class="xhs-profile-name">${esc(name)}</div>
        <span class="xhs-profile-uid">小紅書號：${S.char.uid}</span>
        <div class="xhs-profile-stats">
          <div><div class="val">${S.char.following}</div><div class="lbl">關注</div></div>
          <div><div class="val">${S.char.followers}</div><div class="lbl">粉絲</div></div>
          <div><div class="val">${S.char.likes}</div><div class="lbl">獲讚與收藏</div></div>
        </div>
        <div class="xhs-profile-btns"><button class="xhs-follow-btn">關注</button><button class="xhs-msg-btn">💬</button></div>
        <p class="xhs-profile-bio">${esc(S.cfg.systemPrompt ? S.cfg.systemPrompt.slice(0, 80) : S.char.bio || 'The silence is loud.')}</p>
      </div>`;

      h += `<div class="xhs-tabs"><div class="xhs-tab active">筆記</div><div class="xhs-tab">讚過</div></div>`;

      if (my.length === 0) {
        h += `<div class="xhs-empty"><div class="icon">📝</div><p>還沒有筆記</p>
          <button class="xhs-btn" data-act="generate" ${S.generating ? 'disabled' : ''}>${S.generating ? '生成中...' : '✨ AI 生成筆記'}</button></div>`;
      } else {
        h += `<div class="xhs-grid">`;
        my.forEach((p, i) => {
          const realIdx = S.posts.indexOf(p);
          h += `<div class="xhs-grid-item" data-act="open-post" data-idx="${realIdx}" style="background:${p.gradient}">
            ${p.coverEmoji ? `<span class="emoji">${p.coverEmoji}</span>` : ''}
            <div class="overlay"><span>${esc(p.title)}</span></div>
          </div>`;
        });
        h += `</div>`;
      }
      return h;
    }

    // ── 詳情頁 ──
    function renderDetail(p) {
      const idx = S.posts.indexOf(p);
      const liked = S.liked[idx];
      let h = `<div class="xhs-detail">`;
      h += `<div class="xhs-hdr" style="border-bottom:1px solid ${BD}">
        <button class="xhs-hdr-btn" data-act="close-detail">${icons.back}</button>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:26px;height:26px;border-radius:50%;background:${p.avatarGrad || '#ddd'}"></div>
          <span style="font-size:13px;font-weight:600">${esc(p.author)}</span>
        </div>
        <button style="background:${RED};color:#fff;border:none;border-radius:14px;padding:4px 14px;font-size:12px;font-weight:600;cursor:pointer">關注</button>
      </div>`;
      h += `<div class="xhs-detail-cover" style="background:${p.gradient}">${p.coverEmoji ? `<span class="emoji">${p.coverEmoji}</span>` : ''}</div>`;
      h += `<div class="xhs-detail-body">
        <h2>${esc(p.title)}</h2>
        <div class="content">${esc(p.content)}</div>`;
      if (p.tags && p.tags.length) {
        h += `<div class="xhs-detail-tags">${p.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</div>`;
      }
      h += `<div class="xhs-detail-date">${esc(p.date || '')}</div>`;
      h += `<div class="xhs-detail-actions">
        <button class="xhs-act-btn" data-act="like" data-idx="${idx}">${icons.heart(liked, 18)}<span style="color:${liked ? RED : T3}">${liked ? p.likes + 1 : p.likes}</span></button>
        <button class="xhs-act-btn">${icons.comment}<span>${p.comments || 0}</span></button>
        <button class="xhs-act-btn">${icons.star}<span>收藏</span></button>
        <button class="xhs-act-btn">${icons.share}<span>分享</span></button>
      </div></div></div>`;
      return h;
    }

    // ── 設定面板 ──
    function renderSettings() {
      const c = S.cfg;
      let h = `<div class="xhs-settings-mask"><div class="xhs-settings">`;
      h += `<div class="xhs-settings-hdr"><span>API 設定</span><button data-act="close-settings">✕</button></div>`;

      h += `<label class="xhs-s-label">API 來源</label>`;
      h += `<div class="xhs-s-modes">
        <button class="xhs-s-mode ${c.mode === 'roche' ? 'active' : ''}" data-act="set-mode" data-mode="roche">Roche 內建</button>
        <button class="xhs-s-mode ${c.mode === 'custom' ? 'active' : ''}" data-act="set-mode" data-mode="custom">自訂 API</button>
      </div>`;

      if (c.mode === 'custom') {
        h += `<label class="xhs-s-label">Endpoint</label>
          <input class="xhs-s-input" data-field="endpoint" value="${esc(c.endpoint)}" placeholder="https://api.openai.com/v1/chat/completions">
          <label class="xhs-s-label">API Key</label>
          <input class="xhs-s-input" data-field="apiKey" value="${esc(c.apiKey)}" type="password" placeholder="sk-...">
          <label class="xhs-s-label">Model</label>
          <input class="xhs-s-input" data-field="model" value="${esc(c.model)}" placeholder="gpt-4o / claude-sonnet-4-6">`;
      }

      h += `<label class="xhs-s-label">角色名稱</label>
        <input class="xhs-s-input" data-field="charName" value="${esc(c.charName)}" placeholder="角色名">
        <label class="xhs-s-label">角色設定 / System Prompt（選填）</label>
        <textarea class="xhs-s-input" data-field="systemPrompt" rows="4" placeholder="描述角色的人設、語氣、興趣等..." style="resize:vertical">${esc(c.systemPrompt)}</textarea>`;

      h += `<button class="xhs-s-save" data-act="save-settings">儲存設定</button>`;
      h += `<button class="xhs-s-save" data-act="clear-posts" style="background:#fff;color:${RED};border:1px solid ${RED};margin-top:8px">🗑️ 清除所有筆記</button>`;
      h += `</div></div>`;
      return h;
    }

    // ── HTML 轉義 ──
    function esc(s) {
      if (!s) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ══════════════════════════════════════════════
    //  事件委派
    // ══════════════════════════════════════════════
    function handleClick(e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.dataset.act;

      if (act === 'settings') { S.showSettings = true; render(); }
      else if (act === 'close-settings') { S.showSettings = false; render(); }
      else if (act === 'generate') { generatePosts(); }
      else if (act === 'nav-discover') { S.view = 'discover'; render(); }
      else if (act === 'nav-profile') { S.view = 'profile'; render(); }
      else if (act === 'open-post') {
        const idx = parseInt(btn.dataset.idx);
        if (!isNaN(idx) && S.posts[idx]) { S.detail = S.posts[idx]; render(); }
      }
      else if (act === 'close-detail') { S.detail = null; render(); }
      else if (act === 'like') {
        const idx = parseInt(btn.dataset.idx);
        S.liked[idx] = !S.liked[idx];
        render();
      }
      else if (act === 'set-mode') {
        S.cfg.mode = btn.dataset.mode;
        render();
      }
      else if (act === 'save-settings') {
        // 從 DOM 讀取 input 值
        root.querySelectorAll('.xhs-s-input[data-field]').forEach(el => {
          S.cfg[el.dataset.field] = el.value;
        });
        saveCfg();
        S.showSettings = false;
        toast('設定已儲存');
        render();
      }
      else if (act === 'clear-posts') {
        S.posts = [];
        S.liked = {};
        savePosts();
        S.showSettings = false;
        toast('已清除所有筆記');
        render();
      }
    }

    root.addEventListener('click', handleClick);

    // 初次渲染
    render();

    // 儲存清理引用
    this._cleanup = () => {
      root.removeEventListener('click', handleClick);
      style.remove();
      root.remove();
    };
  },

  /* ══════════════════════════════════════════════
     UNMOUNT
     ══════════════════════════════════════════════ */
  unmount() {
    if (this._cleanup) this._cleanup();
  },
});
