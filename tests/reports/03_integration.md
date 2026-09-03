# 03 Integration Report

Status: **PASS**

Ran at: 2026-09-03 00:10:33 UTC

## Cases

- [PASS] test_health_and_config (test_http.HttpTests.test_health_and_config): ok
- [PASS] test_list_and_stats (test_http.HttpTests.test_list_and_stats): ok
- [PASS] test_self_challenge_http (test_http.HttpTests.test_self_challenge_http): ok
- [PASS] test_submit_challenge_resolve_flow (test_http.HttpTests.test_submit_challenge_resolve_flow): ok

## Log

```
test_health_and_config (test_http.HttpTests.test_health_and_config) ... ok
test_list_and_stats (test_http.HttpTests.test_list_and_stats) ... ok
test_non_owner_pause_rejected (test_http.HttpTests.test_non_owner_pause_rejected) ... /usr/lib/python3.14/tempfile.py:484: ResourceWarning: Implicitly cleaning up <HTTPError 400: 'Bad Request'>
  _warnings.warn(self.warn_message, ResourceWarning)
ok
test_self_challenge_http (test_http.HttpTests.test_self_challenge_http) ... ok
test_submit_challenge_resolve_flow (test_http.HttpTests.test_submit_challenge_resolve_flow) ... ok

----------------------------------------------------------------------
Ran 5 tests in 0.757s

OK
<sys>:0: ResourceWarning: unclosed file <_io.BufferedReader name=6>
<sys>:0: ResourceWarning: unclosed file <_io.BufferedReader name=4>
```
