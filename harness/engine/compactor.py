"""
Token Compactor Engine & Context Hygiene Module.
Spec: docs/architecture/10_context_compaction_and_token_management.md
Phase 3 of docs/AGENT_FIRST_TRANSFORMATION_PLAN.md
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Standard regex to remove ANSI color codes and control sequences
ANSI_ESCAPE_RE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

# Patterns indicating significant error/failure traces
ERROR_PATTERNS = [
    re.compile(r'(?:FAIL|ERROR|FATAL|Exception|Traceback|AssertionError|assert\s)', re.IGNORECASE),
    re.compile(r'^\s*at\s+.*\(.*:\d+:\d+\)'),  # JS/TS stack trace
    re.compile(r'^\s*File\s+".*",\s+line\s+\d+'), # Python stack trace
    re.compile(r'error\[E\d+\]:'),               # Rust compiler error
    re.compile(r':\d+:\d+:\s+error:'),           # Clang/GCC error
]


def strip_ansi(text: str) -> str:
    """Strip all ANSI escape sequences, progress codes, and cursor moves."""
    if not text:
        return ""
    return ANSI_ESCAPE_RE.sub('', text)


def compress_terminal_output(raw_output: str, max_lines: int = 60) -> str:
    """
    Compress verbose build, test, and package manager outputs.
    1. Strips all ANSI sequences.
    2. Isolates failures, assertion errors, and stack traces.
    3. Replaces repetitive successful/passing lines with an elision counter.
    """
    clean_text = strip_ansi(raw_output)
    lines = clean_text.splitlines()

    if len(lines) <= max_lines:
        return "\n".join(lines)

    # Separate failure lines from normal progress
    failure_indices = set()
    for idx, line in enumerate(lines):
        if any(pat.search(line) for pat in ERROR_PATTERNS):
            # Capture context: 1 line before, 2 lines after
            for ctx in range(max(0, idx - 1), min(len(lines), idx + 3)):
                failure_indices.add(ctx)

    if not failure_indices:
        # No failures detected (e.g. huge passing test suite or long build)
        # Keep head (first 15) and tail (last 15)
        head = lines[:15]
        tail = lines[-15:]
        elided = len(lines) - 30
        return "\n".join(head) + f"\n\n... [{elided} lines of progress elided for context efficiency] ...\n\n" + "\n".join(tail)

    # Sort and collect failure regions
    selected_indices = sorted(failure_indices)
    result_lines = []
    if selected_indices and selected_indices[0] > 0:
        result_lines.append(f"... [{selected_indices[0]} lines elided for context efficiency] ...")

    last_idx = selected_indices[0] if selected_indices else -1

    for idx in selected_indices[:max_lines]:
        if last_idx != -1 and idx > last_idx + 1:
            result_lines.append(f"... [{idx - last_idx - 1} passing lines elided] ...")
        result_lines.append(lines[idx])
        last_idx = idx

    # Always append test suite summary from the bottom
    tail_summary = lines[-3:]
    return "\n".join(result_lines) + "\n\n" + "\n".join(tail_summary)


def generate_repo_map(root_dir: str, max_tokens: int = 1200) -> str:
    """
    Generates a concise, token-budgeted codebase map for Agent Architect.
    Extracts key directories, files, and top-level symbols without full file contents.
    """
    root = Path(root_dir).resolve()
    if not root.exists():
        return ""

    ignore_dirs = {
        'node_modules', '.git', 'dist', 'out', '.build', '__pycache__',
        '.local', 'target', 'vendor', '.next', '.cache', 'graphify-out'
    }

    tree_entries = []
    char_budget = max_tokens * 4  # ~4 chars per token heuristic
    total_chars = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ignore_dirs and not d.startswith('.')]
        rel_dir = Path(dirpath).relative_to(root)
        
        # Don't recurse more than 3 levels deep for concise repo map
        if len(rel_dir.parts) > 3:
            continue

        indent = "  " * len(rel_dir.parts)
        if rel_dir != Path('.'):
            dir_line = f"{indent}📁 {rel_dir.name}/"
            tree_entries.append(dir_line)
            total_chars += len(dir_line) + 1

        for f in sorted(filenames):
            if f.startswith('.') or f.endswith(('.pyc', '.map', '.log', '.diff', '.png', '.jpg', '.lock')):
                continue
            file_indent = "  " * (len(rel_dir.parts) + 1)
            file_line = f"{file_indent}📄 {f}"
            
            if total_chars + len(file_line) > char_budget:
                tree_entries.append("  ... [remaining files elided to fit token budget] ...")
                return "\n".join(tree_entries)
                
            tree_entries.append(file_line)
            total_chars += len(file_line) + 1

    return "\n".join(tree_entries)
