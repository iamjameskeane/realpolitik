# Realpolitik Infrastructure

**Infrastructure as Code** for the distributed Realpolitik platform.

## Overview

This directory contains all infrastructure definitions for deploying and managing the Realpolitik distributed system across different environments:

- **Kubernetes**: Production-grade container orchestration
- **Terraform**: Cloud infrastructure provisioning
- **Docker**: Development and testing environments
- **Scripts**: Utility scripts for operations

## Directory Structure

```
infra/
├── k8s/                    # Kubernetes manifests
│   ├── base/               # Base service definitions
│   │   ├── atlas/          # PostgreSQL StatefulSet
│   │   ├── ariadne/        # Neo4j cluster
│   │   ├── mnemosyne/      # Qdrant collection
│   │   ├── lethe/          # Redis deployment
│   │   ├── iris/           # RabbitMQ cluster
│   │   └── ...             # All services
│   └── overlays/           # Environment-specific configs
│       ├── dev/            # Development environment
│       ├── staging/        # Staging environment  
│       └── production/     # Production environment
├── terraform/              # Cloud infrastructure
│   ├── modules/            # Reusable modules
│   └── main.tf            # Main configuration
└── scripts/               # Operational scripts
    ├── setup-CDC.sh       # CDC pipeline setup
    ├── seed-local.sh      # Local development data
    └── monitoring-setup.sh # Observability stack
```

## Kubernetes Architecture

### Namespace Organization

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: realpolitik-data
  labels:
    tier: data
---
apiVersion: v1
kind: Namespace
metadata:
  name: realpolitik-services
  labels:
    tier: services
```

### Service Mesh Configuration

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: realpolitik-services
spec:
  gateways:
  - realpolitik-gateway
  hosts:
  - api.realpolitik.world
  - chat.realpolitik.world
  http:
  - match:
    - uri:
        prefix: /api/
    route:
    - destination:
        host: delphi
        port:
          number: 8000
  - match:
    - uri:
        prefix: /ws/
    route:
    - destination:
        host: pythia
        port:
          number: 8001
```

## Data Layer (Titans)

### Atlas (PostgreSQL)

```yaml
# k8s/base/atlas/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: atlas
  namespace: realpolitik-data
spec:
  serviceName: atlas
  replicas: 1
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: realpolitik
        - name: POSTGRES_USER
          value: realpolitik
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: atlas-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /docker-entrypoint-initdb.d
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
```

### Ariadne (Neo4j)

```yaml
# k8s/base/ariadne/statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ariadne
  namespace: realpolitik-data
spec:
  serviceName: ariadne
  replicas: 3  # Core cluster
  template:
    spec:
      containers:
      - name: neo4j
        image: neo4j:5.15-community
        env:
        - name: NEO4J_ACCEPT_LICENSE_AGREEMENT
          value: "yes"
        - name: NEO4J_server_default_listen_address
          value: "0.0.0.0"
        - name: NEO4J_dbms_mode
          value: "CORE"
        - name: NEO4J_causal__clustering_minimum__core__cluster__size__at__formation
          value: "3"
        ports:
        - containerPort: 7474
        - containerPort: 7687
        - containerPort: 8000
        - containerPort: 8001
        volumeMounts:
        - name: neo4j-data
          mountPath: /data
        - name: neo4j-logs
          mountPath: /logs
  volumeClaimTemplates:
  - metadata:
      name: neo4j-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 500Gi
```

## Processing Services (Olympians)

### Argus (RSS Ingestion)

```yaml
# k8s/base/argus/cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: argus-rss-ingestion
  namespace: realpolitik-services
spec:
  schedule: "*/15 * * * *"  # Every 15 minutes
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: argus
            image: realpolitik/argus:latest
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-url
                  key: url
            - name: RABBITMQ_URL
              valueFrom:
                secretKeyRef:
                  name: rabbitmq-url
                  key: url
            resources:
              requests:
                memory: "512Mi"
                cpu: "250m"
              limits:
                memory: "2Gi"
                cpu: "1000m"
```

### Delphi (Application Server)

