import hashlib
import unittest

from bitunix_server import clear_credentials, get_positions, set_credentials, sign_request


class BitunixServerTests(unittest.TestCase):
    def tearDown(self):
        clear_credentials()

    def test_signing_uses_bitunix_double_sha256(self):
        nonce, timestamp, key, secret = "a" * 32, "1700000000000", "public-key", "private-secret"
        first = hashlib.sha256((nonce + timestamp + key).encode()).hexdigest()
        expected = hashlib.sha256((first + secret).encode()).hexdigest()
        self.assertEqual(sign_request(nonce, timestamp, key, secret), expected)

    def test_signature_includes_sorted_query_and_body_inputs(self):
        nonce, timestamp, key, secret = "b" * 32, "1700000000000", "k", "s"
        query, body = "symbolBTCUSDT", '{"limit":10}'
        first = hashlib.sha256((nonce + timestamp + key + query + body).encode()).hexdigest()
        self.assertEqual(sign_request(nonce, timestamp, key, secret, query, body), hashlib.sha256((first + secret).encode()).hexdigest())

    def test_credentials_are_required_and_cleared_on_disconnect(self):
        with self.assertRaises(PermissionError):
            get_positions()
        set_credentials("test-key", "test-secret")
        clear_credentials()
        with self.assertRaises(PermissionError):
            get_positions()


if __name__ == "__main__":
    unittest.main()
