
(function(){
  const KEY = 'skyespace-mvp-state-v1';
  const defaults = {
    quickPosts: [],
    quickListings: [],
    quickSignals: [],
    quickMessages: [
      {author:'SkyeSpace System', body:'Your unified inbox is live. Districts, buyers, creators, and members all land here.', mine:false, ts:Date.now()-500000}
    ],
    joins: {},
    votes: {},
    enrollments: {},
    saves: {},
    profile: {
      name:'Skyes Over London',
      handle:'@skyesoverlondon',
      title:'Founder / Operator / Worldbuilder',
      bio:'Building sovereign platform ecosystems where creators, commerce, local communities, and authority layers all reinforce each other.'
    }
  };

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return clone(defaults);
      return Object.assign(clone(defaults), JSON.parse(raw));
    }catch(e){
      return clone(defaults);
    }
  }
  function save(next){
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }
  window.SKYE_STATE = {
    get(){ return load(); },
    update(mutator){
      const current = load();
      const next = mutator(current) || current;
      return save(next);
    },
    pushPost(item){
      return this.update(s => { s.quickPosts.unshift(item); return s; });
    },
    pushListing(item){
      return this.update(s => { s.quickListings.unshift(item); return s; });
    },
    pushSignal(item){
      return this.update(s => { s.quickSignals.unshift(item); return s; });
    },
    pushMessage(item){
      return this.update(s => { s.quickMessages.push(item); return s; });
    },
    toggle(path, id){
      return this.update(s => {
        s[path][id] = !s[path][id];
        return s;
      });
    },
    setProfile(profile){
      return this.update(s => {
        s.profile = Object.assign({}, s.profile, profile);
        return s;
      });
    }
  };
})();
