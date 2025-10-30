variable "environment" {
  description = "Deployment environment name (e.g. dev, prod)."
  type        = string
}

variable "project_slug" {
  description = "Slug used as base for resource names."
  type        = string
  default     = "draw"
}

variable "domain_name" {
  description = "Fully qualified domain name for the CloudFront distribution."
  type        = string
}

variable "hosted_zone_domain" {
  description = "Base hosted zone domain (without trailing dot)."
  type        = string
}

variable "tags" {
  description = "Common tags to apply to resources."
  type        = map(string)
  default     = {}
}
