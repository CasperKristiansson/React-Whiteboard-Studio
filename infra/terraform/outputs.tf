output "bucket_name" {
  description = "S3 bucket used for website content."
  value       = module.website.bucket_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID."
  value       = module.website.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain to use for CDN."
  value       = module.website.cloudfront_domain_name
}
