exports.handler = async (event) => {
  try {
    const { user } = JSON.parse(event.body);

    // Default roles to assign
    const roles = ["client"];

    // Optionally check email domain or metadata for "admin" or "ops"
    // if (user.email.endsWith("@solenterprises.org")) {
    //   roles.push("admin", "ops");
    // }

    return {
      statusCode: 200,
      body: JSON.stringify({
        app_metadata: {
          roles: roles,
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid request body" }),
    };
  }
};
