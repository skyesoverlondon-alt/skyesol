
window.SKYESPACE_DATA = {
  metrics: {
    members: '1.8M',
    districts: '412',
    listings: '92K',
    liveNow: '1,428',
    enrollments: '208K',
    vaultRevenue: '$4.6M'
  },
  districts: [
    { name:'Downtown Phoenix Pulse', vibe:'Night market / creators / late coffee', active:'18.2K active', hotspot:'Civic corridor' },
    { name:'Glendale Circle', vibe:'Neighborhood services / families / sports', active:'9.4K active', hotspot:'Arrowhead lane' },
    { name:'Tempe Build Lane', vibe:'Students / startups / maker labs', active:'12.8K active', hotspot:'Campus strip' },
    { name:'Mesa Maker Row', vibe:'Studios / custom work / small brands', active:'7.6K active', hotspot:'Workshop block' }
  ],
  listings: [
    { title:'Premium Creator Launch Stack', category:'Digital Service', price:'$1,900', seller:'Skye Build Unit', eta:'3 days', district:'Remote / Phoenix' },
    { title:'Downtown Studio Hour Block', category:'Booking', price:'$85/hr', seller:'Luma Works', eta:'Tonight', district:'Downtown Phoenix' },
    { title:'Neighborhood Event Sponsorship Pack', category:'Business Boost', price:'$480', seller:'Glendale Circle', eta:'48 hours', district:'Glendale' },
    { title:'Aesthetic Journal Template Set', category:'Digital Product', price:'$48', seller:'Muse Atelier', eta:'Instant', district:'Global' },
    { title:'Founder Debate Room Ticket', category:'Experience', price:'$35', seller:'Council Chamber', eta:'Thursday 7 PM', district:'Live' },
    { title:'Creator Membership Vault', category:'Subscription', price:'$29/mo', seller:'Vault No. 7', eta:'Instant', district:'Invite-led' }
  ],
  feed: [
    { author:'SkyeScene Lab', role:'Creator Studio', type:'Launch', title:'New neon district reel kit just dropped into Stage + Muse.', text:'Creators can now publish short-form loops, cross-post to Muse boards, and unlock premium cuts inside Vaults from one composition lane.' },
    { author:'Tempe Build Lane', role:'District', type:'Signal', title:'Co-working strip showing a 41% rise in local app build demand.', text:'Three founder houses and nine freelancers are clustering around live build nights. Forge templates are getting remixed fast.' },
    { author:'Council Chamber', role:'Verified Debate', type:'Knowledge', title:'Debate tonight: should local platforms rank vendors by trust, response time, or verified outcomes?', text:'Evidence branches already pulled in transaction history, review integrity, and neighborhood retention models.' },
    { author:'Vault No. 7', role:'Premium Circle', type:'Drop', title:'Members-only editorial capsule open for 36 hours.', text:'Includes founder notes, private gallery cuts, and one collaborative critique room.' }
  ],
  signals: [
    { severity:'high', title:'Downtown event demand spike', detail:'Food, pop-ups, and short-form creator traffic are clustering near Roosevelt Row.', source:'Signal Mesh', age:'2m ago' },
    { severity:'medium', title:'Mesa service booking velocity up 18%', detail:'Home service, print, and mobile retail listings are converting above weekly baseline.', source:'Market Graph', age:'11m ago' },
    { severity:'low', title:'Debate room enrollment cresting', detail:'Council + Academy crossover rooms are pulling new expert profiles.', source:'Council Analytics', age:'23m ago' },
    { severity:'medium', title:'Night creator streams crossing district lines', detail:'Stage traffic is back-feeding district discovery and local commerce clicks.', source:'Stage Relay', age:'31m ago' }
  ],
  creators: [
    { name:'Nova District', tag:'Live urban visual essays', followers:'218K', revenue:'$42K/mo' },
    { name:'ForgeFather', tag:'Build stream + app remixes', followers:'144K', revenue:'$33K/mo' },
    { name:'MusePulse', tag:'Editorial boards + journals', followers:'97K', revenue:'$21K/mo' },
    { name:'Signal Cartographer', tag:'Civic intel maps', followers:'81K', revenue:'$15K/mo' }
  ],
  debates: [
    { title:'Should city trust scores influence market ranking?', stanceA:'Yes, verified response + outcomes reduce noise.', stanceB:'No, it can freeze out new sellers without history.', votes:'19.2K' },
    { title:'Should creator memberships include local perks?', stanceA:'Yes, local commerce ties deepen retention.', stanceB:'No, memberships should stay media-first.', votes:'8.4K' },
    { title:'Can app builders stream development as entertainment?', stanceA:'Yes, the process itself is product.', stanceB:'Only if the build quality stays real.', votes:'11.7K' }
  ],
  courses: [
    { title:'Local Platform Operations', cohort:'Starts Monday', length:'4 weeks', seats:'32 seats left' },
    { title:'Creator Commerce Systems', cohort:'Starts Wednesday', length:'6 weeks', seats:'18 seats left' },
    { title:'Evidence-Led Debate Design', cohort:'Starts Friday', length:'3 weeks', seats:'41 seats left' },
    { title:'Aesthetic Publishing for Premium Worlds', cohort:'Starts Sunday', length:'5 weeks', seats:'24 seats left' }
  ],
  messages: [
    { from:'Glendale Circle', topic:'Featured lane request', preview:'We want the Friday market stream pinned to Districts + Stage.' },
    { from:'Nova District', topic:'Vault drop approval', preview:'Approve premium bundle and member preview cut for tonight.' },
    { from:'Council Chamber', topic:'Debate evidence update', preview:'New source branches imported for ranking fairness argument.' },
    { from:'Muse Atelier', topic:'Journal bundle sale', preview:'We want to pair journal templates with a membership upgrade.' }
  ],
  projects: [
    { name:'District Event Stack', state:'Building', runtime:'Static + Worker hooks', lane:'Local commerce' },
    { name:'TrustRank Graph', state:'Review', runtime:'Analytics UI', lane:'Signal / Market' },
    { name:'Vault Capsule Engine', state:'Deploy-ready', runtime:'Membership surface', lane:'Muse / Vaults' },
    { name:'Council Evidence Tree', state:'Live beta', runtime:'Knowledge UI', lane:'Council / Academy' }
  ],
  vaults: [
    { title:'Founders After Dark', tier:'Black Gold', price:'$49/mo', members:'8.2K', promise:'Private essays, live critiques, drop windows, and city dinners.' },
    { title:'Muse Capsule 03', tier:'Editorial', price:'$19/mo', members:'12.6K', promise:'Moodboards, journals, templates, and premium galleries.' },
    { title:'Forge Inner Circle', tier:'Builder', price:'$29/mo', members:'6.1K', promise:'Remix rights, build streams, template drops, and launch critiques.' }
  ]
};
