export default function handler(req, res) {
  const clientId = process.env.QF_CLIENT_ID || "";
  const clientSecret = process.env.QF_CLIENT_SECRET || "";

  return res.status(200).json({
    clientIdExists: Boolean(clientId),
    clientSecretExists: Boolean(clientSecret),

    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length,

    clientIdStartsWithSpace: clientId.startsWith(" "),
    clientIdEndsWithSpace: clientId.endsWith(" "),

    clientSecretStartsWithSpace: clientSecret.startsWith(" "),
    clientSecretEndsWithSpace: clientSecret.endsWith(" "),

    clientSecretContainsSpace: clientSecret.includes(" "),
    clientSecretContainsNewline:
      clientSecret.includes("\n") || clientSecret.includes("\r"),
  });
}