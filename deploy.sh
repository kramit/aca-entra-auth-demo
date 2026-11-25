#!/usr/bin/env bash
set -euo pipefail

: "${SUBSCRIPTION:?Set SUBSCRIPTION to your Azure subscription ID}"
: "${ACR:?Set ACR to a globally unique lowercase registry name}"
RG=${RG:-rg-aca-entra-auth-demo}
LOCATION=${LOCATION:-uksouth}
APP=aca-entra-auth-demo
ENVIRONMENT=cae-entra-auth-demo
IDENTITY=id-aca-entra-pull
TAG=$(git rev-parse --short=12 HEAD)
REPOSITORY=entra-demo

az account set --subscription "$SUBSCRIPTION"
az group create -n "$RG" -l "$LOCATION" --query '{name:name,location:location}' -o table
az acr create -g "$RG" -n "$ACR" -l "$LOCATION" --sku Basic --admin-enabled false \
  --role-assignment-mode rbac --query '{name:name,sku:sku.name,admin:adminUserEnabled}' -o table
az acr config authentication-as-arm update -r "$ACR" --status enabled -o none
az acr config authentication-as-arm show -r "$ACR" -o table

az acr build -r "$ACR" -t "$REPOSITORY:$TAG" .
DIGEST=$(az acr repository show -n "$ACR" --image "$REPOSITORY:$TAG" --query digest -o tsv)
REGISTRY=$(az acr show -n "$ACR" --query loginServer -o tsv)
REGISTRY_ID=$(az acr show -n "$ACR" --query id -o tsv)
echo "Built image digest: $DIGEST"

az identity create -g "$RG" -n "$IDENTITY" -l "$LOCATION" -o none
IDENTITY_ID=$(az identity show -g "$RG" -n "$IDENTITY" --query id -o tsv)
PRINCIPAL_ID=$(az identity show -g "$RG" -n "$IDENTITY" --query principalId -o tsv)
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
  --role AcrPull --scope "$REGISTRY_ID" --query roleDefinitionName -o tsv

az containerapp env create -g "$RG" -n "$ENVIRONMENT" -l "$LOCATION" \
  --enable-workload-profiles --logs-destination none --query properties.provisioningState -o tsv

for attempt in 1 2 3; do
  if az containerapp create -g "$RG" -n "$APP" --environment "$ENVIRONMENT" \
    --image "$REGISTRY/$REPOSITORY@$DIGEST" --registry-server "$REGISTRY" \
    --user-assigned "$IDENTITY_ID" --registry-identity "$IDENTITY_ID" \
    --ingress external --target-port 8080 --cpu 0.25 --memory 0.5Gi \
    --min-replicas 0 --max-replicas 1 --query properties.configuration.ingress.fqdn -o tsv; then
    break
  fi
  if [[ "$attempt" == 3 ]]; then exit 1; fi
  sleep 30
done
az containerapp revision list -g "$RG" -n "$APP" \
  --query '[].{name:name,state:properties.runningState,image:properties.template.containers[0].image}' -o table
