import {
  AnalysisModelClient,
  createAnalysisTaskInputSchema
} from "@ai-pr-reviewer/core";
import { GitHubClient } from "@ai-pr-reviewer/github";
import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AnalysisTaskRepository } from "./repository";
import { AnalysisService, PullRequestSnapshotUnavailableError } from "./service";

type AnalysisRouteOptions = {
  repository: AnalysisTaskRepository;
  githubClient: GitHubClient;
  reviewModelClient: AnalysisModelClient;
};

export const analysisRoutes: FastifyPluginAsync<AnalysisRouteOptions> = async (app, options) => {
  const analysisService = new AnalysisService(options);

  app.post("/", async (request, reply) => {
    const body = createAnalysisTaskInputSchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({
        message: "Invalid analysis task request.",
        issues: body.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      });
    }

    try {
      const task = await analysisService.createTask(body.data);

      return reply.code(201).send(task);
    } catch (error) {
      app.log.warn(toSafeErrorLog(error), "Failed to create analysis task.");

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          message: "Invalid GitHub pull request URL.",
          issues: error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message
          }))
        });
      }

      if (error instanceof Error && error.message.includes("GitHub pull request")) {
        return reply.code(400).send({
          message: error.message
        });
      }

      return reply.code(502).send({
        message: "Failed to fetch pull request data from GitHub."
      });
    }
  });

  app.get("/:taskId", async (request, reply) => {
    const params = z.object({ taskId: z.string().min(1) }).parse(request.params);
    const task = await analysisService.getTask(params.taskId);

    if (!task) {
      return reply.code(404).send({
        message: "Analysis task was not found."
      });
    }

    return task;
  });

  app.get("/:taskId/report", async (request, reply) => {
    const params = z.object({ taskId: z.string().min(1) }).parse(request.params);

    try {
      const report = await analysisService.getReport(params.taskId);

      if (!report) {
        return reply.code(404).send({
          message: "Analysis task was not found."
        });
      }

      return report;
    } catch (error) {
      if (error instanceof PullRequestSnapshotUnavailableError) {
        return reply.code(409).send({
          message: "Pull request snapshot is not available for this analysis task."
        });
      }

      throw error;
    }
  });
};

function toSafeErrorLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    message: "Unknown error"
  };
}
