import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from engine.compactor import strip_ansi, compress_terminal_output, generate_repo_map

class TestTokenCompactor(unittest.TestCase):
    def test_strip_ansi(self):
        colored = "\x1b[31mRed Text\x1b[0m normal \x1b[1;32mGreen\x1b[0m"
        self.assertEqual(strip_ansi(colored), "Red Text normal Green")

    def test_compress_output_with_errors(self):
        # 100 lines of passing progress followed by a failure
        lines = [f"test_item_{i} ... OK" for i in range(100)]
        lines.append("Traceback (most recent call last):")
        lines.append('  File "test_runner.py", line 42, in test_fn')
        lines.append("AssertionError: expected 200, got 500")
        lines.append("FAILED (failures=1)")

        raw = "\n".join(lines)
        compressed = compress_terminal_output(raw, max_lines=20)
        
        self.assertIn("AssertionError: expected 200, got 500", compressed)
        self.assertIn("Traceback", compressed)
        self.assertIn("lines elided", compressed)
        self.assertLess(len(compressed.splitlines()), 50)

    def test_generate_repo_map(self):
        project_root = Path(__file__).resolve().parents[2]
        repo_map = generate_repo_map(str(project_root), max_tokens=200)
        self.assertIn("📁", repo_map)
        self.assertIn("README.md", repo_map)

if __name__ == '__main__':
    unittest.main()

