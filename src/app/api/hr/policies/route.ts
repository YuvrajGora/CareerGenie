import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { getPolicyLibrary, getPolicyByCodeOrId } from '@/services/policyReasoningService';

/**
 * GET /api/hr/policies
 * Retrieves official corporate policy library documents with category, status, and search filters.
 * Strictly restricted to 'recruiter' and 'admin' roles. Students receive 403 Forbidden.
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const code = searchParams.get('code');
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    // Single document inspection
    const targetIdentifier = id || code;
    if (targetIdentifier) {
      const policy = await getPolicyByCodeOrId(targetIdentifier);
      if (!policy) {
        return NextResponse.json(
          { error: `Policy document '${targetIdentifier}' not found.` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        policy
      }, { status: 200 });
    }

    // Library listing
    const policies = await getPolicyLibrary({
      category: category === 'all' ? undefined : category,
      status: status === 'all' ? undefined : status,
      search
    });

    return NextResponse.json({
      success: true,
      total: policies.length,
      policies
    }, { status: 200 });
  } catch (error: any) {
    console.error('Failed to retrieve policy library documents:', error);
    return NextResponse.json(
      { error: 'Internal server error while retrieving policy library documents.' },
      { status: 500 }
    );
  }
}, ['recruiter', 'admin']);
