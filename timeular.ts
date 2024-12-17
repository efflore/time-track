import { fetch } from 'bun'
import * as dotenv from 'dotenv'
dotenv.config()

type TimeularEntry = {
    id: number;
    activity: {
        id: number;
        name: string;
        color: string;
        folderId: number;
    },
    duration: {
        startedAt: string;
        stoppedAt: string;
    },
    note: {
        text: string;
        tags: any[];
        mentions: any[];
    };
}

const TIMEULAR_API_URL = process.env.TIMEULAR_API_URL

let accessToken: string | null = null;

async function signInToTimeular() {
    const response = await fetch(`${TIMEULAR_API_URL}developer/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey: process.env.TIMEULAR_API_KEY,
            apiSecret: process.env.TIMEULAR_API_SECRET,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to sign in to Timeular API: ${response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.token;
    console.log('Successfully authenticated with Timeular API');
    return accessToken;
}

function formatTimeularTimestamp(date: Date): string {
    return date.toISOString().replace('Z', ''); // Remove the trailing Z
}

async function fetchTimeularEntries() {
    if (!accessToken) {
        console.log('Access token not found, signing in...');
        await signInToTimeular();
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Set to start of the current day
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // Set to end of the current day

    const startISO = formatTimeularTimestamp(startDate);
    const endISO = formatTimeularTimestamp(endDate);

    const url = `${TIMEULAR_API_URL}time-entries/${startISO}/${endISO}`;
    console.log(`Fetching entries from URL: ${url}`);

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (response.status === 401) {
        console.log('Access token expired or invalid, retrying...');
        await signInToTimeular(); // Re-authenticate
        return fetchTimeularEntries(); // Retry fetching entries
    }

    if (!response.ok) {
        console.error('Failed to fetch time entries:', await response.text());
        throw new Error(`Failed to fetch time entries: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Fetched entries:', data);
    return data.timeEntries;
}

export { type TimeularEntry, fetchTimeularEntries }