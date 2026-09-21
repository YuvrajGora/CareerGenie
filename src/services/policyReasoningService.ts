import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import PolicyDocument, { IPolicyDocument, IPolicySection } from '@/models/PolicyDocument';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RetrievedPolicySource {
  policyId: string;
  policyCode: string;
  title: string;
  category: string;
  version: string;
  effectiveDate: string;
  relevantSection: string;
  sectionId: string;
  sourceText: string;
  relevanceScore: number;
  matchReasons: string[];
}

export interface PolicyRetrievalResult {
  query: string;
  hasMatches: boolean;
  sources: RetrievedPolicySource[];
  topPolicyCode?: string;
  matchCount: number;
}

export interface PolicyLibraryFilter {
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
}

export interface PolicySummaryItem {
  _id: string;
  policyCode: string;
  title: string;
  category: string;
  summary: string;
  version: string;
  status: string;
  effectiveDate: string;
  lastReviewedDate?: string;
  approvedBy?: string;
  sectionsCount: number;
  sections: Array<{
    sectionId: string;
    title: string;
    content: string;
    keywords: string[];
  }>;
}

// ============================================================================
// 1. DETERMINISTIC RELEVANCE SCORING & RETRIEVAL LOGIC
// ============================================================================

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'and', 'or', 'but', 'if', 'what', 'when', 'where',
  'who', 'how', 'which', 'can', 'could', 'should', 'would', 'will', 'my', 'our',
  'we', 'i', 'you', 'they', 'it', 'its', 'does', 'company', 'policy'
]);

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Deterministically calculates relevance between a query and a policy document section.
 */
