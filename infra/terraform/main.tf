provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile
}

module "website" {
  source = "./modules/website"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  environment        = var.environment
  project_slug       = var.project_slug
  domain_name        = var.domain_name
  hosted_zone_domain = var.hosted_zone_domain
  tags               = var.tags
}
