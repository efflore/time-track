import { fetch } from 'bun'
import * as dotenv from 'dotenv'
import { XMLParser } from "fast-xml-parser"

type VertecObjectRef = {
    objref: string;
}

type VertecProject = {
	objid: string;
	code: string;
}

type VertecEntry = {
	objid: string;
	projekt: VertecObjectRef;
	phase: VertecObjectRef;
	datum: string;
	text: string;
	wertExt: string;
}

dotenv.config()

const VERTEC_API_URL = process.env.VERTEC_API_URL

async function vertecQuery(queryXml: string): Promise<string> {
    const response = await fetch(String(VERTEC_API_URL), {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.VERTEC_API_TOKEN}`,
            "Content-Type": "application/xml",
        },
        body: queryXml,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to query Vertec: ${response.status} - ${errorText}`);
    }

    return response.text(); // Returns the raw XML response
}

function buildQueryPayload(
	selection: Record<string, string>,
    resultdefMembers: string[]
): string {
	let selectionContent = "";
	for (const key in selection) {
		selectionContent += `<${key}>${selection[key]}</${key}>`;
	}
    const resultdef = resultdefMembers
        .map((member) => `<member>${member}</member>`)
        .join("");

    return `<Query>
        <Selection>
            ${selectionContent}
        </Selection>
        <Resultdef>
            ${resultdef}
        </Resultdef>
    </Query>`;
}

/**
 * Generalized Vertec XML parser
 * @param responseXml The XML string response from Vertec API
 * @param ocl The Object Class queried (e.g., "Projekt", "OffeneLeistung")
 * @param expectedFields Array of fields expected in the Resultdef
 * @returns Array of objects containing the extracted fields
 */
function parseVertecResponse(
    responseXml: string,
    ocl: string,
    expectedFields: string[]
): Record<string, any>[] {
    const parser = new XMLParser({
        ignoreAttributes: false,
        alwaysCreateTextNode: false,
    });

    const parsed = parser.parse(responseXml);

    // Navigate to the QueryResponse node
    const queryResponse = parsed?.Envelope?.Body?.QueryResponse;

    if (!queryResponse) {
        throw new Error("Invalid XML format: Missing QueryResponse");
    }

    // Dynamically access the queried OCL (e.g., Projekt, OffeneLeistung)
    const objects = queryResponse[ocl];
    if (!objects) {
        throw new Error(`Invalid XML format: Missing OCL '${ocl}'`);
    }

    // Normalize to array if only a single object is returned
    const items = Array.isArray(objects) ? objects : [objects];

    // Map and extract the expected fields for each object
    return items.map((item) => {
        const result: Record<string, any> = {};
        for (const field of expectedFields) {
            result[field] = item[field] || null; // Default to null if field is missing
        }
        return result;
    });
}

async function fetchVertecEntries() {
	const resultdef = ["datum", "projekt", "phase", "text", "wertext"];
    const queryXml = buildQueryPayload({
		objref: String(process.env.VERTEC_EMPLOYEE_ID),
		ocl: `offeneleistungen`,
		sqlwhere: `datum between '2024-12-01' and '2024-12-31'`,
        sqlorder: "bold_id",
	}, resultdef);

    try {
        const responseXml = await vertecQuery(queryXml);
        return parseVertecResponse(responseXml, "OffeneLeistung", [...resultdef, "objid"]);
    } catch (error) {
        console.error("Error querying Vertec entries:", error);
        throw error;
    }
}

async function fetchVertecProjects() {
	const resultdef = ["code"];
	const queryXml = buildQueryPayload({
		ocl: `projekt->select(code.sqlLike('%%'))->select(aktiv)`,
	}, ["code"]);

	try {
        const responseXml = await vertecQuery(queryXml);
        return parseVertecResponse(responseXml, "Projekt", [...resultdef, "objid"]);
    } catch (error) {
        console.error("Error querying Vertec projects:", error);
        throw error;
    }
}

/* async function submitToVertec(entries) {
    const response = await fetch(VERTEC_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.VERTEC_API_TOKEN}`,
        },
        body: JSON.stringify(entries),
    });
    return response.json();
} */

export {
	type VertecProject, type VertecEntry,
	fetchVertecProjects, fetchVertecEntries, /* submitToVertec */
}