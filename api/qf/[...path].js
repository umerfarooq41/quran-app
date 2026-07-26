import { qfRequest } from "../../server/qf-core.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const pathValue = req.query.path;

    const path = Array.isArray(pathValue)
      ? pathValue.join("/")
      : String(pathValue || "");

    if (!path) {
      return res.status(400).json({
        error: "Missing Quran Foundation API path",
      });
    }

    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;

      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, item));
      } else if (value !== undefined) {
        query.set(key, value);
      }
    }

    const queryString = query.toString();

    const upstream = await qfRequest(
      `/${path}${queryString ? `?${queryString}` : ""}`,
      process.env,
    );

    res.status(upstream.status);
    res.setHeader(
      "Content-Type",
      upstream.contentType || "application/json",
    );

    if (upstream.ok) {
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=86400, stale-while-revalidate=604800",
      );
    }

    return res.send(upstream.body);
  } catch (error) {
    console.error("Quran Foundation proxy error:", error);

    return res.status(500).json({
      error: "Quran Foundation request failed",
      message: error?.message || "Unknown error",
    });
  }
}