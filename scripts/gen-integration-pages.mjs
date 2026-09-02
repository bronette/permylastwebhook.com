#!/usr/bin/env node
/**
 * Generate SEO landing pages: one per CI/CD platform + a hub, under site/integrations/.
 * Each targets high-intent search ("<platform> Teams notifications") with platform-specific
 * setup and a card preview. Source of truth is the PLATFORMS table below — edit here, not
 * the generated HTML. Re-run: `npm run gen:integrations`, then `npm run site:build`.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..", "site");

const PLATFORMS = [
  {
    slug: "github-actions", name: "GitHub Actions", short: "GitHub",
    tag: "Turn GitHub Actions workflow runs into rich Teams cards — no more scraping the Actions tab.",
    setup: [
      "Repo → <strong>Settings → Webhooks → Add webhook</strong>.",
      "<strong>Payload URL</strong>: your subscription's ingest URL · <strong>Content type</strong>: <code>application/json</code>.",
      "Events → <em>Let me select individual events</em> → check <strong>Workflow runs</strong> only.",
      "Add webhook. Prefer org-wide? Set it at <strong>Org → Settings → Webhooks</strong>.",
    ],
    cardTitle: "CI", branch: "main",
  },
  {
    slug: "gitlab", name: "GitLab CI/CD", short: "GitLab",
    tag: "Pipeline and deployment events from GitLab, delivered to the right Teams channel.",
    setup: [
      "Project (or Group) → <strong>Settings → Webhooks</strong>.",
      "<strong>URL</strong>: your ingest URL.",
      "<strong>Triggers</strong>: <em>Pipeline events</em> and <em>Deployment events</em>.",
      "Keep SSL verification on → <strong>Add webhook</strong>.",
    ],
    cardTitle: "build", branch: "main",
  },
  {
    slug: "jenkins", name: "Jenkins", short: "Jenkins",
    tag: "Jenkins job results in Teams via the standard Notification Plugin — no scripting required.",
    setup: [
      "Install the <strong>Notification Plugin</strong> (Manage Plugins).",
      "Job → <strong>Configure → Job Notifications → Add Endpoint</strong>.",
      "<strong>Format</strong> JSON · <strong>Protocol</strong> HTTP · <strong>Event</strong> <em>Job Finalized</em>.",
      "<strong>URL</strong>: your ingest URL. Save.",
    ],
    cardTitle: "build-service", branch: "main",
  },
  {
    slug: "azure-devops", name: "Azure DevOps", short: "Azure DevOps",
    tag: "Azure Pipelines run results in Teams via Service Hooks — YAML or classic builds.",
    setup: [
      "Project → <strong>Project Settings → Service Hooks → New Subscription → Web Hooks</strong>.",
      "<strong>Trigger</strong>: <em>Run state changed</em> (YAML) or <em>Build completed</em> (classic).",
      "<strong>URL</strong>: your ingest URL. Optionally filter by pipeline/branch/state.",
      "Save.",
    ],
    cardTitle: "Pipeline", branch: "main",
  },
  {
    slug: "bitbucket", name: "Bitbucket Pipelines", short: "Bitbucket",
    tag: "Bitbucket Pipelines build statuses, delivered as clean Teams cards.",
    setup: [
      "Repo → <strong>Repository settings → Webhooks → Add webhook</strong>.",
      "<strong>URL</strong>: your ingest URL.",
      "<strong>Triggers → Build</strong>: <em>Commit status created</em> and <em>updated</em>.",
      "Save.",
    ],
    cardTitle: "pipeline", branch: "main",
  },
  {
    slug: "circleci", name: "CircleCI", short: "CircleCI",
    tag: "CircleCI workflow results in Teams, with HMAC-signed webhook verification.",
    setup: [
      "Project → <strong>Project Settings → Webhooks</strong>.",
      "<strong>Webhook URL</strong>: your ingest URL.",
      "<strong>Events</strong>: <em>workflow-completed</em> (recommended).",
      "Save.",
    ],
    cardTitle: "workflow", branch: "main",
  },
  {
    slug: "buildkite", name: "Buildkite", short: "Buildkite",
    tag: "Buildkite build events, normalized into Teams cards alongside every other platform.",
    setup: [
      "<strong>Organization settings → Notification services → Add Webhook</strong>.",
      "<strong>Webhook URL</strong>: your ingest URL.",
      "Pick the build events you want delivered.",
      "Save.",
    ],
    cardTitle: "pipeline", branch: "main",
  },
  {
    slug: "argo-cd", name: "Argo CD", short: "Argo CD",
    tag: "Argo CD sync and health events, delivered to Teams as deployment cards.",
    setup: [
      "Create a subscription (platform <strong>Argo CD</strong>) and copy its ingest URL.",
      "In Argo CD's <code>argocd-notifications-cm</code>, add a <strong>webhook service</strong> pointing at the ingest URL.",
      "Add a <strong>template</strong> that POSTs the app name, sync + health status, and revision as JSON (see the <a href=\"/docs/platforms.html#argocd\">reference</a>).",
      "Subscribe your Applications to triggers like <em>on-sync-succeeded</em> / <em>on-health-degraded</em>.",
    ],
    cardTitle: "guestbook", branch: "prod",
  },
  {
    slug: "teamcity", name: "TeamCity", short: "TeamCity",
    tag: "TeamCity build results in Teams — via a native webhook or the tcWebHooks plugin.",
    setup: [
      "Create a subscription (platform <strong>TeamCity</strong>) and copy its ingest URL.",
      "In TeamCity, add a <strong>webhook</strong> (native build feature, or the tcWebHooks plugin) pointing at the ingest URL.",
      "Use a JSON template that posts the build name, number, result, branch, and commit (see the <a href=\"/docs/platforms.html#teamcity\">reference</a>).",
      "Run a build → the card lands.",
    ],
    cardTitle: "Widgets :: Build", branch: "main",
  },
  {
    slug: "datadog", name: "Datadog", short: "Datadog",
    tag: "Datadog monitor alerts in Teams — routed, deduped, and escalated like any other event.",
    setup: [
      "Create a subscription (platform <strong>Datadog</strong>) and copy its ingest URL.",
      "In Datadog → <strong>Integrations → Webhooks</strong>, add a webhook with that URL.",
      "Set the <strong>Payload</strong> to JSON using Datadog $VARIABLES — title, alert status, link (see the <a href=\"/docs/platforms.html#datadog\">reference</a>).",
      "Add <code>@webhook-&lt;name&gt;</code> to the monitor's notification message.",
    ],
    cardTitle: "High error rate", branch: "prod",
  },
  {
    slug: "grafana", name: "Grafana", short: "Grafana",
    tag: "Grafana alerts in Teams — firing and resolved, routed and deduped like any other event.",
    setup: [
      "Create a subscription (platform <strong>Grafana</strong>) and copy its ingest URL.",
      "Grafana → <strong>Alerting → Contact points → Add contact point</strong>, type <strong>Webhook</strong>.",
      "Set the URL to your ingest URL — Grafana's fixed webhook payload is normalized as-is (no template).",
      "Attach the contact point to a notification policy.",
    ],
    cardTitle: "High latency on api", branch: "prod",
  },
  {
    slug: "drone", name: "Drone CI", short: "Drone",
    tag: "Drone CI build results in Teams — a fixed payload, zero template config.",
    setup: [
      "Create a subscription (platform <strong>Drone</strong>) and copy its ingest URL.",
      "Add a <strong>webhook</strong> (global or per-repo) pointing at the ingest URL.",
      "Drone's fixed build-event payload is normalized automatically — no template needed.",
      "Push a commit → the card lands.",
    ],
    cardTitle: "acme/widgets", branch: "main",
  },
  {
    slug: "sentry", name: "Sentry", short: "Sentry",
    tag: "Sentry issues and alerts in Teams — errors surfaced where your team already is.",
    setup: [
      "Create a subscription (platform <strong>Sentry</strong>) and copy its ingest URL.",
      "In Sentry, add an <strong>Alert rule</strong> with a webhook / internal-integration action.",
      "Point it at the ingest URL with a JSON body (title, level, project — see the <a href=\"/docs/platforms.html#sentry\">reference</a>).",
      "Trigger the alert → the card lands.",
    ],
    cardTitle: "TypeError in checkout", branch: "prod",
  },
  {
    slug: "pagerduty", name: "PagerDuty", short: "PagerDuty",
    tag: "PagerDuty incidents in Teams — triggered, acknowledged, and resolved, in the channel.",
    setup: [
      "Create a subscription (platform <strong>PagerDuty</strong>) and copy its ingest URL.",
      "PagerDuty → <strong>Integrations → Generic Webhooks (v3) → New Webhook</strong>.",
      "Set the <strong>Webhook URL</strong> to your ingest URL and subscribe to incident events — the v3 payload is normalized as-is.",
      "Trigger a test incident → the card lands.",
    ],
    cardTitle: "Database down", branch: "prod",
  },
  {
    slug: "alertmanager", name: "Prometheus Alertmanager", short: "Alertmanager",
    tag: "Prometheus Alertmanager alerts in Teams — firing and resolved, no template config.",
    setup: [
      "Create a subscription (platform <strong>Alertmanager</strong>) and copy its ingest URL.",
      "In your Alertmanager config, add a receiver with a <code>webhook_configs</code> entry.",
      "Set <code>url</code> to your ingest URL — the fixed payload is normalized as-is (no template).",
      "Route the alerts you want to that receiver.",
    ],
    cardTitle: "TargetDown", branch: "prod",
  },
  {
    slug: "octopus-deploy", name: "Octopus Deploy", short: "Octopus",
    tag: "Octopus Deploy deployment results in Teams — a favorite of Microsoft-stack teams.",
    setup: [
      "Create a subscription (platform <strong>Octopus</strong>) and copy its ingest URL.",
      "Octopus → <strong>Configuration → Subscriptions</strong> → add a subscription for deployment events with a webhook to the ingest URL.",
      "Post a JSON body with project, environment, release, and state (see the <a href=\"/docs/platforms.html#octopus\">reference</a>).",
      "Deploy → the card lands.",
    ],
    cardTitle: "Web Storefront", branch: "Production",
  },
  {
    slug: "generic-webhook", name: "Any JSON Webhook", short: "Generic",
    tag: "Datadog, custom scripts, home-grown CI — anything that POSTs JSON becomes a Teams card.",
    setup: [
      "Create a subscription with platform <strong>generic</strong>.",
      "Add a <strong>field mapping</strong> (which JSON paths map to title / status / link).",
      "Point your tool's webhook at the ingest URL.",
      "Fire an event → card lands.",
    ],
    cardTitle: "job", branch: "main",
  },
];

function head(title, desc, canonical, depth) {
  const up = "../".repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="https://permylastwebhook.com/${canonical}" />
<link rel="icon" href="${up}favicon.png" type="image/png" sizes="32x32" />
<link rel="stylesheet" href="${up}styles.css" />
<link rel="stylesheet" href="${up}docs/docs.css" />
</head>
<body>
<header class="site-header">
  <a class="brand" href="/"><img src="${up}logo-mark.svg" alt="" width="32" height="32" /><span>Per My Last Webhook</span></a>
  <nav class="site-nav">
    <a href="/#features">Features</a><a href="/docs/">Docs</a><a href="/integrations/">Integrations</a>
    <a href="/#install">Install</a><a class="nav-cta" href="{{GITHUB_APP_URL}}">GitHub</a>
  </nav>
</header>`;
}

const foot = (seg) => `<div class="taskbar"><span class="start">▣ Start</span><span class="seg">PER MY LAST WEBHOOK</span><span class="seg">${seg}</span><span class="clock">Status: 200 OK</span></div>
</body>
</html>
`;

function platformPage(p) {
  const title = `${p.name} → Microsoft Teams Notifications · Per My Last Webhook`;
  const desc = `Send ${p.name} build and pipeline notifications to Microsoft Teams as rich Adaptive Cards. ${p.tag} Free to start.`;
  const steps = p.setup.map((s, i) => `<div class="step"><div class="num">${i + 1}</div><div class="body"><p>${s}</p></div></div>`).join("\n      ");
  return `${head(title, desc, `integrations/${p.slug}/`, 2)}
<div class="docs-shell">
  <main class="docs-content" style="max-width:820px;margin:0 auto">
    <div class="crumbs"><a href="/integrations/">Integrations</a> / ${p.short}</div>
    <h1>${p.name} notifications in Microsoft&nbsp;Teams</h1>
    <p class="lede">${p.tag} Per My Last Webhook normalizes ${p.short} events into rich Adaptive Cards and posts them to a Teams channel, a person's DM, or a webhook — the successor to Office&nbsp;365 Connectors.</p>
    <div class="cta-row">
      <a class="btn btn-primary" href="/#install">Install for Teams</a>
      <a class="btn btn-ghost" href="/docs/getting-started.html">Read the guide</a>
    </div>

    <h2>How it works</h2>
    <ol>
      <li><strong>${p.short}</strong> POSTs a webhook to your private ingest URL when a build runs.</li>
      <li>We <strong>normalize</strong> it — the same card format as every other platform.</li>
      <li>The card lands in your chosen <strong>Teams destination</strong>, with routing and noise controls applied.</li>
    </ol>

    <h2>Set up in minutes</h2>
    <p>Create a subscription in the app (platform: <strong>${p.short}</strong>), copy its ingest URL, then:</p>
      ${steps}
    <div class="callout tip"><div class="bar">See it instantly</div><div class="inner"><p>Don't want to wait for a build? Hit <strong>Test</strong> on the subscription — a card lands immediately. Full steps in the <a href="/docs/platforms.html#${p.slug === "github-actions" ? "github" : p.slug === "azure-devops" ? "ado" : p.slug === "argo-cd" ? "argocd" : p.slug === "octopus-deploy" ? "octopus" : p.slug === "generic-webhook" ? "generic" : p.slug}">platform reference</a>.</p></div></div>

    <h2>What lands in Teams</h2>
    <div class="card-window">
      <div class="card-window-bar">Teams · #ci</div>
      <div class="card-window-body">
        <strong>🔴 ${p.cardTitle} · failure</strong><br />
        <span class="muted small">${p.short} · ${p.branch} · alice · 3m 20s</span>
      </div>
    </div>

    <h2>Built for teams, not just alerts</h2>
    <div class="next-grid">
      <div class="card"><h3>Routing <span class="pill-pro">PRO</span></h3><p>Prod failures to #prod-alerts, the rest to #ci.</p></div>
      <div class="card"><h3>Incident mode <span class="pill-pro">PRO</span></h3><p>Collapse a flapping pipeline into one updating card.</p></div>
      <div class="card"><h3>On-call DMs <span class="pill-pro">PRO</span></h3><p>DM the owner the moment their ${p.short} build breaks.</p></div>
      <div class="card"><h3>Status filters</h3><p>Only care about failures? Filter to just those — free.</p></div>
    </div>

    <div class="cta-row" style="margin-top:1.5rem">
      <a class="btn btn-primary" href="/#install">Install for Teams — free</a>
      <a class="btn btn-ghost" href="/integrations/">All integrations</a>
    </div>
    <p class="muted small">Part of Per My Last Webhook — <a href="/integrations/">all ${PLATFORMS.length} integrations</a> into one Teams app.</p>
  </main>
</div>
${foot(`C:\\INTEGRATIONS\\${p.short.toUpperCase()}`)}`;
}

function hubPage() {
  const cards = PLATFORMS.map((p) => `<a class="card" href="/integrations/${p.slug}/"><h3>${p.name}</h3><p>${p.tag}</p></a>`).join("\n      ");
  return `${head("Integrations · Per My Last Webhook", "Connect GitHub Actions, GitLab, Jenkins, Azure DevOps, Bitbucket, CircleCI, Buildkite, Argo CD, TeamCity, Datadog, Grafana, Drone, Sentry, PagerDuty, Alertmanager, Octopus Deploy, or any JSON webhook to Microsoft Teams — rich CI/CD, GitOps, observability &amp; incident notifications, one app.", "integrations/", 1)}
<div class="docs-shell">
  <main class="docs-content" style="max-width:900px;margin:0 auto">
    <div class="crumbs">Integrations</div>
    <h1>Integrations</h1>
    <p class="lede">Sixteen CI/CD and observability platforms, plus any JSON webhook — one Teams app. Pick your source for setup steps.</p>
    <style>.next-grid a.card{display:block;color:inherit}.next-grid a.card:hover{text-decoration:none;border-color:var(--purple)}.next-grid a.card h3{color:var(--purple-d)}</style>
    <div class="next-grid">
      ${cards}
    </div>
    <div class="cta-row" style="margin-top:1.5rem"><a class="btn btn-primary" href="/#install">Install for Teams</a><a class="btn btn-ghost" href="/docs/">Read the docs</a></div>
  </main>
</div>
${foot("C:\\INTEGRATIONS")}`;
}

let n = 0;
await mkdir(join(siteDir, "integrations"), { recursive: true });
await writeFile(join(siteDir, "integrations", "index.html"), hubPage());
n++;
for (const p of PLATFORMS) {
  await mkdir(join(siteDir, "integrations", p.slug), { recursive: true });
  await writeFile(join(siteDir, "integrations", p.slug, "index.html"), platformPage(p));
  n++;
}
console.log(`✓ Generated ${n} integration pages under site/integrations/ (hub + ${PLATFORMS.length} platforms)`);
console.log("Next: npm run site:build");
