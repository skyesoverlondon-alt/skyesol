import { ensureSeed, forbidden, getUser, isAdmin, json } from "./_common.mjs";

export const handler = async (event, context) => {
  await ensureSeed();

  const user = getUser(context);
  if (!user) return forbidden("Missing Identity token");
  if (!isAdmin(user)) return forbidden("Not an admin");

  return json(200, {
    ok: true,
    email: user.email,
    roles: user.app_metadata?.roles || [],
  });
};
