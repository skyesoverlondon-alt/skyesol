
const { json } = require('./_utils');
const { allowedDomains, primaryDomain } = require('./_mailbox');

exports.handler = async () => json(200, { ok:true, domains: allowedDomains(), primary_domain: primaryDomain() });
