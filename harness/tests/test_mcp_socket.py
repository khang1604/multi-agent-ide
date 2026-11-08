import unittest
import socket
import json
import os
from pathlib import Path

class TestIdeMcpSocket(unittest.TestCase):
    def setUp(self):
        self.sock_path = Path.home() / '.multi-agent-ide/ipc.sock'

    def test_mcp_socket_communication(self):
        if not self.sock_path.exists():
            self.skipTest("IDE MCP Socket not running in active test environment")

        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(2.0)
        try:
            s.connect(str(self.sock_path))
            
            # 1. Initialize
            s.sendall(json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {}}).encode('utf-8') + b'\n')
            data = s.recv(4096).decode('utf-8')
            init_res = json.loads(data)
            self.assertEqual(init_res.get('result', {}).get('serverInfo', {}).get('name'), 'multi-agent-ide-core')

            # 2. Tools list
            s.sendall(json.dumps({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}}).encode('utf-8') + b'\n')
            data = s.recv(4096).decode('utf-8')
            tools_res = json.loads(data)
            tool_names = [t['name'] for t in tools_res.get('result', {}).get('tools', [])]
            self.assertIn('ide_open_diff', tool_names)
            self.assertIn('ide_highlight_range', tool_names)
            self.assertIn('ide_update_plan', tool_names)
            self.assertIn('ide_request_human_approval', tool_names)
        finally:
            s.close()

if __name__ == '__main__':
    unittest.main()

