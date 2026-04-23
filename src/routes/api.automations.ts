/**
 * GET /api/automations
 *
 * Returns the catalog of automations available to "Automated step" nodes.
 * This replaces the inline mock and would be backed by a real service in
 * production. We keep the shape identical to AutomationDefinition so the
 * client side stays untouched.
 */
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const AUTOMATIONS = [
  { id: "send_email", label: "Send Email", params: ["to", "subject", "body"] },
  {
    id: "generate_doc",
    label: "Generate Document",
    params: ["template", "recipient"],
  },
  {
    id: "create_account",
    label: "Provision IT Account",
    params: ["employeeId", "department"],
  },
  { id: "post_slack", label: "Post to Slack", params: ["channel", "message"] },
  {
    id: "schedule_meeting",
    label: "Schedule Meeting",
    params: ["attendees", "duration"],
  },
];

export const Route = createFileRoute("/api/automations")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async () =>
        new Response(JSON.stringify({ automations: AUTOMATIONS }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }),
    },
  },
});
