# Port Configuration Standards
# This file defines the standard port configuration for all services
# All Docker, Terraform, and application configurations must align with these standards

# Service port mappings - SINGLE SOURCE OF TRUTH
MERN_FRONTEND_PORT=80
MERN_BACKEND_PORT=5000  
PYTHON_APP_PORT=80

# Port assignment rules:
# 1. Frontend services (serving static content): Port 80
# 2. Backend APIs (serving dynamic content): Port 5000
# 3. Standalone applications: Port 80 (unless specific requirements)

# Layer alignment requirements:
# Each service MUST have consistent ports across ALL layers:
# 
# ┌─────────────────┬──────────────┬──────────────┬──────────────┐
# │ Service         │ Docker       │ Terraform    │ ALB Target   │
# │                 │ EXPOSE       │ containerPort│ Group        │
# ├─────────────────┼──────────────┼──────────────┼──────────────┤
# │ MERN Frontend   │ 80           │ 80           │ 80           │
# │ MERN Backend    │ 5000         │ 5000         │ 5000         │
# │ Python App      │ 80           │ 80           │ 80           │
# └─────────────────┴──────────────┴──────────────┴──────────────┘

# VALIDATION REQUIREMENTS:
# 1. All changes to port configurations must be validated with validate-port-alignment.sh
# 2. Port changes require updates to ALL layers simultaneously
# 3. CI/CD pipeline must validate port alignment before deployment
# 4. Port mismatches will cause deployment failures

# Change process:
# 1. Update this standards file
# 2. Update Docker EXPOSE statements
# 3. Update application listening ports
# 4. Update Terraform containerPort configurations
# 5. Update ALB target group port configurations
# 6. Run validation script to confirm alignment
# 7. Test locally before committing
