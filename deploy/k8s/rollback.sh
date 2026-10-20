#!/bin/sh
# Revert the last Deployment revision.
# The API is one process (mtd-api). Logical service names are labels, not Deployments.
# Usage: ./rollback.sh [deployment-name]
# Example: ./rollback.sh mtd-api
set -eu
name="${1:-mtd-api}"
namespace="${NAMESPACE:-mtd}"
kubectl -n "$namespace" rollout undo "deployment/${name}"
kubectl -n "$namespace" rollout status "deployment/${name}"
