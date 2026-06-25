import React from "react";
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiListGroup,
  EuiListGroupItem,
  EuiPanel,
  EuiStat,
  EuiText,
  EuiTitle,
  EuiSpacer,
  EuiBadge,
  EuiBasicTable,
  EuiCallOut,
} from "@elastic/eui";
import type {
  AiMlInfo,
  FeatureInfo,
  AnomalyJob,
  TrainedModel,
  DFAJob,
  MLNodeMemory,
  DenseVectorDimGroup,
} from "../parsers/types";
import { formatBytes, formatCount } from "../utils/format";
import { getModelHint } from "../utils/modelHints";

interface Props {
  aiMl: AiMlInfo;
  features: FeatureInfo | null;
}

// ── Guards and status ─────────────────────────────────────────────────────────

function significantModels(models: TrainedModel[]): TrainedModel[] {
  return models.filter((m) => m.modelClass !== "lang_ident");
}

function hasAnything(aiMl: AiMlInfo, features: FeatureInfo | null): boolean {
  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0);
  return (
    aiMl.anomalyJobs.length > 0 ||
    significantModels(aiMl.trainedModels).length > 0 ||
    aiMl.dfaJobs.length > 0 ||
    semanticCount > 0 ||
    aiMl.aiFeatures.hasSecurityAiAssistant ||
    aiMl.aiFeatures.hasObservabilityAiAssistant ||
    aiMl.aiFeatures.hasChatAgents ||
    aiMl.aiFeatures.inferenceEndpointCount > 0
  );
}

type EuiBadgeColor = "success" | "danger" | "default";
type StatusInfo = { label: string; color: EuiBadgeColor };

function getStatus(aiMl: AiMlInfo, features: FeatureInfo | null): StatusInfo {
  const hasIssues =
    aiMl.anomalyJobs.some(
      (j) => j.state === "failed" || j.memoryStatus === "hard_limit",
    ) ||
    significantModels(aiMl.trainedModels).some(
      (m) => m.deploymentState === "failed",
    );
  if (hasIssues) return { label: "Issues Detected", color: "danger" };

  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0);
  const isActive =
    aiMl.anomalyJobs.some((j) => j.state === "opened") ||
    significantModels(aiMl.trainedModels).some((m) => m.deployed) ||
    semanticCount > 0 ||
    aiMl.aiFeatures.hasSecurityAiAssistant ||
    aiMl.aiFeatures.hasObservabilityAiAssistant ||
    aiMl.aiFeatures.hasChatAgents;
  if (isActive) return { label: "Active", color: "success" };

  return { label: "Licensed", color: "default" };
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function modelClassLabel(m: TrainedModel): string {
  const labels: Record<string, string> = {
    elser: "ELSER",
    e5: "E5",
    dfa: "DFA Model",
    nlp: "NLP",
    lang_ident: "Built-in",
  };
  return labels[m.modelClass] ?? "Model";
}

function modelClassColor(m: TrainedModel): string {
  if (m.modelClass === "lang_ident") return "hollow";
  if (m.modelClass === "dfa") return "hollow";
  return "primary";
}

function stateColor(
  state: string,
): "success" | "danger" | "warning" | "default" {
  if (state === "opened" || state === "started") return "success";
  if (state === "failed") return "danger";
  if (["opening", "closing", "starting", "stopping"].includes(state))
    return "warning";
  return "default";
}

function datafeedColor(
  datafeedState: string | null,
  jobState: string,
): "success" | "danger" | "default" {
  if (!datafeedState) return "default";
  if (datafeedState === "started") return "success";
  if (datafeedState === "stopped" && jobState === "opened") return "danger";
  return "default";
}

function memoryStatusColor(
  status: string,
): "success" | "danger" | "warning" | "default" {
  if (status === "ok") return "success";
  if (status === "hard_limit") return "danger";
  if (status === "soft_limit") return "warning";
  return "default";
}

