exports.handler = async (event) => {
  try {
    const { user } = JSON.parse(event.body);

    // Default roles to assign
    const roles = ["client"];

    // Assign elevated roles to internal users
    if (user.email.endsWith("@solenterprises.org") || user.email === "skyesoverlondon@gmail.com") {
      roles.push("admin", "ops");
    }

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
