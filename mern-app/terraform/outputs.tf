output "frontend_service_url" { value = "https://app1.${local.domain_name}/" }
output "backend_service_url" { value = "https://app1.${local.domain_name}/api" }
output "ecs_cluster_name" { value = aws_ecs_cluster.mern.name }
output "frontend_service_name" { value = aws_ecs_service.frontend.name }
output "backend_service_name" { value = aws_ecs_service.backend.name }
