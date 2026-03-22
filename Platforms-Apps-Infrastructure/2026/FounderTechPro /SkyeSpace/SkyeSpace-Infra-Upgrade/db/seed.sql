insert into skyespace_profiles(identity_key, handle, display_name, title, bio)
values
  ('seed:founder', '@skyesoverlondon', 'Skyes Over London', 'Founder / Operator / Worldbuilder', 'Building sovereign platform ecosystems where creators, commerce, local communities, and authority layers reinforce each other.')
on conflict (identity_key) do nothing;

insert into skyespace_districts(slug, name, vibe, hotspot, active_count)
values
  ('downtown-phoenix-core', 'Downtown Phoenix Core', 'Night economy / design / food / events', 'Roosevelt Row', 18300),
  ('glendale-circle', 'Glendale Circle', 'Neighborhood services / families / sports', 'Arrowhead lane', 9400),
  ('tempe-build-lane', 'Tempe Build Lane', 'Students / startups / maker labs', 'Campus strip', 12800),
  ('mesa-maker-row', 'Mesa Maker Row', 'Studios / custom work / small brands', 'Workshop block', 7600)
on conflict (slug) do nothing;

with founder as (
  select id from skyespace_profiles where identity_key='seed:founder' limit 1
)
insert into skyespace_posts(lane, category, title, body, district, author_profile_id, author_name, author_role)
select * from (
  values
  ('feed','Launch','New neon district reel kit just dropped into Stage + Muse.','Creators can now publish short-form loops, cross-post to Muse boards, and unlock premium cuts inside Vaults from one composition lane.','Global',(select id from founder),'SkyeScene Lab','Creator Studio'),
  ('feed','Signal','Co-working strip showing a 41% rise in local app build demand.','Three founder houses and nine freelancers are clustering around live build nights. Forge templates are getting remixed fast.','Tempe',(select id from founder),'Tempe Build Lane','District'),
  ('feed','Knowledge','Debate tonight: should local platforms rank vendors by trust, response time, or verified outcomes?','Evidence branches already pulled in transaction history, review integrity, and neighborhood retention models.','Live',(select id from founder),'Council Chamber','Verified Debate'),
  ('muse','Drop','Members-only editorial capsule open for 36 hours.','Includes founder notes, private gallery cuts, and one collaborative critique room.','Invite-led',(select id from founder),'Vault No. 7','Premium Circle')
) as s(lane, category, title, body, district, author_profile_id, author_name, author_role)
on conflict do nothing;

with founder as (
  select id from skyespace_profiles where identity_key='seed:founder' limit 1
)
insert into skyespace_listings(title, category, price_text, seller_name, eta_text, district, details, author_profile_id)
select * from (
  values
  ('Premium Creator Launch Stack', 'Digital Service', '$1,900', 'Skye Build Unit', '3 days', 'Remote / Phoenix', 'Launch system for premium creator offers.', (select id from founder)),
  ('Downtown Studio Hour Block', 'Booking', '$85/hr', 'Luma Works', 'Tonight', 'Downtown Phoenix', 'Bookable studio time for shoots and edits.', (select id from founder)),
  ('Neighborhood Event Sponsorship Pack', 'Business Boost', '$480', 'Glendale Circle', '48 hours', 'Glendale', 'Sponsor pack for local event traffic.', (select id from founder)),
  ('Creator Membership Vault', 'Subscription', '$29/mo', 'Vault No. 7', 'Instant', 'Invite-led', 'Membership offer with premium access.', (select id from founder))
) as s(title, category, price_text, seller_name, eta_text, district, details, author_profile_id)
on conflict do nothing;

insert into skyespace_signals(severity, title, detail, source_name)
values
  ('high', 'Downtown event demand spike', 'Food, pop-ups, and short-form creator traffic are clustering near Roosevelt Row.', 'Signal Mesh'),
  ('medium', 'Mesa service booking velocity up 18%', 'Home service, print, and mobile retail listings are converting above weekly baseline.', 'Market Graph'),
  ('low', 'Debate room enrollment cresting', 'Council + Academy crossover rooms are pulling new expert profiles.', 'Council Analytics'),
  ('medium', 'Night creator streams crossing district lines', 'Stage traffic is back-feeding district discovery and local commerce clicks.', 'Stage Relay');

insert into skyespace_conversations(topic, participant_key)
values
  ('Featured lane request', 'Glendale Circle'),
  ('Vault drop approval', 'Nova District'),
  ('Debate evidence update', 'Council Chamber'),
  ('Journal bundle sale', 'Muse Atelier')
on conflict (topic, participant_key) do nothing;

insert into skyespace_messages(conversation_id, author_name, body)
select c.id, x.author_name, x.body
from skyespace_conversations c
join (
  values
    ('Featured lane request', 'Glendale Circle', 'We want the Friday market stream pinned to Districts + Stage.'),
    ('Vault drop approval', 'Nova District', 'Approve premium bundle and member preview cut for tonight.'),
    ('Debate evidence update', 'Council Chamber', 'New source branches imported for ranking fairness argument.'),
    ('Journal bundle sale', 'Muse Atelier', 'We want to pair journal templates with a membership upgrade.')
) as x(topic, author_name, body)
  on c.topic = x.topic
where not exists (
  select 1 from skyespace_messages m where m.conversation_id = c.id and m.body = x.body
);
