(function(){
  let activeConversationId = null;

  function fmt(ts){
    if(!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  }

  async function renderThread(){
    const state = window.SKYE_STATE.get();
    const target = document.querySelector('#thread');
    let messages = [];
    if(activeConversationId){
      messages = await window.SKYE_API.getMessages(activeConversationId);
    }else{
      messages = state.quickMessages || [];
    }
    target.innerHTML = messages.map(msg => `
      <div class="bubble ${msg.mine || msg.author === state.profile.name ? 'me' : ''}">
        <div class="meta"><span>${msg.mine || msg.author === state.profile.name ? 'You' : msg.author}</span><span>${fmt(msg.ts || msg.created_at)}</span></div>
        <div>${msg.body}</div>
      </div>
    `).join('');
  }

  async function renderConversations(){
    const params = new URLSearchParams(location.search);
    const seller = params.get('seller');
    const topic = params.get('topic');
    const target = document.querySelector('#message-preview-list');
    const conversations = await window.SKYE_API.getConversations();

    if(seller && topic && !conversations.find(c => c.from === seller && c.topic === topic)){
      target.innerHTML = `
        <article class="message-preview active" data-searchable>
          <div class="meta"><span>${seller}</span><span>${topic}</span></div>
          <p>New inquiry draft ready. Send the first message below.</p>
        </article>
      ` + conversations.map(c => `
        <article class="message-preview" data-conversation-id="${c.id}" data-searchable>
          <div class="meta"><span>${c.from}</span><span>${c.topic}</span></div>
          <p>${c.preview || 'No messages yet.'}</p>
        </article>
      `).join('');
      activeConversationId = null;
      return;
    }

    if(conversations.length && !activeConversationId) activeConversationId = conversations[0].id;
    target.innerHTML = conversations.map(c => `
      <article class="message-preview ${c.id === activeConversationId ? 'active' : ''}" data-conversation-id="${c.id}" data-searchable>
        <div class="meta"><span>${c.from}</span><span>${c.topic}</span></div>
        <p>${c.preview || 'No messages yet.'}</p>
      </article>
    `).join('');
  }

  document.addEventListener('click', async e => {
    const preview = e.target.closest('[data-conversation-id]');
    if(preview){
      activeConversationId = preview.dataset.conversationId;
      await renderConversations();
      await renderThread();
    }
  });

  const form = document.querySelector('#message-form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const body = form.body.value.trim();
    if(!body) return;
    const params = new URLSearchParams(location.search);
    await window.SKYE_API.sendMessage({
      conversationId: activeConversationId,
      topic: params.get('topic') || 'General thread',
      participant: params.get('seller') || 'SkyeSpace Network',
      body
    });
    form.reset();
    await renderConversations();
    await renderThread();
    window.dispatchEvent(new CustomEvent('skye:update'));
  });

  async function render(){
    await renderConversations();
    await renderThread();
    const metrics = await window.SKYE_API.getMetrics();
    if(metrics){
      const stats = document.querySelectorAll('.hero-main .stat-value');
      if(stats[0]) stats[0].textContent = `${metrics.messages.toLocaleString()}`;
      if(stats[2]) stats[2].textContent = `${metrics.conversations.toLocaleString()}`;
      if(stats[3]) stats[3].textContent = `${metrics.conversations.toLocaleString()}`;
    }
  }
  render();
  window.addEventListener('skye:update', render);
})();