// Intentional vis-palette hex: semantic status colors used as raw CSS backgrounds for the stacked bar
function memBarColor(pct: number): string {
  if (pct >= 90) return "#ff5630";
  if (pct >= 75) return "#ffab00";
  return "#36b37e";
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function AnomalyDetectionPanel({ jobs }: { jobs: AnomalyJob[] }) {
  const criticalJobs = jobs.filter(
    (j) =>
      j.state === "failed" ||
      j.memoryStatus === "hard_limit" ||
      (j.state === "opened" && j.datafeedState === "stopped"),
  );

  const columns = [
    {
      field: "jobId" as const,
      name: "Job ID",
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: "origin" as const,
      name: "Origin",
      render: (o: string) => (
        <EuiBadge color="hollow">
          {o === "security"
            ? "Security"
            : o === "observability"
              ? "Observability"
              : "User"}
        </EuiBadge>
      ),
    },
    {
      field: "state" as const,
      name: "State",
      render: (s: string) => <EuiBadge color={stateColor(s)}>{s}</EuiBadge>,
    },
    {
      name: "Datafeed",
      render: (job: AnomalyJob) => (
        <EuiBadge color={datafeedColor(job.datafeedState, job.state)}>
          {job.datafeedState ?? "unknown"}
        </EuiBadge>
      ),
    },
    {
      field: "memoryStatus" as const,
      name: "Memory",
      render: (s: string) => (
        <EuiBadge color={memoryStatusColor(s)}>{s.replace(/_/g, " ")}</EuiBadge>
      ),
    },
    {
      field: "modelBytes" as const,
      name: "Model Size",
      render: (b: number) => (b > 0 ? formatBytes(b) : "—"),
    },
    {
      field: "processedRecordCount" as const,
      name: "Records",
      render: (n: number) => (n > 0 ? formatCount(n) : "—"),
    },
  ];

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup
        justifyContent="spaceBetween"
        alignItems="center"
        gutterSize="s"
      >
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs"><h3>Anomaly Detection</h3></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />

      {criticalJobs.map((job) => {
        const isDanger =
          job.state === "failed" || job.memoryStatus === "hard_limit";
        let msg = "";
        if (job.state === "failed") msg = "Job failed.";
        else if (job.memoryStatus === "hard_limit")
          msg = "Job hit memory hard limit — model cannot grow further.";
        else msg = "Job is opened but datafeed is stopped — no data flowing.";
        if (job.assignmentExplanation) {
          const t = job.assignmentExplanation.slice(0, 200);
          msg += ` ${t}${job.assignmentExplanation.length > 200 ? "…" : ""}`;
        }
        return (
          <EuiCallOut
            key={job.jobId}
            color={isDanger ? "danger" : "warning"}
            size="s"
            style={{ marginBottom: 8 }}
          >
            <EuiText size="xs">
              <strong>{job.jobId}</strong> — {msg}
            </EuiText>
          </EuiCallOut>
        );
      })}

      <EuiBasicTable items={jobs} columns={columns} tableLayout="auto" />
    </EuiPanel>
  );
}

function TrainedModelsPanel({ models }: { models: TrainedModel[] }) {
  const columns = [
    {
      field: "modelId" as const,
      name: "Model",
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: "modelClass" as const,
      name: "Type",
      render: (_: string, m: TrainedModel) => (
        <EuiBadge color={modelClassColor(m)}>{modelClassLabel(m)}</EuiBadge>
      ),
    },
    {
      field: "inferenceTask" as const,
      name: "Task",
      render: (t: string | null) =>
        t ? (
          <EuiBadge color="hollow">{t.replace(/_/g, " ")}</EuiBadge>
        ) : (
          <EuiText size="s" color="subdued" component="span">—</EuiText>
        ),
    },
    {
      field: "deploymentState" as const,
      name: "Deployment",
      render: (s: string | null) =>
        s ? (
          <EuiBadge
            color={
              s === "started"
                ? "success"
                : s === "failed"
                  ? "danger"
                  : "warning"
            }
          >
            {s}
          </EuiBadge>
        ) : (
          <EuiBadge color="hollow">not deployed</EuiBadge>
        ),
    },
    {
      name: "Allocations",
      render: (m: TrainedModel) =>
        m.deploymentState
          ? `${m.allocationCount} / ${m.targetAllocationCount}`
          : "—",
    },
    {
      field: "inferenceCount" as const,
      name: "Inferences",
      render: (n: number) => (n > 0 ? formatCount(n) : "—"),
    },
    {
      field: "avgInferenceTimeMs" as const,
      name: "Avg Latency",
      render: (ms: number | null) =>
        ms !== null ? `${Math.round(ms)} ms` : "—",
    },
  ];

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup
        justifyContent="spaceBetween"
        alignItems="center"
        gutterSize="s"
      >
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs"><h3>Trained Models &amp; NLP Deployments</h3></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">
            {models.length} model{models.length !== 1 ? "s" : ""}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <EuiBasicTable items={models} columns={columns} tableLayout="auto" />
    </EuiPanel>
  );
}

