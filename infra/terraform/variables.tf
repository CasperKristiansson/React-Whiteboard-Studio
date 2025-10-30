variable "aws_region" {
  description = "AWS region for the primary provider."
  type        = string
  default     = "eu-north-1"
}

variable "aws_profile" {
  description = "Named AWS CLI profile to use."
  type        = string
  default     = "Personal"
}

variable "environment" {
  description = "Deployment environment identifier."
  type        = string
  default     = "prod"
}

variable "hosted_zone_domain" {
  description = "Base domain managed in Route53."
  type        = string
  default     = "casperkristiansson.com"
}

variable "domain_name" {
  description = "Fully qualified domain for the website."
  type        = string
  default     = "draw.casperkristiansson.com"
}

variable "project_slug" {
  description = "Slug used in resource names."
  type        = string
  default     = "draw"
}

variable "tags" {
  description = "Additional tags to apply to resources."
  type        = map(string)
  default     = {}
}
