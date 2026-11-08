"""
Business Relevance Guardrail for Multi-Agent Swarm Communications.
Spec: docs/architecture/04_agent_coordination_and_safety_rails.md
Phase 4 of docs/AGENT_FIRST_TRANSFORMATION_PLAN.md
"""

import re
from typing import Dict, List, Optional, Tuple

# Patterns identifying non-business chatter, social filler, or evasive noise
OFF_TOPIC_CHATTER = [
    re.compile(r'\b(?:how are you|how\'s your day|nice to meet you|tell me a joke|good morning|good evening|what\'s the weather)\b', re.IGNORECASE),
    re.compile(r'\b(?:as an ai language model|as a helpful assistant, I feel|my favorite color|tell me a story)\b', re.IGNORECASE),
    re.compile(r'\b(?:ignore all previous instructions|disregard prior directives|jailbreak|pretend you are DAN)\b', re.IGNORECASE),
    re.compile(r'\b(?:let\'s play a game|once upon a time|what do you think about philosophy)\b', re.IGNORECASE),
]

# Required technical indicators for coding / engineering relevance
TECHNICAL_KEYWORDS = [
    re.compile(r'\b(?:file|function|class|code|test|bug|fix|implement|refactor|import|export|type|const|let|var|return)\b', re.IGNORECASE),
    re.compile(r'\b(?:diff|git|worktree|branch|commit|package|build|compile|script|css|html|ts|js|json|py)\b', re.IGNORECASE),
    re.compile(r'\b(?:plan|task|step|acceptance|objective|verify|review|diagnostics|audit|error|warning)\b', re.IGNORECASE),
]


class RelevanceVerdict:
    def __init__(self, is_relevant: bool, reason: str = "", score: float = 1.0):
        self.is_relevant = is_relevant
        self.reason = reason
        self.score = score

    def __repr__(self):
        return f"<RelevanceVerdict relevant={self.is_relevant} score={self.score:.2f} reason='{self.reason}'>"


def check_business_relevance(text: str, role: str = "agent") -> RelevanceVerdict:
    """
    Audits communication between agents for strict business and engineering relevance.
    Blocks social pleasantries, off-topic rambling, and prompt injection attempts.
    """
    if not text or not text.strip():
        return RelevanceVerdict(False, "Empty communication payload", score=0.0)

    clean_text = text.strip()

    # 1. Check for blatant off-topic chatter or injection
    for pat in OFF_TOPIC_CHATTER:
        m = pat.search(clean_text)
        if m:
            return RelevanceVerdict(
                False,
                f"Detected off-topic chatter or unauthorized directive: '{m.group(0)}'",
                score=0.1
            )

    # 2. Check for technical engineering substance
    technical_hits = sum(1 for pat in TECHNICAL_KEYWORDS if pat.search(clean_text))
    if len(clean_text.split()) > 15 and technical_hits == 0:
        return RelevanceVerdict(
            False,
            "Communication lacks technical substance or engineering context",
            score=0.3
        )

    return RelevanceVerdict(True, "Relevant engineering communication", score=1.0)


def sanitize_agent_communication(report: Dict) -> Dict:
    """
    Validates and sanitizes agent reports before they are propagated across worktrees.
    Raises ValueError or adjusts outcome if report contains off-topic content.
    """
    summary = report.get('summary', '')
    verdict = check_business_relevance(summary, role=report.get('role', 'agent'))

    if not verdict.is_relevant:
        # Re-align agent towards the living PLAN.md objective
        report['outcome'] = 'blocked'
        report['summary'] = f"[Business Relevance Guardrail] {verdict.reason}. Re-align with living PLAN.md tasks."
        report['findings'] = [f"Blocked off-topic communication: {verdict.reason}"]
        report.pop('file_writes', None)

    # Check steps and findings
    for collection_key in ['steps', 'findings']:
        items = report.get(collection_key, [])
        if isinstance(items, list):
            cleaned = []
            for item in items:
                if isinstance(item, str):
                    item_v = check_business_relevance(item)
                    if item_v.is_relevant:
                        cleaned.append(item)
            report[collection_key] = cleaned

    return report