```yaml
# k8s/base/delphi/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: delphi
  namespace: realpolitik-services
spec:
  replicas: 3
  selector:
    matchLabels:
      app: delphi
  template:
    metadata:
      labels:
        app: delphi
    spec:
      containers:
      - name: delphi
        image: realpolitik/delphi:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: url
        - name: NEO4J_URI
          value: "bolt://ariadne:7687"
        - name: QDRANT_URI
          value: "http://mnemosyne:6333"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-url
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Horizontal Pod Autoscaling

```yaml
# k8s/base/delphi/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: delphi-hpa
  namespace: realpolitik-services
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: delphi
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Environment Overlays

### Development Environment

```yaml
# k8s/overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patches:
- target:
    kind: Deployment
    name: delphi
  patch: |
    - op: replace
      path: /spec/template/spec/containers/0/resources/requests/memory
      value: "128Mi"
    - op: replace
      path: /spec/replicas
      value: 1

configMapGenerator:
- name: dev-config
  literals:
  - ENVIRONMENT=development
  - LOG_LEVEL=DEBUG

secretGenerator:
- name: dev-secrets
  literals:
  - DATABASE_URL=postgresql://dev:dev@dev-atlas:5432/realpolitik
```

### Production Environment

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

patches:
- target:
    kind: Deployment
    name: delphi
  patch: |
    - op: replace
      path: /spec/template/spec/containers/0/resources/requests/cpu
      value: "500m"
    - op: replace
      path: /spec/template/spec/containers/0/resources/limits/cpu
      value: "2000m"

replicas:
- name: delphi
  count: 10
- name: cassandra
  count: 5

configMapGenerator:
- name: prod-config
  literals:
  - ENVIRONMENT=production
  - LOG_LEVEL=INFO

secretGenerator:
- name: prod-secrets
  files:
  - database-url=secrets/database-url.txt
  - api-keys=secrets/api-keys.txt

patchesStrategicMerge:
- resource-quota.yaml
- network-policy.yaml
```

## Deployment Commands

### Development

```bash
# Deploy to development cluster
kubectl apply -k infra/k8s/overlays/dev

# Watch deployment
kubectl get pods -w -n realpolitik-services

# Check logs
kubectl logs -f deployment/delphi -n realpolitik-services
```

### Production

```bash
# Deploy to production cluster
kubectl apply -k infra/k8s/overlays/production

# Check all namespaces
kubectl get all -A | grep realpolitik

# Monitor HPA
kubectl get hpa -w -n realpolitik-services
```

### Monitoring Setup

```bash
# Install observability stack
./scripts/monitoring-setup.sh

# Setup CDC pipeline
./scripts/setup-CDC.sh production

# Seed development data
./scripts/seed-local.sh development
```

## Secrets Management

### Kubernetes Secrets

```yaml
# Create sealed secrets
kubectl create secret generic atlas-secret \
  --from-literal=password=$(openssl rand -base64 32) \
  --namespace=realpolitik-data

# Use External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.realpolitik.world"
      path: "secret"
      version: "v2"
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: database-secret
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: database
      property: url
```

## Network Policies

```yaml
# k8s/base/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all-default
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-service-communication
spec:
  podSelector:
    matchLabels:
      app: delphi
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: realpolitik-services
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: realpolitik-data
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 7687  # Neo4j
```

## Resource Management

### Resource Quotas

```yaml
# k8s/base/resource-quota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    limits.cpu: "40"
    limits.memory: 80Gi
    pods: "50"
    persistentvolumeclaims: "20"
```

### Pod Disruption Budgets

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: delphi-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: delphi
```

## Backup and Recovery

### PostgreSQL Backup

```yaml
# k8s/base/atlas/backup-job.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: atlas-backup
  namespace: realpolitik-data
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/bash
            - -c
            - |
              pg_dump $DATABASE_URL | gzip > /backup/atlas-$(date +%Y%m%d-%H%M%S).sql.gz
              aws s3 cp /backup/atlas-*.sql.gz s3://realpolitik-backups/
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-url
                  key: url
          restartPolicy: OnFailure
```

## CI/CD Integration

### GitOps with ArgoCD

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: realpolitik
spec:
  project: default
  source:
    repoURL: https://github.com/realpolitik/realpolitik
    targetRevision: main
    path: infra/k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: realpolitik-services
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

This infrastructure setup provides:
- **High Availability**: Multi-replica deployments with health checks
- **Auto-Scaling**: HPA based on CPU/Memory metrics  
- **Security**: Network policies and secrets management
- **Observability**: Health endpoints and monitoring integration
- **Disaster Recovery**: Automated backups and restore procedures