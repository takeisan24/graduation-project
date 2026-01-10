import { NextResponse } from 'next/server';
import dotenv from 'dotenv';
dotenv.config();

const FALLBACK_RATE = process.env.FALLBACK_RATE || 26275;

// Enable caching for this route segment
export const dynamic = 'force-static';
export const revalidate = 86400; // Revalidate every 24 hours (86400 seconds)

export async function GET() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD', {
            // This fetch is cached by Next.js automatically for 'revalidate' seconds
            next: { revalidate: 86400 }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch from external API');
        }

        const data = await response.json();
        const rate = data.rates?.VND;

        if (!rate) {
            return NextResponse.json({ rate: FALLBACK_RATE, source: 'fallback_error' });
        }

        // Return the fresh (or cached) rate
        // Added timestamp to help verify caching behavior
        return NextResponse.json({
            rate,
            source: 'api_cached',
            updated_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        // In case of error (e.g. no internet), fallback
        return NextResponse.json({ rate: FALLBACK_RATE, source: 'fallback_exception' });
    }
}
