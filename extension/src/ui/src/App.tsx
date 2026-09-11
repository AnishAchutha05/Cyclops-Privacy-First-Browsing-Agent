import { useEffect, useState } from "react";
import {
  Settings,
  Check,
  ShieldCheck,
  MapPin,
  Mic,
  Play,
  ChevronRight,
  Square,
  X,
  Eye,
  AlertTriangle,
} from "lucide-react";

import ProviderSelect from "./components/ProviderSelect";
import ApiKeyInput from "./components/ApiKeyInput";
import ModelSelect from "./components/ModelSelect";
import StatusBadge from "./components/StatusBadge";
import CyclopsCharacter from "./components/CyclopsCharacter";

import { getProviders, getModels } from "./services/api";
import type { Provider, Model } from "./services/api";

/* =========================
   TYPES
   ========================= */

interface AgentPlanStep {
  step: number;
  action: string;
  status: string;
  requiresConfirmation?: boolean;
}

interface AgentPlan {
  success: boolean;
  mode: string;
  task: string;
  plan: AgentPlanStep[];
}

type AgentState =
  | "idle"
  | "thinking"
  | "planning"
  | "executing"
  | "success"
  | "error";

/* =========================
   APP
   ========================= */

function App() {
  /* =========================
     CONFIGURATION
     ========================= */

  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  /* =========================
     TASK
     ========================= */

  const [task, setTask] = useState("");
  const [agentPlan, setAgentPlan] = useState<AgentPlan | null>(null);

  const [agentState, setAgentState] =
    useState<AgentState>("idle");

  const [currentAction, setCurrentAction] =
    useState("WAITING FOR TASK");

  const [privacyStatus, setPrivacyStatus] =
    useState("READY");

  const [visionStatus, setVisionStatus] =
    useState("NOT ACTIVE");

  /* =========================
     CONFIRMATION
     ========================= */

  const [showConfirmation, setShowConfirmation] =
    useState(false);

  const [pendingAction, setPendingAction] =
    useState("");

  /* =========================
     GENERAL STATUS
     ========================= */

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const [statusMessage, setStatusMessage] =
    useState("READY");

  const [loadingProviders, setLoadingProviders] =
    useState(true);

  const [loadingModels, setLoadingModels] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  /* =========================
     LOAD PROVIDERS
     ========================= */

  useEffect(() => {
    async function loadProviders() {
      try {
        setLoadingProviders(true);

        const data = await getProviders();

        setProviders(data);

        setStatus("idle");
        setStatusMessage("READY");
      } catch (error) {
        console.error(
          "Failed to load providers:",
          error
        );

        setStatus("error");
        setStatusMessage("BACKEND OFFLINE");
      } finally {
        setLoadingProviders(false);
      }
    }

    loadProviders();
  }, []);

  /* =========================
     LOAD SAVED CONFIGURATION
     ========================= */

  useEffect(() => {
    async function loadSavedConfiguration() {
      try {
        const saved =
          await chrome.storage.local.get([
            "provider",
            "model",
          ]);

        const savedProvider =
          typeof saved.provider === "string"
            ? saved.provider
            : "";

        const savedModel =
          typeof saved.model === "string"
            ? saved.model
            : "";

        if (!savedProvider) {
          return;
        }

        setProvider(savedProvider);

        try {
          setLoadingModels(true);

          setStatus("loading");
          setStatusMessage("LOADING MODELS...");

          const availableModels =
            await getModels(savedProvider);

          setModels(availableModels);

          if (
            savedModel &&
            availableModels.some(
              (model) =>
                model.id === savedModel
            )
          ) {
            setSelectedModel(savedModel);
          }

          if (availableModels.length === 0) {
            setStatus("error");
            setStatusMessage(
              "NO MODELS AVAILABLE"
            );
          } else {
            setStatus("success");
            setStatusMessage(
              "CONFIGURATION LOADED"
            );
          }
        } catch (error) {
          console.error(
            "Failed to load models:",
            error
          );

          setModels([]);
          setSelectedModel("");

          setStatus("error");
          setStatusMessage(
            "MODEL LOAD FAILED"
          );
        } finally {
          setLoadingModels(false);
        }
      } catch (error) {
        console.error(
          "Failed to load saved configuration:",
          error
        );
      }
    }

    loadSavedConfiguration();
  }, []);

  /* =========================
     PROVIDER CHANGE
     ========================= */

  async function handleProviderChange(
    value: string
  ) {
    setProvider(value);

    setApiKey("");
    setModels([]);
    setSelectedModel("");
    setAgentPlan(null);

    if (!value) {
      setStatus("idle");
      setStatusMessage("READY");
      return;
    }

    try {
      setLoadingModels(true);

      setStatus("loading");
      setStatusMessage("LOADING MODELS...");

      const availableModels =
        await getModels(value);

      setModels(availableModels);

      if (availableModels.length === 0) {
        setStatus("error");
        setStatusMessage(
          "NO MODELS AVAILABLE"
        );

        return;
      }

      if (availableModels.length === 1) {
        setSelectedModel(
          availableModels[0].id
        );
      }

      setStatus("success");
      setStatusMessage("MODELS LOADED");
    } catch (error) {
      console.error(
        "Failed to load models:",
        error
      );

      setModels([]);
      setSelectedModel("");

      setStatus("error");
      setStatusMessage(
        "MODEL LOAD FAILED"
      );
    } finally {
      setLoadingModels(false);
    }
  }

  /* =========================
     SAVE CONFIGURATION
     ========================= */

  async function handleSave() {
    if (!provider) {
      setStatus("error");
      setStatusMessage("SELECT PROVIDER");
      return;
    }

    if (!selectedModel) {
      setStatus("error");
      setStatusMessage("SELECT MODEL");
      return;
    }

    try {
      setSaving(true);

      setStatus("loading");
      setStatusMessage("SAVING...");

      await chrome.storage.local.set({
        provider,
        model: selectedModel,
        configured: true,
      });

      setStatus("success");
      setStatusMessage(
        "CONFIGURATION SAVED"
      );
    } catch (error) {
      console.error(
        "Save configuration error:",
        error
      );

      setStatus("error");
      setStatusMessage("SAVE FAILED");
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     VOICE BUTTON
     ========================= */

  function handleVoiceButton() {
    setStatus("idle");
    setStatusMessage("VOICE INPUT READY");
  }

  /* =========================
     RUN TASK
     ========================= */

  async function handleRunTask() {
    const enteredTask = task.trim();

    if (!enteredTask) {
      setStatus("error");
      setStatusMessage("ENTER A TASK");
      return;
    }

    setAgentPlan(null);
    setShowConfirmation(false);
    setPendingAction("");

    setAgentState("thinking");

    setCurrentAction("ANALYZING TASK");

    setPrivacyStatus(
      "SANITIZING CONTEXT"
    );

    setVisionStatus("NOT ACTIVE");

    setStatus("loading");
    setStatusMessage("THINKING...");

    await new Promise((resolve) =>
      setTimeout(resolve, 700)
    );

    setAgentState("planning");

    setCurrentAction(
      "BUILDING ACTION PLAN"
    );

    setPrivacyStatus(
      "CONTEXT SANITIZED"
    );

    setStatusMessage(
      "PLANNING TASK..."
    );

    await new Promise((resolve) =>
      setTimeout(resolve, 700)
    );

    /*
     * TEMPORARY FRONTEND DEMO PLAN
     *
     * The backend will eventually return
     * this structure from /agent/plan.
     */

    const demoPlan: AgentPlan = {
      success: true,
      mode: "frontend-demo",
      task: enteredTask,

      plan: [
        {
          step: 1,
          action: "ANALYZE TASK",
          status: "READY",
        },
        {
          step: 2,
          action: "PREPARE REQUIRED TOOLS",
          status: "READY",
        },
        {
          step: 3,
          action: "SUBMIT FORM",
          status: "CONFIRMATION REQUIRED",
          requiresConfirmation: true,
        },
      ],
    };

    setAgentPlan(demoPlan);

    setAgentState("executing");

    setCurrentAction(
      "CONFIRMATION REQUIRED"
    );

    setVisionStatus("NOT REQUIRED");

    setStatus("success");
    setStatusMessage(
      "ACTION NEEDS APPROVAL"
    );

    setPendingAction("SUBMIT FORM");

    setShowConfirmation(true);
  }

  /* =========================
     CONFIRM ACTION
     ========================= */

  function handleConfirmAction() {
    setShowConfirmation(false);
    setPendingAction("");

    setAgentState("executing");

    setCurrentAction(
      "EXECUTING CONFIRMED ACTION"
    );

    setStatus("loading");
    setStatusMessage("EXECUTING...");

    setTimeout(() => {
      setAgentState("success");

      setCurrentAction(
        "ACTION COMPLETED"
      );

      setStatus("success");
      setStatusMessage(
        "TASK COMPLETED"
      );
    }, 1000);
  }

  /* =========================
     CANCEL CONFIRMATION
     ========================= */

  function handleCancelConfirmation() {
    setShowConfirmation(false);
    setPendingAction("");

    setAgentState("idle");

    setCurrentAction(
      "ACTION CANCELLED"
    );

    setStatus("error");
    setStatusMessage(
      "ACTION CANCELLED"
    );
  }

  /* =========================
     STOP TASK
     ========================= */

  function handleStopTask() {
    setShowConfirmation(false);
    setPendingAction("");

    setAgentState("idle");

    setCurrentAction(
      "TASK STOPPED"
    );

    setPrivacyStatus(
      "CONTEXT CLEARED"
    );

    setVisionStatus("NOT ACTIVE");

    setStatus("error");
    setStatusMessage("TASK STOPPED");
  }

  /* =========================
     CANCEL TASK
     ========================= */

  function handleCancelTask() {
    setShowConfirmation(false);
    setPendingAction("");
    setAgentPlan(null);

    setAgentState("idle");

    setCurrentAction(
      "WAITING FOR TASK"
    );

    setPrivacyStatus("READY");
    setVisionStatus("NOT ACTIVE");

    setStatus("idle");
    setStatusMessage("READY");
  }

  /* =========================
     TASK INPUT CHANGE
     ========================= */

  function handleTaskChange(
    value: string
  ) {
    setTask(value);

    setAgentPlan(null);
    setShowConfirmation(false);
    setPendingAction("");

    if (agentState !== "idle") {
      setAgentState("idle");
    }

    setCurrentAction(
      "WAITING FOR TASK"
    );

    setPrivacyStatus("READY");
    setVisionStatus("NOT ACTIVE");

    if (status !== "loading") {
      setStatus("idle");
      setStatusMessage("READY");
    }
  }

  /* =========================
     AGENT STATE LABEL
     ========================= */

  function getAgentStateLabel() {
    switch (agentState) {
      case "thinking":
        return "THINKING";

      case "planning":
        return "PLANNING";

      case "executing":
        return "EXECUTING";

      case "success":
        return "SUCCESS";

      case "error":
        return "ERROR";

      default:
        return "IDLE";
    }
  }

  /* =========================
     CYCLOPS CHARACTER STATE
     ========================= */

  const cyclopsState =
    agentState === "planning"
      ? "thinking"
      : agentState;

  /* =========================
     RENDER
     ========================= */

  return (
    <main className="app">

      {/* =========================
          HEADER
          ========================= */}

      <header className="header">

        <div className="brand">

          <div className="logo">
            ◈
          </div>

          <div>
            <h1>
              CYCLOPS
            </h1>

            <p>
              PRIVACY-FIRST AGENT
            </p>
          </div>

        </div>

        {/* CYCLOPS + SETTINGS */}

        <div className="header-actions">

          <CyclopsCharacter
            state={cyclopsState}
            size={100}
          />

          <button
            className="settings-button"
            type="button"
            aria-label="Settings"
          >
            <Settings size={17} />
          </button>

        </div>

      </header>

      <div className="scanline" />

      {/* =========================
          HERO
          ========================= */}

      <section className="hero">

        <div className="hero-icon">
          ◉
        </div>

        <div>

          <h2>
            AI CONFIGURATION
          </h2>

          <p>
            CONNECT YOUR REASONING ENGINE
          </p>

        </div>

      </section>

      {/* =========================
          CONFIGURATION
          ========================= */}

      <section className="panel">

        <ProviderSelect
          providers={providers}
          value={provider}
          onChange={handleProviderChange}
        />

        {loadingProviders && (
          <span className="model-count">
            LOADING PROVIDERS...
          </span>
        )}

        <ApiKeyInput
          value={apiKey}
          onChange={setApiKey}
          disabled={!provider}
        />

        <StatusBadge
          status={status}
          message={statusMessage}
        />

        <div className="divider" />

        <ModelSelect
          models={models}
          value={selectedModel}
          onChange={setSelectedModel}
          disabled={
            loadingModels ||
            models.length === 0
          }
        />

        {loadingModels && (
          <span className="model-count">
            FETCHING MODELS...
          </span>
        )}

        <button
          className="save-button"
          type="button"
          onClick={handleSave}
          disabled={
            !provider ||
            !selectedModel ||
            saving ||
            loadingModels
          }
        >
          <Check size={16} />

          {saving
            ? "SAVING..."
            : "SAVE CONFIGURATION"}
        </button>

      </section>

      {/* =========================
          TASK
          ========================= */}

      <section className="task-panel">

        <div className="task-header">

          <span className="section-label">
            TASK
          </span>

          <p>
            TELL CYCLOPS WHAT TO DO
          </p>

        </div>

        <div className="task-input-wrapper">

          <textarea
            className="task-input"
            value={task}
            onChange={(event) =>
              handleTaskChange(
                event.target.value
              )
            }
            placeholder="WHAT SHOULD I DO?"
            rows={4}
            aria-label="Task input"
          />

          <button
            type="button"
            className="voice-button"
            onClick={handleVoiceButton}
            aria-label="Voice input"
            title="Voice input"
          >
            <Mic size={17} />
          </button>

        </div>

        {/* RUN TASK */}

        <button
          type="button"
          className="run-task-button"
          onClick={handleRunTask}
          disabled={
            !task.trim() ||
            agentState === "thinking" ||
            agentState === "planning"
          }
        >
          <Play size={16} />

          {agentState === "thinking"
            ? "THINKING..."
            : agentState === "planning"
              ? "PLANNING..."
              : "RUN TASK"}
        </button>

        {/* =========================
            AGENT STATUS
            ========================= */}

        {agentState !== "idle" && (
          <section className="agent-status-panel">

            <div className="agent-status-header">

              <div>

                <span className="section-label">
                  AGENT STATUS
                </span>

                <p className="agent-status-task">
                  {task.trim()}
                </p>

              </div>

              <span
                className={`agent-state agent-state-${agentState}`}
              >
                {getAgentStateLabel()}
              </span>

            </div>

            {/* CURRENT ACTION */}

            <div className="current-action">

              <div className="current-action-icon">

                {agentState === "thinking" ||
                agentState === "planning" ? (
                  <span className="thinking-dots">
                    •••
                  </span>
                ) : (
                  <ChevronRight size={15} />
                )}

              </div>

              <div>

                <span className="status-small-label">
                  CURRENT ACTION
                </span>

                <p>
                  {currentAction}
                </p>

              </div>

            </div>

            {/* PRIVACY */}

            <div className="status-row">

              <div className="status-row-left">

                <ShieldCheck size={14} />

                <span>
                  PRIVACY
                </span>

              </div>

              <span className="status-value">
                {privacyStatus}
              </span>

            </div>

            {/* VISION */}

            <div className="status-row">

              <div className="status-row-left">

                <Eye size={14} />

                <span>
                  LOCAL VISION
                </span>

              </div>

              <span className="status-value">
                {visionStatus}
              </span>

            </div>

            {/* CONTROLS */}

            {(agentState === "thinking" ||
              agentState === "planning" ||
              agentState === "executing") && (

              <div className="agent-controls">

                <button
                  type="button"
                  className="stop-button"
                  onClick={handleStopTask}
                >
                  <Square size={13} />
                  STOP
                </button>

                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCancelTask}
                >
                  <X size={13} />
                  CANCEL
                </button>

              </div>
            )}

          </section>
        )}

        {/* =========================
            AGENT PLAN
            ========================= */}

        {agentPlan !== null && (
          <div className="agent-plan">

            <div className="agent-plan-header">

              <div>

                <span className="section-label">
                  AGENT PLAN
                </span>

                <p className="agent-plan-task">
                  {agentPlan.task}
                </p>

              </div>

              <span className="agent-plan-status">
                READY
              </span>

            </div>

            <div className="agent-plan-steps">

              {agentPlan.plan.map((step) => (
                <div
                  className="agent-step"
                  key={step.step}
                >

                  <div className="agent-step-number">
                    {String(step.step).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  <div className="agent-step-line" />

                  <div className="agent-step-content">

                    <div className="agent-step-action">

                      <ChevronRight size={13} />

                      <span>
                        {step.action}
                      </span>

                    </div>

                    <div className="agent-step-status">

                      <span className="status-dot" />

                      {step.status}

                    </div>

                  </div>

                </div>
              ))}

            </div>

          </div>
        )}

      </section>

      {/* =========================
          CONFIRMATION MODAL
          ========================= */}

      {showConfirmation && (
        <div
          className="confirmation-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmation-title"
        >

          <div className="confirmation-modal">

            <div className="confirmation-icon">
              <AlertTriangle size={22} />
            </div>

            <div className="confirmation-content">

              <span className="section-label">
                CONFIRM ACTION
              </span>

              <h3 id="confirmation-title">
                USER APPROVAL REQUIRED
              </h3>

              <p>
                CYCLOPS wants to perform:
              </p>

              <div className="confirmation-action">

                <ChevronRight size={14} />

                <span>
                  {pendingAction}
                </span>

              </div>

              <p className="confirmation-warning">
                This action requires your
                confirmation before it
                can continue.
              </p>

            </div>

            <div className="confirmation-buttons">

              <button
                type="button"
                className="confirmation-cancel"
                onClick={
                  handleCancelConfirmation
                }
              >
                <X size={14} />
                CANCEL
              </button>

              <button
                type="button"
                className="confirmation-confirm"
                onClick={
                  handleConfirmAction
                }
              >
                <Check size={14} />
                CONFIRM
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =========================
          FOOTER
          ========================= */}

      <footer className="footer">

        <div>

          <ShieldCheck size={13} />

          <span>
            PRIVACY PROTECTED
          </span>

        </div>

        <div>

          <MapPin size={13} />

          <span>
            LOCAL
          </span>

        </div>

      </footer>

    </main>
  );
}

export default App;