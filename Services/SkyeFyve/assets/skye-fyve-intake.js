(() => {
  const EMAIL_TO = "SkyesOverLondonLC@solenterprises.org";
  const BUDGET_OPTIONS = [
    "Under $2,500",
    "$2,500 - $5,000",
    "$5,000 - $10,000",
    "$10,000 - $25,000",
    "$25,000+",
    "Need guidance first"
  ];
  const TIMELINE_OPTIONS = [
    "ASAP",
    "Within 30 days",
    "Within 60 days",
    "This quarter",
    "Exploring for later"
  ];

  const CONFIG = {
    hub: {
      serviceName: "SkyeFyve",
      title: "Choose the right lane and draft the request here.",
      intro: "This intake keeps the SkyeFyve request on the service hub itself. The draft email captures which lane fits best, the business context, the confirmation checkpoints, and the next-step notes so the conversation starts with real context.",
      requestLabel: "Submit SkyeFyve request - open email draft",
      fields: [
        { name: "lane", label: "Best-fit lane", type: "select", required: true, placeholder: "Choose a lane", options: ["Local SEO Snapshot", "ContentEngine", "CineFrame", "Field Service Ops", "ExecSignIn Pro", "Need help choosing"] },
        { name: "businessName", label: "Business or project name", type: "text", required: true, placeholder: "Business or project name" },
        { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Full name" },
        { name: "contactEmail", label: "Email", type: "email", required: true, placeholder: "Email" },
        { name: "contactPhone", label: "Phone", type: "tel", required: false, placeholder: "Phone" },
        { name: "website", label: "Current website or relevant URL", type: "url", required: false, placeholder: "https://example.com" },
        { name: "context", label: "Business context", type: "text", required: true, placeholder: "City, market, team type, or operating environment" },
        { name: "budget", label: "Budget posture", type: "select", required: true, placeholder: "Choose budget posture", options: BUDGET_OPTIONS },
        { name: "timeline", label: "Timeline", type: "select", required: true, placeholder: "Choose timeline", options: TIMELINE_OPTIONS },
        { name: "notes", label: "What should this lane solve first?", type: "textarea", required: false, placeholder: "Describe the business problem, offer gap, or lane you want help choosing." }
      ],
      checkpoints: [
        {
          name: "confirmLane",
          title: "I understand this is a SkyeFyve lane request, not a generic contact-page submission.",
          copy: "This email should start a scoped conversation from the SkyeFyve hub with the right offer already selected or narrowed down."
        },
        {
          name: "confirmFlow",
          title: "I reviewed the five-offer lane and want the request tied to this service structure.",
          copy: "The goal is to keep the request connected to the SkyeFyve commercial flow instead of sending it through the broad contact route."
        },
        {
          name: "confirmFit",
          title: "I want Skyes Over London to review this request and tell me the best next step.",
          copy: "That may be a direct quote conversation, a proof-surface review, or a recommendation to move into a different SkyeFyve lane."
        }
      ],
      approvalTitle: "I approve generating the SkyeFyve request email draft for this lane decision.",
      approvalCopy: "The draft still needs to be sent manually after it opens in the mail client or browser compose flow.",
      buildSummary(data, pageUrl) {
        return [
          "SkyeFyve Hub Request Summary",
          "",
          "Requested lane: " + valueOrBlank(data.lane),
          "Business or project: " + valueOrBlank(data.businessName),
          "Contact name: " + valueOrBlank(data.contactName),
          "Email: " + valueOrBlank(data.contactEmail),
          "Phone: " + valueOrBlank(data.contactPhone),
          "Current website or URL: " + valueOrBlank(data.website),
          "Business context: " + valueOrBlank(data.context),
          "Budget posture: " + valueOrBlank(data.budget),
          "Timeline: " + valueOrBlank(data.timeline),
          "",
          "Confirmation checkpoints",
          "1. Hub request flow acknowledged: " + yesNo(data.confirmLane),
          "2. SkyeFyve lane structure reviewed: " + yesNo(data.confirmFlow),
          "3. Next-step review requested: " + yesNo(data.confirmFit),
          "4. Manual email-send step understood: " + yesNo(data.submitAcknowledge),
          "5. Final request approval given: " + yesNo(data.submitApproval),
          "",
          "Notes",
          valueOrBlank(data.notes),
          "",
          "Source page: " + pageUrl,
          "",
          "This email serves as a direct SkyeFyve lane request from the service hub and is intended to start a scoped conversation without routing through the generic contact page."
        ].join("\n");
      }
    },
    "local-seo-snapshot": {
      serviceName: "Local SEO Snapshot",
      title: "Confirm the audit request and draft the email from this page.",
      intro: "This page should convert interest into a clear Snapshot request. The draft email includes the business, market, urgency, and confirmation steps so the intake stays attached to the service lane instead of falling into a generic contact queue.",
      requestLabel: "Request Local SEO Snapshot - open email draft",
      fields: [
        { name: "businessName", label: "Business name", type: "text", required: true, placeholder: "Business name" },
        { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Full name" },
        { name: "contactEmail", label: "Email", type: "email", required: true, placeholder: "Email" },
        { name: "contactPhone", label: "Phone", type: "tel", required: false, placeholder: "Phone" },
        { name: "website", label: "Current website", type: "url", required: false, placeholder: "https://example.com" },
        { name: "context", label: "Primary city / market", type: "text", required: true, placeholder: "Phoenix, Chicago, multi-location, etc." },
        { name: "budget", label: "Budget posture", type: "select", required: true, placeholder: "Choose budget posture", options: BUDGET_OPTIONS },
        { name: "timeline", label: "When do you want the Snapshot?", type: "select", required: true, placeholder: "Choose timeline", options: TIMELINE_OPTIONS },
        { name: "notes", label: "What feels off right now?", type: "textarea", required: false, placeholder: "Ranking drop, weak map visibility, poor conversion after search clicks, unclear priorities, or similar." }
      ],
      checkpoints: [
        {
          name: "confirmLane",
          title: "I understand this request is specifically for the Local SEO Snapshot lane.",
          copy: "The deliverable is a focused audit-style entry offer, not a generic support or contact submission."
        },
        {
          name: "confirmFlow",
          title: "I understand the Snapshot is meant to surface a score, top fixes, a 30-day plan, and the next route.",
          copy: "This page is intended to qualify the business and show whether the next move should be ContentEngine, CineFrame, or something else."
        },
        {
          name: "confirmFit",
          title: "I want a scoped Snapshot conversation tied directly to this page.",
          copy: "That keeps the outreach attached to the SkyeFyve service lane and the actual business market being reviewed."
        }
      ],
      approvalTitle: "I approve generating the Local SEO Snapshot request email draft.",
      approvalCopy: "The draft must still be reviewed and sent manually after it opens.",
      buildSummary(data, pageUrl) {
        return [
          "Local SEO Snapshot Request Summary",
          "",
          "Business name: " + valueOrBlank(data.businessName),
          "Contact name: " + valueOrBlank(data.contactName),
          "Email: " + valueOrBlank(data.contactEmail),
          "Phone: " + valueOrBlank(data.contactPhone),
          "Current website: " + valueOrBlank(data.website),
          "Primary city / market: " + valueOrBlank(data.context),
          "Budget posture: " + valueOrBlank(data.budget),
          "Requested timing: " + valueOrBlank(data.timeline),
          "",
          "Confirmation checkpoints",
          "1. Snapshot lane understood: " + yesNo(data.confirmLane),
          "2. Deliverable structure understood: " + yesNo(data.confirmFlow),
          "3. Page-level intake requested: " + yesNo(data.confirmFit),
          "4. Manual email-send step understood: " + yesNo(data.submitAcknowledge),
          "5. Final request approval given: " + yesNo(data.submitApproval),
          "",
          "Priority notes",
          valueOrBlank(data.notes),
          "",
          "Source page: " + pageUrl,
          "",
          "This email serves as a direct Local SEO Snapshot request from the SkyeFyve lane and is intended to start the audit conversation without routing through the generic contact page."
        ].join("\n");
      }
    },
    contentengine: {
      serviceName: "ContentEngine",
      title: "Confirm the SEO/content infrastructure request here.",
      intro: "This intake turns ContentEngine interest into a direct service request. The draft email captures the site, market context, desired timeline, and the confirmation checkpoints so the conversation starts on the actual infrastructure offer.",
      requestLabel: "Request ContentEngine - open email draft",
      fields: [
        { name: "businessName", label: "Business name", type: "text", required: true, placeholder: "Business name" },
        { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Full name" },
        { name: "contactEmail", label: "Email", type: "email", required: true, placeholder: "Email" },
        { name: "contactPhone", label: "Phone", type: "tel", required: false, placeholder: "Phone" },
        { name: "website", label: "Current website or blog", type: "url", required: false, placeholder: "https://example.com" },
        { name: "context", label: "Primary market or search territory", type: "text", required: true, placeholder: "City, region, niche, or search market" },
        { name: "budget", label: "Budget posture", type: "select", required: true, placeholder: "Choose budget posture", options: BUDGET_OPTIONS },
        { name: "timeline", label: "Desired start window", type: "select", required: true, placeholder: "Choose timeline", options: TIMELINE_OPTIONS },
        { name: "notes", label: "What should ContentEngine fix first?", type: "textarea", required: false, placeholder: "Dead blog, weak rankings, no content architecture, poor internal linking, low trust, or similar." }
      ],
      checkpoints: [
        {
          name: "confirmLane",
          title: "I understand this request is for the ContentEngine lane, not a generic blog-writing ask.",
          copy: "The service is positioned as search and content infrastructure, including technical SEO, architecture, and compounding traffic work."
        },
        {
          name: "confirmFlow",
          title: "I understand the goal is to build an organic growth system, not just publish random posts.",
          copy: "This page exists to start a higher-context SEO conversation from the actual service lane."
        },
        {
          name: "confirmFit",
          title: "I want a scoped ContentEngine conversation tied directly to this page.",
          copy: "That keeps the request attached to the offer, the business market, and the infrastructure problem described here."
        }
      ],
      approvalTitle: "I approve generating the ContentEngine request email draft.",
      approvalCopy: "The draft must still be sent manually after it opens in the email flow.",
      buildSummary(data, pageUrl) {
        return [
          "ContentEngine Request Summary",
          "",
          "Business name: " + valueOrBlank(data.businessName),
          "Contact name: " + valueOrBlank(data.contactName),
          "Email: " + valueOrBlank(data.contactEmail),
          "Phone: " + valueOrBlank(data.contactPhone),
          "Current website or blog: " + valueOrBlank(data.website),
          "Primary market or search territory: " + valueOrBlank(data.context),
          "Budget posture: " + valueOrBlank(data.budget),
          "Requested start window: " + valueOrBlank(data.timeline),
          "",
          "Confirmation checkpoints",
          "1. ContentEngine lane understood: " + yesNo(data.confirmLane),
          "2. Infrastructure scope understood: " + yesNo(data.confirmFlow),
          "3. Page-level intake requested: " + yesNo(data.confirmFit),
          "4. Manual email-send step understood: " + yesNo(data.submitAcknowledge),
          "5. Final request approval given: " + yesNo(data.submitApproval),
          "",
          "Priority notes",
          valueOrBlank(data.notes),
          "",
          "Source page: " + pageUrl,
          "",
          "This email serves as a direct ContentEngine request from the SkyeFyve lane and is intended to start a scoped SEO/content infrastructure conversation without routing through the generic contact page."
        ].join("\n");
      }
    },
    cineframe: {
      serviceName: "CineFrame",
      title: "Confirm the premium web-build request on this page.",
      intro: "This intake keeps the CineFrame request attached to the premium trust-surface offer. The draft email carries the buyer context, current site, budget posture, and the required confirmation checkpoints so the web-build conversation starts with real intent.",
      requestLabel: "Request CineFrame - open email draft",
      fields: [
        { name: "businessName", label: "Business name", type: "text", required: true, placeholder: "Business name" },
        { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Full name" },
        { name: "contactEmail", label: "Email", type: "email", required: true, placeholder: "Email" },
        { name: "contactPhone", label: "Phone", type: "tel", required: false, placeholder: "Phone" },
        { name: "website", label: "Current website or reference URL", type: "url", required: false, placeholder: "https://example.com" },
        { name: "context", label: "Primary market or buyer type", type: "text", required: true, placeholder: "What kind of buyers need to trust this site?" },
        { name: "budget", label: "Budget posture", type: "select", required: true, placeholder: "Choose budget posture", options: BUDGET_OPTIONS },
        { name: "timeline", label: "Desired launch window", type: "select", required: true, placeholder: "Choose timeline", options: TIMELINE_OPTIONS },
        { name: "notes", label: "What is the current site failing to do?", type: "textarea", required: false, placeholder: "Low trust, weak visuals, poor conversion, generic feel, weak service framing, or similar." }
      ],
      checkpoints: [
        {
          name: "confirmLane",
          title: "I understand this request is for the CineFrame lane and a premium trust-surface build.",
          copy: "This page is not intended for a generic contact submission or a vague redesign request."
        },
        {
          name: "confirmFlow",
          title: "I understand the conversation is about a website product with motion, structure, metadata, and launch discipline.",
          copy: "The goal is a production-grade web surface that carries authority and converts serious buyers better."
        },
        {
          name: "confirmFit",
          title: "I want a scoped CineFrame conversation tied directly to this page.",
          copy: "That keeps the request connected to the trust-surface offer instead of sending it through the broad contact route."
        }
      ],
      approvalTitle: "I approve generating the CineFrame request email draft.",
      approvalCopy: "The draft still needs to be reviewed and sent manually after it opens.",
      buildSummary(data, pageUrl) {
        return [
          "CineFrame Request Summary",
          "",
          "Business name: " + valueOrBlank(data.businessName),
          "Contact name: " + valueOrBlank(data.contactName),
          "Email: " + valueOrBlank(data.contactEmail),
          "Phone: " + valueOrBlank(data.contactPhone),
          "Current website or reference URL: " + valueOrBlank(data.website),
          "Primary market or buyer type: " + valueOrBlank(data.context),
          "Budget posture: " + valueOrBlank(data.budget),
          "Desired launch window: " + valueOrBlank(data.timeline),
          "",
          "Confirmation checkpoints",
          "1. CineFrame lane understood: " + yesNo(data.confirmLane),
          "2. Premium build scope understood: " + yesNo(data.confirmFlow),
          "3. Page-level intake requested: " + yesNo(data.confirmFit),
          "4. Manual email-send step understood: " + yesNo(data.submitAcknowledge),
          "5. Final request approval given: " + yesNo(data.submitApproval),
          "",
          "Priority notes",
          valueOrBlank(data.notes),
          "",
          "Source page: " + pageUrl,
          "",
          "This email serves as a direct CineFrame request from the SkyeFyve lane and is intended to start a premium web-build conversation without routing through the generic contact page."
        ].join("\n");
      }
    },
    "field-service-ops": {
      serviceName: "Field Service Ops",
      title: "Confirm the operator-system request from this page.",
      intro: "This intake keeps the request tied to the field-service operating lane. The draft email captures the business context, service environment, budget posture, and the confirmation checkpoints so the conversation starts around dispatch, scheduling, billing, and proof instead of a generic contact message.",
      requestLabel: "Request Field Service Ops - open email draft",
      fields: [
        { name: "businessName", label: "Business name", type: "text", required: true, placeholder: "Business name" },
        { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Full name" },
        { name: "contactEmail", label: "Email", type: "email", required: true, placeholder: "Email" },
        { name: "contactPhone", label: "Phone", type: "tel", required: false, placeholder: "Phone" },
        { name: "website", label: "Current website or booking URL", type: "url", required: false, placeholder: "https://example.com" },
        { name: "context", label: "Service territory or operating footprint", type: "text", required: true, placeholder: "Cities served, crew structure, or service territory" },
        { name: "budget", label: "Budget posture", type: "select", required: true, placeholder: "Choose budget posture", options: BUDGET_OPTIONS },
        { name: "timeline", label: "Desired start window", type: "select", required: true, placeholder: "Choose timeline", options: TIMELINE_OPTIONS },
        { name: "notes", label: "What is breaking in operations right now?", type: "textarea", required: false, placeholder: "Scheduling chaos, dispatch gaps, billing lag, weak closeout proof, or similar." }
      ],
      checkpoints: [
        {
          name: "confirmLane",
          title: "I understand this request is for the Field Service Ops lane, not a generic inquiry.",
          copy: "This page exists to start a conversation around the dispatch, scheduling, billing, and proof backbone."
        },
        {
          name: "confirmFlow",
          title: "I understand the service is about operational discipline and revenue flow, not vague digital transformation language.",
          copy: "The request should stay connected to the operator-system offer described on this page."
        },
        {
          name: "confirmFit",
          title: "I want a scoped Field Service Ops conversation tied directly to this page.",
          copy: "That keeps the intake attached to the vertical service lane and the actual operating problem."
        }
      ],
      approvalTitle: "I approve generating the Field Service Ops request email draft.",
      approvalCopy: "The draft still needs to be reviewed and sent manually after it opens.",
      buildSummary(data, pageUrl) {
        return [
          "Field Service Ops Request Summary",
          "",
          "Business name: " + valueOrBlank(data.businessName),
          "Contact name: " + valueOrBlank(data.contactName),
          "Email: " + valueOrBlank(data.contactEmail),
          "Phone: " + valueOrBlank(data.contactPhone),
          "Current website or booking URL: " + valueOrBlank(data.website),
          "Service territory or operating footprint: " + valueOrBlank(data.context),
          "Budget posture: " + valueOrBlank(data.budget),
          "Desired start window: " + valueOrBlank(data.timeline),
          "",
          "Confirmation checkpoints",
          "1. Field Service Ops lane understood: " + yesNo(data.confirmLane),
          "2. Operator-system scope understood: " + yesNo(data.confirmFlow),
          "3. Page-level intake requested: " + yesNo(data.confirmFit),
          "4. Manual email-send step understood: " + yesNo(data.submitAcknowledge),
          "5. Final request approval given: " + yesNo(data.submitApproval),
          "",
          "Priority notes",
          valueOrBlank(data.notes),
          "",
          "Source page: " + pageUrl,
          "",
          "This email serves as a direct Field Service Ops request from the SkyeFyve lane and is intended to start a scoped operator-system conversation without routing through the generic contact page."
        ].join("\n");
      }
    },
    "execsignin-pro": {
      serviceName: "ExecSignIn Pro",
      title: "Confirm the portal-access request on this page.",
      intro: "This intake keeps the request attached to the auth and portal-access lane. The draft email captures the business context, current surface, budget posture, and the confirmation checkpoints so the conversation starts around login, roles, and gated access instead of a broad contact message.",
      requestLabel: "Request ExecSignIn Pro - open email draft",
      fields: [
        { name: "businessName", label: "Business or product name", type: "text", required: true, placeholder: "Business or product name" },
        { name: "contactName", label: "Your name", type: "text", required: true, placeholder: "Full name" },
        { name: "contactEmail", label: "Email", type: "email", required: true, placeholder: "Email" },
        { name: "contactPhone", label: "Phone", type: "tel", required: false, placeholder: "Phone" },
        { name: "website", label: "Current portal or app URL", type: "url", required: false, placeholder: "https://example.com" },
        { name: "context", label: "Who needs access?", type: "text", required: true, placeholder: "Clients, members, staff, operators, admins, or mixed roles" },
        { name: "budget", label: "Budget posture", type: "select", required: true, placeholder: "Choose budget posture", options: BUDGET_OPTIONS },
        { name: "timeline", label: "Desired start window", type: "select", required: true, placeholder: "Choose timeline", options: TIMELINE_OPTIONS },
        { name: "notes", label: "What access problem needs to be solved first?", type: "textarea", required: false, placeholder: "Passwordless login, RBAC, portal launch, audit trail, internal dashboard access, or similar." }
      ],
      checkpoints: [
        {
          name: "confirmLane",
          title: "I understand this request is for the ExecSignIn Pro lane, not a generic portal inquiry.",
          copy: "This page exists to start a conversation around login, access control, and portal safety with a productized lane."
        },
        {
          name: "confirmFlow",
          title: "I understand the scope is about the auth layer, role handling, and audit-minded access control.",
          copy: "The request should stay connected to this page's specific portal-access posture."
        },
        {
          name: "confirmFit",
          title: "I want a scoped ExecSignIn Pro conversation tied directly to this page.",
          copy: "That keeps the intake attached to the right service lane instead of dropping it into the broad contact route."
        }
      ],
      approvalTitle: "I approve generating the ExecSignIn Pro request email draft.",
      approvalCopy: "The draft still needs to be reviewed and sent manually after it opens.",
      buildSummary(data, pageUrl) {
        return [
          "ExecSignIn Pro Request Summary",
          "",
          "Business or product name: " + valueOrBlank(data.businessName),
          "Contact name: " + valueOrBlank(data.contactName),
          "Email: " + valueOrBlank(data.contactEmail),
          "Phone: " + valueOrBlank(data.contactPhone),
          "Current portal or app URL: " + valueOrBlank(data.website),
          "Who needs access: " + valueOrBlank(data.context),
          "Budget posture: " + valueOrBlank(data.budget),
          "Desired start window: " + valueOrBlank(data.timeline),
          "",
          "Confirmation checkpoints",
          "1. ExecSignIn Pro lane understood: " + yesNo(data.confirmLane),
          "2. Auth scope understood: " + yesNo(data.confirmFlow),
          "3. Page-level intake requested: " + yesNo(data.confirmFit),
          "4. Manual email-send step understood: " + yesNo(data.submitAcknowledge),
          "5. Final request approval given: " + yesNo(data.submitApproval),
          "",
          "Priority notes",
          valueOrBlank(data.notes),
          "",
          "Source page: " + pageUrl,
          "",
          "This email serves as a direct ExecSignIn Pro request from the SkyeFyve lane and is intended to start a scoped portal-access conversation without routing through the generic contact page."
        ].join("\n");
      }
    }
  };

  function yesNo(value) {
    return value ? "Yes" : "No";
  }

  function valueOrBlank(value) {
    return value ? String(value).trim() : "";
  }

  function nowStamp() {
    return new Date().toLocaleString();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderField(field) {
    const requiredAttr = field.required ? ' data-required="true"' : "";
    const shared = ' data-sf-field="' + escapeHtml(field.name) + '"';
    const label = '<label class="sf-form-label" for="sf-' + escapeHtml(field.name) + '">' + escapeHtml(field.label) + (field.required ? ' <span>*</span>' : '') + '</label>';

    if (field.type === "textarea") {
      return '<div class="sf-field sf-field-full">' +
        label +
        '<textarea id="sf-' + escapeHtml(field.name) + '" placeholder="' + escapeHtml(field.placeholder || "") + '"' + shared + requiredAttr + '></textarea>' +
      '</div>';
    }

    if (field.type === "select") {
      const options = ['<option value="">' + escapeHtml(field.placeholder || "Choose one") + '</option>']
        .concat((field.options || []).map(option => '<option value="' + escapeHtml(option) + '">' + escapeHtml(option) + '</option>'))
        .join("");
      return '<div class="sf-field">' +
        label +
        '<select id="sf-' + escapeHtml(field.name) + '"' + shared + requiredAttr + '>' + options + '</select>' +
      '</div>';
    }

    return '<div class="sf-field">' +
      label +
      '<input id="sf-' + escapeHtml(field.name) + '" type="' + escapeHtml(field.type) + '" placeholder="' + escapeHtml(field.placeholder || "") + '"' + shared + requiredAttr + ' />' +
    '</div>';
  }

  function renderCheckpoint(checkpoint) {
    return '<div class="sf-checkrow">' +
      '<input type="checkbox" id="sf-' + escapeHtml(checkpoint.name) + '" data-sf-field="' + escapeHtml(checkpoint.name) + '" data-required="true" />' +
      '<div>' +
        '<strong>' + escapeHtml(checkpoint.title) + '</strong>' +
        '<div class="sf-small">' + escapeHtml(checkpoint.copy) + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderMarkup(config) {
    return [
      '<div class="sf-intake-shell" id="request-intake">',
      '  <div class="sf-section-label">Direct request flow</div>',
      '  <h2 class="sf-section-title">' + escapeHtml(config.title) + '</h2>',
      '  <p class="sf-section-intro">' + escapeHtml(config.intro) + '</p>',
      '  <div class="sf-intake-note">',
      '    <strong>What happens here</strong>',
      '    <div class="sf-small">Complete the fields, confirm the checkpoints, and open a prefilled email draft that sends directly to Skyes Over London. The draft still needs to be reviewed and sent manually.</div>',
      '  </div>',
      '  <div class="sf-form-grid">',
           config.fields.map(renderField).join(""),
      '  </div>',
      '  <div class="sf-checklist-stack">',
           config.checkpoints.map(renderCheckpoint).join(""),
      '    <div class="sf-checkrow">',
      '      <input type="checkbox" id="sf-submitAcknowledge" data-sf-field="submitAcknowledge" data-required="true" />',
      '      <div>',
      '        <strong>I understand the email draft still needs to be sent manually after it opens.</strong>',
      '        <div class="sf-small">Depending on the device, the draft may open in a browser tab, mail app, or default email composer.</div>',
      '      </div>',
      '    </div>',
      '    <div class="sf-checkrow">',
      '      <input type="checkbox" id="sf-submitApproval" data-sf-field="submitApproval" data-required="true" />',
      '      <div>',
      '        <strong>' + escapeHtml(config.approvalTitle) + '</strong>',
      '        <div class="sf-small">' + escapeHtml(config.approvalCopy) + '</div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <div class="sf-savebar">',
      '    <button class="sf-btn" type="button" data-action="save">Save responses</button>',
      '    <button class="sf-btn sf-btn-primary" type="button" data-action="email">' + escapeHtml(config.requestLabel) + '</button>',
      '    <button class="sf-btn" type="button" data-action="download">Download responses</button>',
      '    <span class="sf-saved-pill" data-saved-pill>Not saved yet</span>',
      '  </div>',
      '  <div class="sf-footer-note">This page stores the request locally in the browser so it can be reviewed, reopened, and turned into a direct email draft when ready.</div>',
      '</div>'
    ].join("");
  }

  function initRoot(root) {
    const serviceKey = root.getAttribute("data-service-key");
    const config = CONFIG[serviceKey];
    if (!config) return;

    root.innerHTML = renderMarkup(config);

    const storageKey = "skyefyve_intake_" + serviceKey + "_v1";
    const fields = Array.from(root.querySelectorAll("[data-sf-field]"));
    const savedPill = root.querySelector("[data-saved-pill]");
    const saveButton = root.querySelector('[data-action="save"]');
    const emailButton = root.querySelector('[data-action="email"]');
    const downloadButton = root.querySelector('[data-action="download"]');

    function readData() {
      const data = {};
      fields.forEach(field => {
        const name = field.getAttribute("data-sf-field");
        data[name] = field.type === "checkbox" ? field.checked : field.value;
      });
      data.savedAt = nowStamp();
      return data;
    }

    function persist() {
      const merged = Object.assign({}, JSON.parse(localStorage.getItem(storageKey) || "{}"), readData());
      localStorage.setItem(storageKey, JSON.stringify(merged));
      refreshSavedPill();
    }

    function restore() {
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      fields.forEach(field => {
        const name = field.getAttribute("data-sf-field");
        if (data[name] === undefined) return;
        if (field.type === "checkbox") {
          field.checked = !!data[name];
        } else {
          field.value = data[name];
        }
      });
      refreshSavedPill();
    }

    function refreshSavedPill() {
      if (!savedPill) return;
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      savedPill.textContent = data.savedAt ? "Saved " + data.savedAt : "Not saved yet";
    }

    function validate() {
      for (const field of fields) {
        if (field.getAttribute("data-required") !== "true") continue;
        const okay = field.type === "checkbox" ? field.checked : field.value.trim();
        if (okay) continue;
        alert("Please complete all required confirmation and request fields before opening the email draft.");
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        field.focus?.();
        return false;
      }
      return true;
    }

    function openEmailDraft() {
      if (!validate()) return;
      persist();
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const pageUrl = window.location.href;
      const subjectBase = config.serviceName + " request - " + (data.businessName || data.contactName || "SkyeFyve");
      const subject = encodeURIComponent(subjectBase);
      const body = encodeURIComponent(config.buildSummary(data, pageUrl));
      window.location.href = "mailto:" + encodeURIComponent(EMAIL_TO) + "?subject=" + subject + "&body=" + body;
      setTimeout(() => {
        alert("The email draft has been opened in your default email flow if your device supports it. Please review it and press Send.");
      }, 250);
    }

    function downloadJson() {
      persist();
      const data = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = storageKey + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    fields.forEach(field => {
      field.addEventListener("change", persist);
      if (field.tagName === "TEXTAREA" || field.tagName === "SELECT" || field.type !== "checkbox") {
        field.addEventListener("blur", persist);
      }
    });

    saveButton?.addEventListener("click", persist);
    emailButton?.addEventListener("click", openEmailDraft);
    downloadButton?.addEventListener("click", downloadJson);
    restore();
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".sf-intake-root[data-service-key]").forEach(initRoot);
  });
})();