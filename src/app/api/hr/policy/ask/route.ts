import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { retrieveRelevantPolicies } from '@/services/policyReasoningService';
import { generatePolicyAnswer } from '@/services/gemini';

/**
 * POST /api/hr/policy/ask
 * Grounded HR Policy Compliance QA endpoint.
 * Strictly restricted to 'recruiter' and 'admin' roles. Students receive 403 Forbidden.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload. Please provide a question string.' },
        { status: 400 }
      );
    }

    const { question, category } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'A valid question string is required.' },
        { status: 400 }
      );
    }

    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < 5) {
      return NextResponse.json(
        { error: 'Question is too short. Please provide at least 5 characters.' },
        { status: 400 }
      );
    }

    if (trimmedQuestion.length > 1000) {
      return NextResponse.json(
        { error: 'Question exceeds the maximum allowed length of 1000 characters.' },
        { status: 400 }
      );
    }

    // 1. Retrieve authoritative policy sections deterministically
    const retrieval = await retrieveRelevantPolicies(trimmedQuestion, {
      category,
      minScore: 25,
      limit: 4
    });

    // 2. Synthesize grounded answer via Gemini or deterministic fallback
    const result = await generatePolicyAnswer(trimmedQuestion, retrieval.sources);

    return NextResponse.json({
      success: true,
      question: trimmedQuestion,
      answer: result.answer,
      interpretation: result.interpretation,
      confidence: result.confidence,
      grounded: result.grounded,
      sources: result.sources,
      recommendedNextSteps: result.recommendedNextSteps,
      matchCount: retrieval.matchCount
    }, { status: 200 });
  } catch (error: any) {
    console.error('Policy QA Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing policy inquiry.' },
      { status: 500 }
    );
  }
}, ['recruiter', 'admin']);
