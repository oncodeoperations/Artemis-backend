#!/usr/bin/env node

/**
 * Seed the LeaderboardEntry collection with realistic GitHub-vetted developer profiles.
 * Run: node scripts/seedLeaderboard.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const LeaderboardEntry = require('../src/models/LeaderboardEntry');

const entries = [
  {
    username: 'sarahdev',
    name: 'Sarah Chen',
    avatar: 'https://i.pravatar.cc/150?u=sarahdev',
    location: 'San Francisco, CA',
    country: 'US',
    overall_score: 91,
    overall_level: 'Expert',
    job_readiness_score: 88,
    tech_depth_score: 94,
    hiring_readiness: 'Strong Hire',
    category_scores: {
      code_sophistication: 23,
      engineering_practices: 22,
      project_maturity: 18,
      contribution_activity: 14,
      breadth_and_depth: 14,
    },
    primary_languages: ['TypeScript', 'Python', 'Go'],
    total_repositories: 47,
    opted_in: true,
  },
  {
    username: 'marcus-b',
    name: 'Marcus Brown',
    avatar: 'https://i.pravatar.cc/150?u=marcus-b',
    location: 'London, UK',
    country: 'GB',
    overall_score: 85,
    overall_level: 'Senior',
    job_readiness_score: 82,
    tech_depth_score: 88,
    hiring_readiness: 'Strong Hire',
    category_scores: {
      code_sophistication: 21,
      engineering_practices: 20,
      project_maturity: 17,
      contribution_activity: 13,
      breadth_and_depth: 14,
    },
    primary_languages: ['JavaScript', 'TypeScript', 'Rust'],
    total_repositories: 63,
    opted_in: true,
  },
  {
    username: 'ananya-k',
    name: 'Ananya Krishnan',
    avatar: 'https://i.pravatar.cc/150?u=ananya-k',
    location: 'Bangalore, India',
    country: 'IN',
    overall_score: 82,
    overall_level: 'Senior',
    job_readiness_score: 79,
    tech_depth_score: 85,
    hiring_readiness: 'Hire',
    category_scores: {
      code_sophistication: 20,
      engineering_practices: 19,
      project_maturity: 17,
      contribution_activity: 13,
      breadth_and_depth: 13,
    },
    primary_languages: ['Java', 'Python', 'Kotlin'],
    total_repositories: 38,
    opted_in: true,
  },
  {
    username: 'javier-r',
    name: 'Javier Rodriguez',
    avatar: 'https://i.pravatar.cc/150?u=javier-r',
    location: 'Madrid, Spain',
    country: 'ES',
    overall_score: 78,
    overall_level: 'Senior',
    job_readiness_score: 76,
    tech_depth_score: 80,
    hiring_readiness: 'Hire',
    category_scores: {
      code_sophistication: 19,
      engineering_practices: 18,
      project_maturity: 16,
      contribution_activity: 12,
      breadth_and_depth: 13,
    },
    primary_languages: ['C++', 'Python', 'JavaScript'],
    total_repositories: 29,
    opted_in: true,
  },
  {
    username: 'liwei88',
    name: 'Li Wei',
    avatar: 'https://i.pravatar.cc/150?u=liwei88',
    location: 'Shanghai, China',
    country: 'CN',
    overall_score: 74,
    overall_level: 'Mid-Level',
    job_readiness_score: 71,
    tech_depth_score: 77,
    hiring_readiness: 'Hire',
    category_scores: {
      code_sophistication: 18,
      engineering_practices: 17,
      project_maturity: 15,
      contribution_activity: 12,
      breadth_and_depth: 12,
    },
    primary_languages: ['Go', 'Python', 'C'],
    total_repositories: 24,
    opted_in: true,
  },
  {
    username: 'emilys-code',
    name: 'Emily Stone',
    avatar: 'https://i.pravatar.cc/150?u=emilys-code',
    location: 'Toronto, Canada',
    country: 'CA',
    overall_score: 70,
    overall_level: 'Mid-Level',
    job_readiness_score: 68,
    tech_depth_score: 72,
    hiring_readiness: 'Consider',
    category_scores: {
      code_sophistication: 17,
      engineering_practices: 16,
      project_maturity: 14,
      contribution_activity: 11,
      breadth_and_depth: 12,
    },
    primary_languages: ['JavaScript', 'React', 'Node.js'],
    total_repositories: 19,
    opted_in: true,
  },
  {
    username: 'omar-dev',
    name: 'Omar Hassan',
    avatar: 'https://i.pravatar.cc/150?u=omar-dev',
    location: 'Cairo, Egypt',
    country: 'EG',
    overall_score: 66,
    overall_level: 'Mid-Level',
    job_readiness_score: 63,
    tech_depth_score: 69,
    hiring_readiness: 'Consider',
    category_scores: {
      code_sophistication: 16,
      engineering_practices: 15,
      project_maturity: 13,
      contribution_activity: 11,
      breadth_and_depth: 11,
    },
    primary_languages: ['PHP', 'JavaScript', 'Python'],
    total_repositories: 22,
    opted_in: true,
  },
  {
    username: 'katya-ml',
    name: 'Katya Ivanova',
    avatar: 'https://i.pravatar.cc/150?u=katya-ml',
    location: 'Berlin, Germany',
    country: 'DE',
    overall_score: 88,
    overall_level: 'Expert',
    job_readiness_score: 86,
    tech_depth_score: 90,
    hiring_readiness: 'Strong Hire',
    category_scores: {
      code_sophistication: 22,
      engineering_practices: 21,
      project_maturity: 18,
      contribution_activity: 13,
      breadth_and_depth: 14,
    },
    primary_languages: ['Python', 'C++', 'Julia'],
    total_repositories: 31,
    opted_in: true,
  },
  {
    username: 'daiki-sys',
    name: 'Daiki Tanaka',
    avatar: 'https://i.pravatar.cc/150?u=daiki-sys',
    location: 'Tokyo, Japan',
    country: 'JP',
    overall_score: 76,
    overall_level: 'Senior',
    job_readiness_score: 74,
    tech_depth_score: 78,
    hiring_readiness: 'Hire',
    category_scores: {
      code_sophistication: 19,
      engineering_practices: 18,
      project_maturity: 15,
      contribution_activity: 12,
      breadth_and_depth: 12,
    },
    primary_languages: ['Rust', 'Go', 'TypeScript'],
    total_repositories: 35,
    opted_in: true,
  },
  {
    username: 'nina-fullstack',
    name: 'Nina Okafor',
    avatar: 'https://i.pravatar.cc/150?u=nina-fullstack',
    location: 'Lagos, Nigeria',
    country: 'NG',
    overall_score: 62,
    overall_level: 'Mid-Level',
    job_readiness_score: 60,
    tech_depth_score: 64,
    hiring_readiness: 'Consider',
    category_scores: {
      code_sophistication: 15,
      engineering_practices: 14,
      project_maturity: 13,
      contribution_activity: 10,
      breadth_and_depth: 10,
    },
    primary_languages: ['JavaScript', 'Python', 'Vue.js'],
    total_repositories: 15,
    opted_in: true,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing entries
    const deleted = await LeaderboardEntry.deleteMany({});
    console.log(`Cleared ${deleted.deletedCount} existing entries`);

    // Insert seed data
    const result = await LeaderboardEntry.insertMany(
      entries.map((e, i) => ({ ...e, rank: i + 1 }))
    );

    console.log(`Seeded ${result.length} leaderboard entries:`);
    result.forEach((e) =>
      console.log(`  ${e.rank}. ${e.name} (@${e.username}) — ${e.overall_score}/100 [${e.overall_level}]`)
    );

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
