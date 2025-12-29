#!/bin/bash

# ============================================
# Docker Image Push Script for AWS ECR
# ============================================
# This script builds and pushes your Docker image to AWS ECR
#
# Usage: ./push-image.sh [region]
# Example: ./push-image.sh us-east-1

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get region from argument or use default
REGION=${1:-us-east-1}
REPO_NAME="bloom-server"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Docker Image Push to AWS ECR${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Get AWS Account ID
echo -e "${YELLOW}Step 1: Getting AWS Account ID...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}[ERROR] Could not get AWS Account ID${NC}"
    echo -e "${RED}   Make sure AWS CLI is configured: aws configure${NC}"
    exit 1
fi

    echo -e "${GREEN}[OK] AWS Account ID: ${ACCOUNT_ID}${NC}"
echo ""

# Step 2: Set ECR URI
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO_NAME}"
echo -e "${BLUE}ECR Repository URI: ${ECR_URI}${NC}"
echo ""

# Step 3: Check if ECR repository exists, create if not
echo -e "${YELLOW}Step 2: Checking ECR repository...${NC}"
if aws ecr describe-repositories --repository-names ${REPO_NAME} --region ${REGION} &>/dev/null; then
    echo -e "${GREEN}[OK] Repository exists${NC}"
else
    echo -e "${YELLOW}[WARN] Repository not found. Creating...${NC}"
    aws ecr create-repository --repository-name ${REPO_NAME} --region ${REGION} > /dev/null
    echo -e "${GREEN}[OK] Repository created${NC}"
fi
echo ""

# Step 4: Login to ECR
echo -e "${YELLOW}Step 3: Logging into ECR...${NC}"
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}
if [ $? -eq 0 ]; then
    echo -e "${GREEN}[OK] Logged in successfully${NC}"
else
    echo -e "${RED}[ERROR] Login failed${NC}"
    exit 1
fi
echo ""

# Step 5: Navigate to server directory
echo -e "${YELLOW}Step 4: Building Docker image...${NC}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}[ERROR] Dockerfile not found in ${SCRIPT_DIR}${NC}"
    exit 1
fi

# Build Docker image
docker build -t ${REPO_NAME}:latest .
if [ $? -eq 0 ]; then
    echo -e "${GREEN}[OK] Image built successfully${NC}"
else
    echo -e "${RED}[ERROR] Build failed${NC}"
    exit 1
fi
echo ""

# Step 6: Tag image
echo -e "${YELLOW}Step 5: Tagging image...${NC}"
docker tag ${REPO_NAME}:latest ${ECR_URI}:latest
echo -e "${GREEN}[OK] Image tagged${NC}"
echo ""

# Step 7: Push image
echo -e "${YELLOW}Step 6: Pushing image to ECR...${NC}"
echo -e "${BLUE}This may take a few minutes...${NC}"
docker push ${ECR_URI}:latest

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}[SUCCESS] Image pushed successfully${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Image URI: ${ECR_URI}:latest${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Update ecs-task-definition.json with this image URI"
    echo "2. Register task definition: aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json"
    echo "3. Create/update ECS service"
else
    echo -e "${RED}[ERROR] Push failed${NC}"
    exit 1
fi

