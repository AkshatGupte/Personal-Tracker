#!/usr/bin/env bash
# Every logic suite in this directory. No test framework and no dependencies —
# these are pure functions over dates and numbers, and a runner would be more
# machinery than the thing it runs.
#
#   ./qa/run-tests.sh
set -u
cd "$(dirname "$0")/.."
status=0
for suite in qa/*.test.mjs; do
  echo "── $suite"
  node --experimental-strip-types --disable-warning=ExperimentalWarning \
       --import ./qa/register-alias.mjs "$suite" || status=1
done
exit $status
