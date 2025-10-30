terraform {
  backend "s3" {
    bucket         = "casperkristiansson-draw-terraform-state"
    dynamodb_table = "draw-terraform-locks"
    key            = "terraform.tfstate"
    profile        = "Personal"
    region         = "eu-north-1"
  }
}
