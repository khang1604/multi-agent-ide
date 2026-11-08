# Multi Agent IDE Documentation

Welcome to the centralized documentation hub for **Multi Agent IDE**.

## 1. Project Overview & Progress
- [**Master Architecture & Code Traceability Map**](ARCHITECTURE_MAP.md) — GPS connecting features, architectural specs, primary code files, and patches.
- [**Visual Flow & Architecture Map**](architecture/VISUAL_FLOW_MAP.md) — Interactive visual topology & sequence diagram for live tracing while coding.
- [**Master Handoff Guide**](HANDOFF.md) — Comprehensive technical handoff, repository structure, and instructions for incoming agents.
- [**Development Progress Log**](PROGRESS.md) — Milestones, completed work, active tasks, and lessons learned.
- [**Harness Engine Architecture**](HARNESS_README.md) — Documentation of the Python multi-agent orchestration engine (`agenthub`).
- [**Contributing Guidelines**](CONTRIBUTING.md) — Code style, pull requests, and development guidelines.
- [**Release Notes**](RELEASE_NOTES.md) — Version release logs and changelog.
- [**Demo Notes**](DEMO_NOTES.md) — Internal rehearsal notes and demo procedures.

## 2. Multi-Agent Architecture Specifications (`docs/architecture/`)
Comprehensive architectural blueprints and design documents:
1. [`01_orchestrator_vision_and_core_concepts.md`](architecture/01_orchestrator_vision_and_core_concepts.md) — Vision, multi-agent roles (Architect, Worker, Auditor), DAG inception.
2. [`02_competitive_analysis_and_benchmarks.md`](architecture/02_competitive_analysis_and_benchmarks.md) — Teardown of Cursor, Copilot, Cline, Continue.
3. [`03_agent_specialization_matrix.md`](architecture/03_agent_specialization_matrix.md) — Model capability mapping (Claude 3.7, o3-mini, Gemini 2.5 Pro).
4. [`04_notebooklm_research_guide.md`](architecture/04_notebooklm_research_guide.md) — Research synthesis guide.
5. [`05_multi_agent_ide_ui_foundations.md`](architecture/05_multi_agent_ide_ui_foundations.md) — UI foundations and legal compliance (Code-OSS, Open VSX).
6. [`06_mahub_ide_ui_blueprint.md`](architecture/06_mahub_ide_ui_blueprint.md) — UI layout blueprint (Swimlanes, Monaco diff, React webview).
7. [`07_open_source_orchestration_deep_dive.md`](architecture/07_open_source_orchestration_deep_dive.md) — Open-source orchestration comparison.
8. [`08_orchestration_mechanisms_and_license_matrix.md`](architecture/08_orchestration_mechanisms_and_license_matrix.md) — License compatibility matrix.
9. [`09_ipc_protocol_and_data_contracts.md`](architecture/09_ipc_protocol_and_data_contracts.md) — WebSocket IPC protocol & JSON-RPC schemas.
10. [`10_context_compaction_and_token_management.md`](architecture/10_context_compaction_and_token_management.md) — Headroom compression & token budget controls.
11. [`11_security_threat_model_and_appsec_guardrails.md`](architecture/11_security_threat_model_and_appsec_guardrails.md) — Threat model, prompt injection, sandboxing.
12. [`12_resilience_evaluation_and_conflict_resolution.md`](architecture/12_resilience_evaluation_and_conflict_resolution.md) — Circuit breaker, git conflict resolution.
13. [`13_mahub_killer_features_proposal.md`](architecture/13_mahub_killer_features_proposal.md) — 6 core killer features.
14. [`14_ui_installation_and_os_support_blueprint.md`](architecture/14_ui_installation_and_os_support_blueprint.md) — Packaging and cross-platform OS deployment.
15. [`15_pre_mortem_edge_cases_and_engineering_pitfalls.md`](architecture/15_pre_mortem_edge_cases_and_engineering_pitfalls.md) — Edge cases and defensive patterns.

## 3. Security & Constitution (`ai/`)
- [`ai/GLOBAL_RULES.md`](../ai/GLOBAL_RULES.md) — Mandatory security boundaries & data hygiene.
- [`ai/SECURITY.md`](../ai/SECURITY.md) — Global AppSec invariants and sandbox boundaries.
- [`ai/AGENTS.md`](../ai/AGENTS.md) — Agent operating rules and scope invariants.

