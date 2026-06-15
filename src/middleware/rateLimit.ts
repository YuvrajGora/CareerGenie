import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import RateLimit from '@/models/RateLimit';
import { AuthenticatedRequest } from './auth';

interface RateLimitOptions {
  windowMs: number; // window size in milliseconds
  maxHits: number;   // max requests allowed within windowMs
  keyPrefix?: string;
}

/**
 * Rate limiting middleware wrapper for Next.js Route Handlers.
 */
export function withRateLimit(
  handler: (req: any, context: any) => Promise<NextResponse>,
  options: RateLimitOptions
) {
  return async (req: NextRequest, context: any) => {
    try {
      await dbConnect();

      // Resolve unique identity identifier: authenticated user ID or IP fallback
      const authReq = req as AuthenticatedRequest;
      const identifier = authReq.user?._id?.toString() || (req as any).ip || req.headers.get('x-forwarded-for') || 'anonymous';
      
      const prefix = options.keyPrefix || 'rate_limit';
      const path = req.nextUrl.pathname;
      const key = `${prefix}:${identifier}:${path}`;

      const now = new Date();
      const expireAt = new Date(now.getTime() + options.windowMs);

      // Fetch existing rate limit tracking record
      let record = await RateLimit.findOne({ key });

      if (!record) {
        try {
          record = await RateLimit.create({
            key,
            points: 1,
            expireAt
          });
        } catch (err: any) {
          // Handle concurrency race conditions
          record = await RateLimit.findOne({ key });
          if (record) {
            record.points += 1;
            await record.save();
          }
        }
      } else {
        // Enforce rate limit threshold check
        if (record.points >= options.maxHits) {
          const retryAfterSeconds = Math.max(0, Math.ceil((record.expireAt.getTime() - now.getTime()) / 1000));
          
          return NextResponse.json(
            { 
              error: 'Too many requests. Please try again later.',
              retryAfter: retryAfterSeconds
            }, 
            { 
              status: 429,
              headers: {
                'Retry-After': String(retryAfterSeconds),
                'X-RateLimit-Limit': String(options.maxHits),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(record.expireAt.getTime() / 1000))
              }
            }
          );
        }

        record.points += 1;
        await record.save();
      }

      // Execute request handler
      const response = await handler(req, context);
      
      // Inject standard RateLimit headers into response
      const remaining = Math.max(0, options.maxHits - (record ? record.points : 1));
      response.headers.set('X-RateLimit-Limit', String(options.maxHits));
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil((record ? record.expireAt.getTime() : expireAt.getTime()) / 1000)));

      return response;
    } catch (error) {
      console.error('Rate limiting middleware error:', error);
      // Fail-open: guarantee route remains accessible during transient failures
      return await handler(req, context);
    }
  };
}