function DFAPanel({ jobs }: { jobs: DFAJob[] }) {
  const columns = [
    {
      field: "id" as const,
      name: "Job ID",
      render: (id: string) => <code style={{ fontSize: 11 }}>{id}</code>,
    },
    {
      field: "analysisType" as const,
      name: "Type",
      render: (t: string) => (
        <EuiBadge color="hollow">{t.replace(/_/g, " ")}</EuiBadge>
      ),
    },
    {
      field: "state" as const,
      name: "State",
      render: (s: string) => (
        <EuiBadge
          color={
            s === "failed" ? "danger" : s === "stopped" ? "default" : "success"
          }
        >
          {s}
        </EuiBadge>
      ),
    },
  ];

  return (
    <EuiPanel paddingSize="m">
      <EuiFlexGroup
        justifyContent="spaceBetween"
        alignItems="center"
        gutterSize="s"
      >
        <EuiFlexItem grow={false}>
          <EuiTitle size="xs"><h3>Data Frame Analytics</h3></EuiTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiBadge color="hollow">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </EuiBadge>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="s" />
      <EuiBasicTable items={jobs} columns={columns} tableLayout="auto" />
    </EuiPanel>
  );
}

function MLMemoryPanel({ nodes }: { nodes: MLNodeMemory[] }) {
  return (
    <EuiPanel paddingSize="m">
      <EuiTitle size="xs"><h3>ML Memory</h3></EuiTitle>
      <EuiSpacer size="s" />
      {nodes.map((node) => {
        const usedBytes =
          node.anomalyDetectorsBytes +
          node.nativeInferenceBytes +
          node.dataFrameAnalyticsBytes;
        const usedPct = Math.round((usedBytes / node.maxBytes) * 100);
        const adPct = (node.anomalyDetectorsBytes / node.maxBytes) * 100;
        const infPct = (node.nativeInferenceBytes / node.maxBytes) * 100;
        const dfaPct = (node.dataFrameAnalyticsBytes / node.maxBytes) * 100;
        return (
          <div key={node.nodeName} style={{ marginBottom: 14 }}>
            <EuiFlexGroup
              justifyContent="flexStart"
              alignItems="center"
              gutterSize="s"
              responsive={false}
              style={{ marginBottom: 4 }}
            >
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  {node.nodeName}
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" color="subdued">
                  —
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiText size="xs" style={{ color: memBarColor(usedPct) }}>
                  {usedPct}% — {formatBytes(usedBytes)} /{" "}
                  {formatBytes(node.maxBytes)}
                </EuiText>
              </EuiFlexItem>
            </EuiFlexGroup>
            {/* Stacked bar: yellow=AD, blue=inference, purple=DFA */}
            <div
              style={{
                height: 10,
                background: "#111827",
                borderRadius: 5,
                overflow: "hidden",
                display: "flex",
              }}
            >
              {adPct > 0 && (
                <div
                  style={{ width: `${adPct}%`, background: "#ffab00" }}
                  title={`Anomaly detectors: ${formatBytes(node.anomalyDetectorsBytes)}`}
                />
              )}
              {infPct > 0 && (
                <div
                  style={{ width: `${infPct}%`, background: "#4c9aff" }}
                  title={`Native inference: ${formatBytes(node.nativeInferenceBytes)}`}
                />
              )}
              {dfaPct > 0 && (
                <div
                  style={{ width: `${dfaPct}%`, background: "#a855f7" }}
                  title={`Data frame analytics: ${formatBytes(node.dataFrameAnalyticsBytes)}`}
                />
              )}
            </div>
          </div>
        );
      })}
      <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
        Yellow = anomaly detectors · Blue = native inference · Purple = data
        frame analytics
      </EuiText>
    </EuiPanel>
  );
}

