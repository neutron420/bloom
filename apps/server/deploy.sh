#!/bin/bash

# AWS ECS Deployment Script for Bloom Server
# Usage: ./deploy.sh [region] [account-id]

set -e

REGION=${1:-us-east-1}
ACCOUNT_ID=${2:-""}
ECR_REPO="bloom-server"
CLUSTER_NAME="bloom-cluster"
SERVICE_NAME="bloom-server"

if [ -z "$ACCOUNT_ID" ]; then
    echo "Error: AWS Account ID required"
    echo "Usage: ./deploy.sh [region] [account-id]"
    exit 1
fi

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

echo "Starting deployment..."
echo "Region: $REGION"
echo "Account ID: $ACCOUNT_ID"
echo "ECR URI: $ECR_URI"

# Step 1: Build Docker image
echo "Building Docker image..."
docker build -t ${ECR_REPO}:latest .

# Step 2: Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Step 3: Tag and push image
echo "Tagging image..."
docker tag ${ECR_REPO}:latest ${ECR_URI}:latest

echo "Pushing image to ECR..."
docker push ${ECR_URI}:latest

# Step 4: Update ECS service
echo "Updating ECS service..."
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${SERVICE_NAME} \
    --force-new-deployment \
    --region ${REGION} > /dev/null

echo "[SUCCESS] Deployment initiated!"
echo "Check status with: aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${REGION}"

