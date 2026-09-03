# 06 Lifecycle Report

Status: **PASS**

Ran at: 2026-09-03 00:10:34 UTC

## Cases

- [PASS] test_consecutive_submissions_increment_id (test_onchain_flow.DirectIdReturnTests.test_consecutive_submissions_increment_id): ok
- [PASS] test_first_submit_returns_id_directly (test_onchain_flow.DirectIdReturnTests.test_first_submit_returns_id_directly): ok
- [PASS] test_id_returned_with_does_not_require_next_id (test_onchain_flow.DirectIdReturnTests.test_id_returned_with_does_not_require_next_id): ok
- [PASS] test_recorded_verdicts_include_unadjudicated (test_onchain_flow.ProtocolVocabularyTests.test_recorded_verdicts_include_unadjudicated): ok
- [PASS] test_validator_verdicts_exclude_unadjudicated (test_onchain_flow.ProtocolVocabularyTests.test_validator_verdicts_exclude_unadjudicated): ok
- [PASS] test_full_lifecycle_unadjudicated (test_onchain_flow.UnchallengedExpiryTests.test_full_lifecycle_unadjudicated): ok
- [PASS] test_resolve_before_deadline_unchallenged_is_not_eligible (test_onchain_flow.UnchallengedExpiryTests.test_resolve_before_deadline_unchallenged_is_not_eligible): ok
- [PASS] test_resolve_twice_after_expiry_rejected (test_onchain_flow.UnchallengedExpiryTests.test_resolve_twice_after_expiry_rejected): ok
- [PASS] test_arbitrary_string_outside_vocabulary_collapsed (test_onchain_flow.ValidatorVerdictBoundaryTests.test_arbitrary_string_outside_vocabulary_collapsed): ok
- [PASS] test_only_validator_verdicts_are_admitted (test_onchain_flow.ValidatorVerdictBoundaryTests.test_only_validator_verdicts_are_admitted): ok
- [PASS] test_unadjudicated_cannot_be_emitted_by_validator (test_onchain_flow.ValidatorVerdictBoundaryTests.test_unadjudicated_cannot_be_emitted_by_validator): ok

## Log

```
test_consecutive_submissions_increment_id (test_onchain_flow.DirectIdReturnTests.test_consecutive_submissions_increment_id) ... ok
test_first_submit_returns_id_directly (test_onchain_flow.DirectIdReturnTests.test_first_submit_returns_id_directly) ... ok
test_id_returned_with_does_not_require_next_id (test_onchain_flow.DirectIdReturnTests.test_id_returned_with_does_not_require_next_id) ... ok
test_recorded_verdicts_include_unadjudicated (test_onchain_flow.ProtocolVocabularyTests.test_recorded_verdicts_include_unadjudicated) ... ok
test_validator_verdicts_exclude_unadjudicated (test_onchain_flow.ProtocolVocabularyTests.test_validator_verdicts_exclude_unadjudicated) ... ok
test_full_lifecycle_unadjudicated (test_onchain_flow.UnchallengedExpiryTests.test_full_lifecycle_unadjudicated) ... ok
test_resolve_before_deadline_unchallenged_is_not_eligible (test_onchain_flow.UnchallengedExpiryTests.test_resolve_before_deadline_unchallenged_is_not_eligible) ... ok
test_resolve_twice_after_expiry_rejected (test_onchain_flow.UnchallengedExpiryTests.test_resolve_twice_after_expiry_rejected) ... ok
test_arbitrary_string_outside_vocabulary_collapsed (test_onchain_flow.ValidatorVerdictBoundaryTests.test_arbitrary_string_outside_vocabulary_collapsed) ... ok
test_only_validator_verdicts_are_admitted (test_onchain_flow.ValidatorVerdictBoundaryTests.test_only_validator_verdicts_are_admitted) ... ok
test_unadjudicated_cannot_be_emitted_by_validator (test_onchain_flow.ValidatorVerdictBoundaryTests.test_unadjudicated_cannot_be_emitted_by_validator) ... ok

----------------------------------------------------------------------
Ran 11 tests in 0.030s

OK
```
