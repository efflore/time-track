import { serve } from 'bun'
import { readFileSync } from 'fs'
import path from 'path'
import { type TimeularEntry, fetchTimeularEntries } from './timeular'
import { fetchVertecProjects } from './vertec'

serve({
    fetch: async (req) => {
        const url = new URL(req.url);

        if (url.pathname === '/' && req.method === 'GET') {
            try {
                const entries = await fetchTimeularEntries();
				const projects = await fetchVertecProjects();
                const template = readFileSync(path.resolve('views/entries.html'), 'utf-8');
                const html = template
					.replace('{{entries}}', renderEntries(entries))
					.replace('{{projects}}', renderProjects(JSON.stringify(projects)));
                return new Response(html, { headers: { 'Content-Type': 'text/html' } });
            } catch (error) {
                console.error(error);
                return new Response('Failed to load entries', { status: 500 });
            }
        }

        if (url.pathname === '/styles.css' && req.method === 'GET') {
            const css = readFileSync(path.resolve('public/styles.css'), 'utf-8');
            return new Response(css, { headers: { 'Content-Type': 'text/css' } });
        }

        /* if (url.pathname === '/submit' && req.method === 'POST') {
            const formData = await req.json();
            const vertecResponse = await submitToVertec(formData.entries);
            return new Response(JSON.stringify(vertecResponse), { headers: { 'Content-Type': 'application/json' } });
        } */

        return new Response('Not Found', { status: 404 });
    },
    port: 3456,
});

function formatTimeForInput(timeString: string): string {
    const date = new Date(timeString);
    return date.toISOString().slice(11, 23); // Extract "HH:mm:ss.SSS"
}

function renderEntries(entries: TimeularEntry[]): string {
    return entries.map((entry) => `
        <tr>
            <td><input type="text" name="entries[${entry.id}][description]" value="${entry.note.text}"></td>
            <td><input type="time" name="entries[${entry.id}][start]" value="${formatTimeForInput(entry.duration.startedAt)}"></td>
            <td><input type="time" name="entries[${entry.id}][end]" value="${formatTimeForInput(entry.duration.stoppedAt)}"></td>
        </tr>
    `).join('');
}

function renderProjects(projects: string): string {
	return projects;
}