function IndexNameList({
  names,
  dotColor = "#4c9aff",
}: {
  names: string[];
  dotColor?: string;
}) {
  const userNames = names.filter((n) => !n.startsWith(".")).sort();
  const systemNames = names.filter((n) => n.startsWith(".")).sort();
  const bothGroups = userNames.length > 0 && systemNames.length > 0;

  const renderItems = (items: string[], isSystem: boolean) =>
    items.map((name) => (
      <EuiListGroupItem
        key={name}
        size="xs"
        color={isSystem ? "subdued" : "text"}
        label={<code>{name}</code>}
        icon={<Dot color={isSystem ? "#444c60" : dotColor} />}
        wrapText
      />
    ));

  return (
    <div style={{ marginTop: 6 }}>
      {userNames.length > 0 && (
        <>
          {bothGroups && (
            <EuiText size="xs" color="subdued" style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
              User
            </EuiText>
          )}
          <EuiListGroup flush gutterSize="none">
            {renderItems(userNames, false)}
          </EuiListGroup>
        </>
      )}
      {systemNames.length > 0 && (
        <>
          {bothGroups && (
            <EuiText size="xs" color="subdued" style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8, marginBottom: 2 }}>
              System
            </EuiText>
          )}
          <EuiListGroup flush gutterSize="none">
            {renderItems(systemNames, true)}
          </EuiListGroup>
        </>
      )}
    </div>
  );
}

