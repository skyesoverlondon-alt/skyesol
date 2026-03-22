const { ok, serverError } = require('./_shared/http');
const { query } = require('./_shared/db');

exports.handler = async function(){
  try{
    const result = await query(
      `select id, lane, category, title, body, district, author_name, author_role, created_at
       from skyespace_posts
       order by created_at desc
       limit 24`
    );
    return ok({ ok:true, feed: result.rows.map(row => ({
      id: row.id,
      lane: row.lane,
      type: row.lane === 'feed' ? (row.category || 'Post') : row.lane,
      category: row.category,
      title: row.title,
      text: row.body,
      district: row.district,
      author: row.author_name,
      role: row.author_role,
      createdAt: row.created_at
    })) });
  }catch(error){
    return serverError(error);
  }
};
