#!/bin/sh
# Revert the last Deployment revision for a logical service.
# Usage: ./rollback.sh <service-name>
# Example: ./rollback.sh practice
set -eu
name="${1:?service-name required (e.g. practice)}"
kubectl rollout undo "deployment/${name}"
kubectl rollout status "deployment/${name}"
