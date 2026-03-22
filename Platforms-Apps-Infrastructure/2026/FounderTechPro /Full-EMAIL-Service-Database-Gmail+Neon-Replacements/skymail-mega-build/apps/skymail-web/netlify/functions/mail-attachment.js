const { verifyAuth } = require('./_utils');
const { attachmentByRef } = require('./_mailbox');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return { statusCode:405, body:'Method not allowed.' };
    const auth = verifyAuth(event);
    const qs = event.queryStringParameters || {};
    const id = String(qs.id || '').trim();
    const attachmentId = String(qs.attachmentId || '0').trim();
    if (!id) return { statusCode:400, body:'id required.' };
    const { attachment, content } = await attachmentByRef(auth.sub, id, attachmentId);
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': attachment.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.filename || 'attachment')}"`,
        'Cache-Control': 'no-store',
      },
      body: content.toString('base64'),
    };
  } catch (err) {
    return { statusCode: err.statusCode || 500, body: err.message || 'Server error' };
  }
};