export function scorePolicySection(
  policy: IPolicyDocument | any,
  section: IPolicySection,
  query: string,
  tokens: string[]
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const lowerQuery = query.toLowerCase();
  const lowerSectionTitle = section.title.toLowerCase();
  const lowerSectionContent = section.content.toLowerCase();
  const lowerPolicyTitle = policy.title.toLowerCase();
  const lowerPolicyCode = policy.policyCode.toLowerCase();
  const lowerCategory = policy.category.toLowerCase();

  // 1. Direct Policy Code Match (Highest confidence)
  const escapedCode = lowerPolicyCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escapedCode}\\b`, 'i').test(lowerQuery)) {
    score += 100;
    reasons.push(`Direct policy code match (${policy.policyCode})`);
  } else {
    // Check partial code matching (e.g., "PTO", "REM", "PRO", "CON")
    const codeParts = lowerPolicyCode.split('-');
    for (const part of codeParts) {
      if (part.length >= 3 && part !== 'pol' && part !== '2026') {
        const wordRegex = new RegExp(`\\b${part}\\b`, 'i');
        if (wordRegex.test(lowerQuery)) {
          score += 50;
          reasons.push(`Policy code keyword match (${part.toUpperCase()})`);
          break;
        }
      }
    }
  }

  // 2. Exact Phrase Matches
  if (lowerQuery.length >= 8) {
    if (lowerSectionTitle.includes(lowerQuery)) {
      score += 80;
      reasons.push(`Exact phrase match in section title: "${section.title}"`);
    } else if (lowerSectionContent.includes(lowerQuery)) {
      score += 60;
      reasons.push(`Exact phrase match in section content`);
    }
  }

  // 3. Category match
  const categoryTerms = lowerCategory.replace(/_/g, ' ').split(' ');
  for (const cTerm of categoryTerms) {
    if (cTerm.length > 2 && new RegExp(`\\b${cTerm}\\b`, 'i').test(lowerQuery)) {
      score += 25;
      reasons.push(`Policy category relevance (${policy.category})`);
      break;
    }
  }

  // 4. Policy Title Matches
  for (const token of tokens) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(lowerPolicyTitle)) {
      score += 20;
      reasons.push(`Policy title matched "${token}"`);
    }
  }

  // 5. Section Keywords Match (High semantic intent)
  const keywords = section.keywords || [];
  for (const kw of keywords) {
    const lowerKw = kw.toLowerCase();
    if (new RegExp(`\\b${lowerKw}\\b`, 'i').test(lowerQuery)) {
      score += 40;
      reasons.push(`Direct keyword match: "${kw}"`);
    } else {
      for (const token of tokens) {
        if (new RegExp(`\\b${token}\\b`, 'i').test(lowerKw)) {
          score += 20;
          reasons.push(`Keyword token match: "${token}" in "${kw}"`);
        }
      }
    }
  }

  // 6. Section Title Token Matches
  for (const token of tokens) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(lowerSectionTitle)) {
      score += 25;
      reasons.push(`Section title matched "${token}"`);
    }
  }

  // 7. Section Content Token Matches
  let contentMatches = 0;
  for (const token of tokens) {
    if (new RegExp(`\\b${token}\\b`, 'i').test(lowerSectionContent)) {
      contentMatches++;
      score += 10;
    }
  }
  if (contentMatches > 0) {
    reasons.push(`${contentMatches} term match(es) in section text`);
  }

  return { score, reasons };
}

/**
 * Pure function: Scores and ranks sections from an array of policy documents.
 * Can be executed without database dependencies for unit testing and fast retrieval.
 */
export function rankPolicySections(
  policies: Array<IPolicyDocument | any>,
  query: string,
  options: { minScore?: number; limit?: number } = {}
): RetrievedPolicySource[] {
  const minScore = options.minScore ?? 30;
  const limit = options.limit ?? 4;
  const tokens = tokenizeQuery(query);

  const scoredSources: RetrievedPolicySource[] = [];

  for (const policy of policies) {
    // Only search active policies by default
    if (policy.status && policy.status !== 'active') continue;

    const sections: IPolicySection[] = policy.sections || [];
    for (const section of sections) {
      const { score, reasons } = scorePolicySection(policy, section, query, tokens);
      if (score >= minScore) {
        scoredSources.push({
          policyId: policy._id?.toString() || policy.policyCode,
          policyCode: policy.policyCode,
          title: policy.title,
          category: policy.category,
          version: policy.version || '1.0',
          effectiveDate: policy.effectiveDate ? new Date(policy.effectiveDate).toISOString().split('T')[0] : '2026-01-01',
          sectionId: section.sectionId,
          relevantSection: `${section.sectionId} — ${section.title}`,
          sourceText: section.content,
          relevanceScore: score,
          matchReasons: Array.from(new Set(reasons))
        });
      }
    }
  }

  // Sort descending by relevance score
  scoredSources.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scoredSources.slice(0, limit);
}

// ============================================================================
// 2. DATABASE-BACKED RETRIEVAL SERVICE
// ============================================================================

/**
 * Retrieves the most relevant policy documents and sections from the database.
 * If MongoDB is not connected or returns empty, falls back gracefully.
 */
export async function retrieveRelevantPolicies(
  query: string,
  options: { minScore?: number; limit?: number; category?: string } = {}
): Promise<PolicyRetrievalResult> {
  let policies: IPolicyDocument[] = [];

  try {
    await connectDB();
    const dbQuery: Record<string, any> = { status: 'active' };
    if (options.category && options.category !== 'all') {
      dbQuery.category = options.category;
    }
    policies = await PolicyDocument.find(dbQuery).lean();
  } catch (error) {
    console.warn('Policy retrieval: Database connection not available or failed, using local/fallback ranking:', error);
    policies = [];
  }

  const sources = rankPolicySections(policies, query, {
    minScore: options.minScore ?? 30,
    limit: options.limit ?? 4
  });

  return {
    query,
    hasMatches: sources.length > 0,
    sources,
    topPolicyCode: sources.length > 0 ? sources[0].policyCode : undefined,
    matchCount: sources.length
  };
}

/**
 * Retrieves the list of policy documents for the Policy Library view.
 */
export async function getPolicyLibrary(
  filter: PolicyLibraryFilter = {}
): Promise<PolicySummaryItem[]> {
  await connectDB();

  const query: Record<string, any> = {};
  if (filter.status && filter.status !== 'all') {
    query.status = filter.status;
  }
  if (filter.category && filter.category !== 'all') {
    query.category = filter.category;
  }
  if (filter.search && filter.search.trim().length > 0) {
    const s = filter.search.trim();
    query.$or = [
      { title: { $regex: s, $options: 'i' } },
      { policyCode: { $regex: s, $options: 'i' } },
      { summary: { $regex: s, $options: 'i' } }
    ];
  }

  const limit = filter.limit ? Math.min(100, Math.max(1, filter.limit)) : 50;

  const docs = await PolicyDocument.find(query)
    .sort({ policyCode: 1 })
    .limit(limit)
    .lean();

  return docs.map((doc: any) => ({
    _id: doc._id.toString(),
    policyCode: doc.policyCode,
    title: doc.title,
    category: doc.category,
    summary: doc.summary,
    version: doc.version || '1.0',
    status: doc.status || 'active',
    effectiveDate: doc.effectiveDate ? new Date(doc.effectiveDate).toISOString().split('T')[0] : '2026-01-01',
    lastReviewedDate: doc.lastReviewedDate ? new Date(doc.lastReviewedDate).toISOString().split('T')[0] : undefined,
    approvedBy: doc.approvedBy,
    sectionsCount: (doc.sections || []).length,
    sections: (doc.sections || []).map((sec: any) => ({
      sectionId: sec.sectionId,
      title: sec.title,
      content: sec.content,
      keywords: sec.keywords || []
    }))
  }));
}

/**
 * Retrieves a single complete policy document by its ID or policyCode.
 */
export async function getPolicyByCodeOrId(identifier: string): Promise<any | null> {
  await connectDB();

  let policy: any = null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    policy = await PolicyDocument.findById(identifier).lean();
  }
  if (!policy) {
    policy = await PolicyDocument.findOne({ policyCode: identifier.toUpperCase().trim() }).lean();
  }

  return policy;
}