function SemanticSearchPanel({ features }: { features: FeatureInfo }) {
  const semanticNames = features.semanticTextIndexNames;
  const sparseNames = features.sparseVectorIndexNames ?? [];
  const hasDenseGroups = features.denseVectorDimGroups.length > 0;
  const hasSparseNames = sparseNames.length > 0;
  const hasSemanticNames = semanticNames.length > 0;

  return (
    <EuiPanel paddingSize="m">
      <EuiTitle size="xs"><h3>Semantic &amp; Vector Search</h3></EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="m" wrap style={{ marginBottom: 12 }}>
        {[
          { label: "Semantic Text", count: features.semanticTextIndexCount },
          { label: "Dense Vector", count: features.denseVectorIndexCount },
          { label: "Sparse Vector", count: features.sparseVectorIndexCount },
        ].map(({ label, count }) => (
          <EuiFlexItem key={label} grow={false}>
            <EuiStat
              title={count}
              description={label}
              titleColor={count > 0 ? "primary" : "subdued"}
              titleSize="s"
            />
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>

      {hasDenseGroups && (
        <div style={{ marginTop: 4 }}>
          <EuiText size="xs" color="subdued" style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            dense_vector
          </EuiText>
          {features.denseVectorDimGroups.map(
            ({ dims, count, inferenceId, indexNames }) => {
              const typeLabel = inferenceId
                ? inferenceId
                : `External - Dense - ${dims}dims`;
              return (
                <div
                  key={`${dims}::${inferenceId ?? ""}`}
                  style={{ marginBottom: indexNames.length > 0 ? 10 : 4 }}
                >
                  <EuiFlexGroup gutterSize="xs" alignItems="center" responsive={false}>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="primary" component="span"><strong style={{ minWidth: 36, display: "inline-block" }}>{dims}</strong></EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued" component="span">dims ·</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" component="span">{count} {count === 1 ? "index" : "indices"}</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s" color="subdued" component="span">· {typeLabel}</EuiText>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                  {indexNames.length > 0 && (
                    <div style={{ paddingLeft: 16 }}>
                      <IndexNameList names={indexNames} dotColor="#4c9aff" />
                    </div>
                  )}
                </div>
              );
            },
          )}
        </div>
      )}

      {hasSparseNames && (
        <div style={{ marginTop: hasDenseGroups ? 10 : 4 }}>
          <EuiText size="xs" color="subdued" style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            sparse_vector
          </EuiText>
          <IndexNameList names={sparseNames} dotColor="#7b61ff" />
        </div>
      )}

      {hasSemanticNames && (
        <div style={{ marginTop: hasDenseGroups || hasSparseNames ? 10 : 4 }}>
          <EuiText size="xs" color="subdued" style={{ textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            semantic_text
          </EuiText>
          <IndexNameList names={semanticNames} dotColor="#00bfb3" />
        </div>
      )}
    </EuiPanel>
  );
}

const Dot = ({ color }: { color: string }) => (
  <span
    aria-hidden="true"
    style={{
      display: "inline-block",
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: color,
      marginRight: 6,
      flexShrink: 0,
      marginTop: 3,
    }}
  />
);

const Pill = ({
  dotColor,
  title,
  subtitle,
}: {
  dotColor: string;
  title: string;
  subtitle: string;
}) => (
  <EuiPanel
    hasShadow={false}
    paddingSize="s"
    style={{ marginBottom: 6 }}
  >
    <EuiFlexGroup gutterSize="s" alignItems="flexStart" responsive={false}>
      <EuiFlexItem grow={false}>
        <Dot color={dotColor} />
      </EuiFlexItem>
      <EuiFlexItem>
        <EuiText size="s">{title}</EuiText>
        <EuiText size="xs" color="subdued">{subtitle}</EuiText>
      </EuiFlexItem>
    </EuiFlexGroup>
  </EuiPanel>
);

const SubSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <EuiFlexItem style={{ minWidth: 220 }}>
    <EuiTitle size="xxs"><h4>{title}</h4></EuiTitle>
    <EuiSpacer size="s" />
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {children}
    </div>
  </EuiFlexItem>
);

function AIFeaturesPanel({
  aiMl,
  features,
}: {
  aiMl: AiMlInfo;
  features: FeatureInfo | null;
}) {
  const { aiFeatures } = aiMl;
  const activeEndpoints = features?.activeInferenceEndpoints ?? [];
  const externalGroups =
    features?.denseVectorDimGroups.filter((g) => g.inferenceId === null) ?? [];

  const externalColumns = [
    {
      field: "dims" as const,
      name: "Dimensions",
      render: (d: number) => (
        <EuiText size="s" color="primary" component="span"><strong>{d}</strong></EuiText>
      ),
    },
    {
      field: "count" as const,
      name: "Indices",
      render: (c: number) => formatCount(c),
    },
    {
      name: "Likely Model",
      render: (g: DenseVectorDimGroup) => {
        const hint = getModelHint(g.dims);
        return hint ? (
          <EuiBadge color="hollow">{hint}</EuiBadge>
        ) : (
          <EuiText size="s" color="subdued" component="span">—</EuiText>
        );
      },
    },
  ];

  return (
    <EuiPanel paddingSize="m">
      <EuiTitle size="xs"><h3>AI Features Detected</h3></EuiTitle>
      <EuiSpacer size="s" />
      <EuiFlexGroup gutterSize="m" wrap>
        {(aiFeatures.hasSecurityAiAssistant ||
          aiFeatures.hasObservabilityAiAssistant) && (
          <SubSection title="AI Agents">
            {aiFeatures.hasSecurityAiAssistant && (
              <Pill
                dotColor="#36b37e"
                title="Security AI Assistant"
                subtitle=".kibana-elastic-ai-assistant-*"
              />
            )}
            {aiFeatures.hasObservabilityAiAssistant && (
              <Pill
                dotColor="#36b37e"
                title="Observability AI Assistant"
                subtitle={`.kibana-observability-ai-assistant-*${aiFeatures.observabilityConversationCount > 0 ? ` · ${formatCount(aiFeatures.observabilityConversationCount)} conversations` : ""}`}
              />
            )}
          </SubSection>
        )}

        {aiFeatures.hasChatAgents && (
          <SubSection title="Agent Builder">
            {aiFeatures.chatAgentCount > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="Chat Agents"
                subtitle={`.chat-agents · ${formatCount(aiFeatures.chatAgentCount)} agents`}
              />
            )}
            {aiFeatures.chatConversationCount > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="Conversations"
                subtitle={`.chat-conversations · ${formatCount(aiFeatures.chatConversationCount)}`}
              />
            )}
            {aiFeatures.chatToolCount > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="Tool Definitions"
                subtitle={`.chat-tools · ${formatCount(aiFeatures.chatToolCount)} tools`}
              />
            )}
          </SubSection>
        )}

        {aiFeatures.hasProductDocIndices && (
          <SubSection title="AI Product Docs (KB)">
            <Pill
              dotColor="#4c9aff"
              title={`${aiFeatures.productDocIndexCount} product doc ${aiFeatures.productDocIndexCount === 1 ? "index" : "indices"}`}
              subtitle=".kibana_ai_product_doc_* · E5 embeddings"
            />
          </SubSection>
        )}

        {(activeEndpoints.length > 0 ||
          aiFeatures.mlInferenceStorageBytes > 0) && (
          <SubSection title="ELASTIC INFERENCE SERVICE">
            {activeEndpoints.map((id) => (
              <Pill
                key={id}
                dotColor="#4c9aff"
                title={id}
                subtitle="referenced in mappings / pipelines"
              />
            ))}
            {aiFeatures.mlInferenceStorageBytes > 0 && (
              <Pill
                dotColor="#4c9aff"
                title="ML inference storage"
                subtitle={`.ml-inference-native-* · ${formatBytes(aiFeatures.mlInferenceStorageBytes)}`}
              />
            )}
          </SubSection>
        )}
      </EuiFlexGroup>

      {externalGroups.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <EuiTitle size="xxs"><h4>External Models</h4></EuiTitle>
          <EuiSpacer size="s" />
          <EuiBasicTable
            items={externalGroups}
            columns={externalColumns}
            tableLayout="auto"
          />
        </div>
      )}
    </EuiPanel>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiMlSection({ aiMl, features }: Props) {
  if (!hasAnything(aiMl, features)) return null;

  const status = getStatus(aiMl, features);
  const nonTrivialModels = significantModels(aiMl.trainedModels);
  const mlNodes = aiMl.mlNodeMemory.filter((n) => n.maxBytes > 0);

  const semanticCount =
    (features?.semanticTextIndexCount ?? 0) +
    (features?.denseVectorIndexCount ?? 0) +
    (features?.sparseVectorIndexCount ?? 0);

  const { aiFeatures } = aiMl;
  const activeInferenceEndpoints = features?.activeInferenceEndpoints ?? [];
  const showSemanticPanel = semanticCount > 0;
  const showAiFeaturesPanel =
    aiFeatures.hasSecurityAiAssistant ||
    aiFeatures.hasObservabilityAiAssistant ||
    aiFeatures.hasChatAgents ||
    aiFeatures.hasProductDocIndices ||
    (features?.activeInferenceEndpoints.length ?? 0) > 0 ||
    aiFeatures.mlInferenceStorageBytes > 0 ||
    (features?.denseVectorDimGroups.filter((g) => g.inferenceId === null)
      .length ?? 0) > 0;

  // Anomaly job breakdowns for stat card
  const openedJobs = aiMl.anomalyJobs.filter(
    (j) => j.state === "opened",
  ).length;
  const failedJobs = aiMl.anomalyJobs.filter(
    (j) => j.state === "failed",
  ).length;
  const closedJobs = aiMl.anomalyJobs.filter(
    (j) => j.state === "closed",
  ).length;

  const aiAssistantLabel =
    aiFeatures.hasSecurityAiAssistant && aiFeatures.hasObservabilityAiAssistant
      ? "Security + Observability"
      : aiFeatures.hasSecurityAiAssistant
        ? "Security"
        : aiFeatures.hasObservabilityAiAssistant
          ? "Observability"
          : null;

  return (
    <div>
      {/* Status badge */}
      <div style={{ marginBottom: 12 }}>
        <EuiBadge color={status.color}>{status.label}</EuiBadge>
      </div>

      {/* Stat cards */}
      <EuiFlexGroup gutterSize="m" wrap style={{ marginBottom: 16 }}>
        <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
          <EuiPanel paddingSize="m">
            <EuiStat
              title={
                aiMl.upgradeMode
                  ? "Upgrade Mode"
                  : aiMl.mlEnabled
                    ? "Enabled"
                    : "Disabled"
              }
              description="ML Status"
              titleColor={
                aiMl.upgradeMode
                  ? "warning"
                  : aiMl.mlEnabled
                    ? "success"
                    : "subdued"
              }
              titleSize="s"
            />
          </EuiPanel>
        </EuiFlexItem>
        {aiMl.anomalyJobs.length > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={aiMl.anomalyJobs.length}
                description="Anomaly Jobs"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                {openedJobs > 0 && (
                  <EuiText size="xs" color="success" component="span">{openedJobs} opened</EuiText>
                )}
                {openedJobs > 0 && failedJobs > 0 && " · "}
                {failedJobs > 0 && (
                  <EuiText size="xs" color="danger" component="span">{failedJobs} failed</EuiText>
                )}
                {closedJobs > 0 &&
                  (openedJobs > 0 || failedJobs > 0) &&
                  ` · ${closedJobs} closed`}
                {closedJobs > 0 &&
                  openedJobs === 0 &&
                  failedJobs === 0 &&
                  `${closedJobs} closed`}
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {nonTrivialModels.length > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={nonTrivialModels.length}
                description="NLP Models"
                titleColor="primary"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                {nonTrivialModels.map((m) => modelClassLabel(m)).join(" · ")}
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {features && features.semanticTextIndexCount > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={features.semanticTextIndexCount}
                description="Semantic Indices"
                titleColor="primary"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                semantic_text fields
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {activeInferenceEndpoints.length > 0 && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title={activeInferenceEndpoints.length}
                description="Inference Endpoints"
                titleColor="primary"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                referenced in mappings / pipelines
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
        {aiAssistantLabel && (
          <EuiFlexItem grow={false} style={{ minWidth: 130 }}>
            <EuiPanel paddingSize="m">
              <EuiStat
                title="Active"
                description="AI Agent"
                titleColor="success"
                titleSize="s"
              />
              <EuiText size="xs" color="subdued" style={{ marginTop: 4 }}>
                {aiAssistantLabel}
              </EuiText>
            </EuiPanel>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>

      {/* Detail panels */}
      {aiMl.anomalyJobs.length > 0 && (
        <>
          <AnomalyDetectionPanel jobs={aiMl.anomalyJobs} />
          <EuiSpacer size="m" />
        </>
      )}
      {aiMl.trainedModels.length > 0 && (
        <>
          <TrainedModelsPanel models={aiMl.trainedModels} />
          <EuiSpacer size="m" />
        </>
      )}
      {aiMl.dfaJobs.length > 0 && (
        <>
          <DFAPanel jobs={aiMl.dfaJobs} />
          <EuiSpacer size="m" />
        </>
      )}
      {mlNodes.length > 0 && (
        <>
          <MLMemoryPanel nodes={mlNodes} />
          <EuiSpacer size="m" />
        </>
      )}
      {showSemanticPanel && features && (
        <>
          <SemanticSearchPanel features={features} />
          <EuiSpacer size="m" />
        </>
      )}
      {showAiFeaturesPanel && (
        <AIFeaturesPanel aiMl={aiMl} features={features} />
      )}
    </div>
  );
}
