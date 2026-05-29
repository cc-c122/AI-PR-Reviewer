import fastifyStatic from "@fastify/static";
import { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const webDistPath = path.resolve(currentDirectory, "../../web/dist");
const webIndexPath = path.join(webDistPath, "index.html");

export async function registerStaticWeb(app: FastifyInstance): Promise<void> {
  if (!existsSync(webIndexPath)) {
    app.log.warn({ webDistPath }, "Web dist was not found; static frontend serving is disabled.");
    return;
  }

  await app.register(fastifyStatic, {
    root: webDistPath,
    prefix: "/",
    index: "index.html"
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({
        message: "Route not found."
      });
    }

    const indexHtml = await readFile(webIndexPath, "utf8");
    return reply.type("text/html").send(indexHtml);
  });
}
