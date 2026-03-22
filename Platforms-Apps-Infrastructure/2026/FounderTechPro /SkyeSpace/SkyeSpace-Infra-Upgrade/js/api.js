(function(){
  const base = '/.netlify/functions';
  const endpoints = {
    health: 'skyespace-health',
    feed: 'skyespace-feed',
    market: 'skyespace-market',
    signal: 'skyespace-signal',
    districts: 'skyespace-districts',
    metrics: 'skyespace-metrics',
    profile: 'skyespace-profile',
    compose: 'skyespace-compose',
    messages: 'skyespace-messages'
  };
  let live = false;
  let checked = false;

  function getGatewayToken(){
    try {
      if (window.KaixuSession?.getToken) return window.KaixuSession.getToken() || '';
      const local = localStorage.getItem('KAIXU_VIRTUAL_KEY') || localStorage.getItem('kaixu_session') || '';
      if (local) {
        localStorage.setItem('KAIXU_VIRTUAL_KEY', local);
        localStorage.setItem('kaixu_session', local);
      }
      return local;
    } catch(_err) {
      return '';
    }
  }

  function setAuthState(){
    const token = getGatewayToken();
    document.documentElement.dataset.skyeAuth = token ? 'authenticated' : 'locked';
    window.dispatchEvent(new CustomEvent('skye:auth', { detail: { authenticated: !!token } }));
    return token;
  }

  function authError(message){
    const err = new Error(message || 'SkyeSpace requires a Gateway 13 login.');
    err.code = 'AUTH_REQUIRED';
    err.status = 401;
    return err;
  }

  function parseJson(response){ return response.json().catch(() => ({})); }
  async function request(path, options, config){
    const settings = Object.assign({ authRequired: true }, config || {});
    const token = setAuthState();
    if (settings.authRequired && !token) {
      throw authError();
    }
    const response = await fetch(`${base}/${path}`, Object.assign({
      headers: Object.assign(
        { 'content-type': 'application/json' },
        token ? { authorization: `Bearer ${token}` } : {}
      )
    }, options || {}));
    const data = await parseJson(response);
    if(!response.ok){
      const err = new Error(data.error || `HTTP ${response.status}`);
      err.payload = data;
      err.status = response.status;
      if (response.status === 401 || response.status === 403) {
        setAuthState();
      }
      throw err;
    }
    return data;
  }

  async function detect(){
    if(checked) return live;
    checked = true;
    try{
      const health = await request(endpoints.health, {}, { authRequired: false });
      live = !!health.ok;
    }catch(_err){
      live = false;
    }
    document.documentElement.dataset.infraMode = live ? 'live' : 'fallback';
    setAuthState();
    window.dispatchEvent(new CustomEvent('skye:infra', { detail: { live } }));
    return live;
  }

  function relativeTime(value){
    if(!value) return 'just now';
    const date = typeof value === 'string' ? new Date(value) : value;
    const delta = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(delta / 60000);
    if(minutes < 1) return 'just now';
    if(minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if(hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function safe(path, fallback){
    const isLive = await detect();
    if(!isLive) return fallback();
    try{ return await path(); }
    catch(_err){ return fallback(); }
  }

  window.SKYE_API = {
    detect,
    isLive(){ return live; },
    relativeTime,
    auth: {
      isAuthenticated(){ return !!setAuthState(); },
      getToken(){ return getGatewayToken(); },
      loginUrl: '/account/'
    },
    requireLogin(){
      if (setAuthState()) return true;
      throw authError();
    },
    async getFeed(){
      return safe(async () => {
        const data = await request(endpoints.feed);
        return data.feed || [];
      }, async () => window.SKYESPACE_DATA.feed || []);
    },
    async getListings(){
      return safe(async () => {
        const data = await request(endpoints.market);
        return (data.listings || []).map(item => Object.assign({}, item, { eta: item.eta, price: item.price }));
      }, async () => window.SKYESPACE_DATA.listings || []);
    },
    async getSignals(){
      return safe(async () => {
        const data = await request(endpoints.signal);
        return (data.signals || []).map(item => Object.assign({}, item, { age: relativeTime(item.age) }));
      }, async () => window.SKYESPACE_DATA.signals || []);
    },
    async getDistricts(){
      return safe(async () => {
        const data = await request(endpoints.districts);
        return data.districts || [];
      }, async () => window.SKYESPACE_DATA.districts || []);
    },
    async getMetrics(){
      return safe(async () => {
        const data = await request(endpoints.metrics);
        return data.metrics || null;
      }, async () => null);
    },
    async getProfile(){
      return safe(async () => {
        const data = await request(endpoints.profile);
        return data.profile || window.SKYE_STATE.get().profile;
      }, async () => window.SKYE_STATE.get().profile);
    },
    async saveProfile(profile){
      if(!setAuthState()) throw authError();
      if(!(await detect())){
        window.SKYE_STATE.setProfile(profile);
        return window.SKYE_STATE.get().profile;
      }
      const data = await request(endpoints.profile, { method:'POST', body: JSON.stringify(profile) });
      return data.profile;
    },
    async compose(payload){
      if(!setAuthState()) throw authError();
      if(!(await detect())) return { ok:false, fallback:true };
      return request(endpoints.compose, { method:'POST', body: JSON.stringify(payload) });
    },
    async getConversations(){
      return safe(async () => {
        const data = await request(endpoints.messages);
        return data.conversations || [];
      }, async () => window.SKYESPACE_DATA.messages || []);
    },
    async getMessages(conversationId){
      return safe(async () => {
        const data = await request(`${endpoints.messages}?conversationId=${encodeURIComponent(conversationId)}`);
        return (data.messages || []).map(item => Object.assign({}, item, { mine: item.author === (window.SKYE_STATE.get().profile.name || 'You') }));
      }, async () => window.SKYE_STATE.get().quickMessages || []);
    },
    async sendMessage(payload){
      if(!setAuthState()) throw authError();
      if(!(await detect())){
        window.SKYE_STATE.pushMessage({ author: window.SKYE_STATE.get().profile.name, body: payload.body, mine: true, ts: Date.now() });
        return { ok:true, fallback:true };
      }
      return request(endpoints.messages, { method:'POST', body: JSON.stringify(payload) });
    }
  };
})();
