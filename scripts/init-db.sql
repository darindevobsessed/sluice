-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Create test database for running tests
CREATE DATABASE goldminer_test;
\c goldminer_test
CREATE EXTENSION IF NOT EXISTS vector;
