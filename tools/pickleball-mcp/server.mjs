#!/usr/bin/env node
/**
 * Pickleball system — MCP server.
 *
 * Exposes the court-booking API (courts, bookings, overrides, settings) as MCP
 * tools. Authenticates with a long-lived `pickleball-…` API key rather than a
 * JWT: `ApiAuthGuard` routes on that prefix, and the key carries the role of the
 * admin who minted it, so these tools are exactly as privileged as that account.
 *
 * Mint a key from the admin console, or:
 *   POST /api/api-keys  { "name": "mcp" }   (JWT auth — a key cannot mint keys)
 * The raw value is shown once.
 *
 * Env:
 *   PICKLEBALL_API_BASE_URL  (default http://localhost:3001/api)
 *   PICKLEBALL_API_KEY       (required, starts with `pickleball-`)
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BASE = (
  process.env.PICKLEBALL_API_BASE_URL || 'http://localhost:3001/api'
).replace(/\/$/, '');
const API_KEY = process.env.PICKLEBALL_API_KEY;
const KEY_PREFIX = 'pickleball-';

function requireKey() {
  if (!API_KEY) {
    throw new Error(
      'PICKLEBALL_API_KEY is not set. Mint one as an admin (POST /api-keys) and ' +
        'put it in the MCP server env.',
    );
  }
  if (!API_KEY.startsWith(KEY_PREFIX)) {
    throw new Error(
      `PICKLEBALL_API_KEY does not start with "${KEY_PREFIX}" — it will be treated ` +
        'as a JWT and rejected. Check you copied the whole key.',
    );
  }
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  requireKey();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // Almost always "the API isn't running", which reads as an auth failure if
    // we let the raw fetch error through.
    throw new Error(
      `Could not reach the API at ${BASE} (${err.message}). Is it running?`,
    );
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    // HttpExceptionFilter flattens the body to a string | string[] under `message`.
    const msg = json && json.message ? json.message : `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join('; ') : String(msg));
  }
  return json;
}

// Strip undefined so a PATCH only carries the fields the caller actually passed —
// the global ValidationPipe runs with forbidNonWhitelisted, and an explicit
// undefined would otherwise serialise away silently anyway.
const defined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// ---- shared schema fragments ----
const slotItems = {
  type: 'array',
  description:
    'Slots to book. Each is one court-hour: {courtId, date (YYYY-MM-DD), hour (0-23)}.',
  items: {
    type: 'object',
    properties: {
      courtId: { type: 'string' },
      date: { type: 'string', description: 'YYYY-MM-DD' },
      hour: { type: 'integer', minimum: 0, maximum: 23 },
    },
    required: ['courtId', 'date', 'hour'],
  },
};

const contact = {
  type: 'object',
  description: 'Who to contact about the booking.',
  properties: {
    name: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string' },
  },
  required: ['name', 'phone'],
};

const idOnly = (what) => ({
  type: 'object',
  properties: { id: { type: 'string', description: `${what} id (uuid)` } },
  required: ['id'],
});

const withReason = (what) => ({
  type: 'object',
  properties: {
    id: { type: 'string', description: `${what} id (uuid)` },
    reason: { type: 'string' },
  },
  required: ['id'],
});

const TOOLS = [
  // --- read ---
  {
    name: 'pickleball_list_courts',
    description: 'List all courts with their rates and status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pickleball_list_bookings',
    description:
      'List every booking with its slots, customer and payment state. Admin/staff.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pickleball_availability',
    description:
      'Occupied court-hours. A slot counts as taken for hold, pending_approval, ' +
      'confirmed and checked_in — holds are partial blocks that expire after 10 minutes.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pickleball_list_customers',
    description: 'List customers with their total spend. Admin/staff.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pickleball_get_settings',
    description:
      'Facility settings: branding, opening hours, peak hours, accepted payment methods.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pickleball_list_overrides',
    description: 'List blackouts / closures (maintenance, holidays, private events).',
    inputSchema: { type: 'object', properties: {} },
  },

  // --- courts ---
  {
    name: 'pickleball_create_court',
    description: 'Add a court. Rates are whole currency units per hour. Admin only.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        surface: { type: 'string', description: 'e.g. hardcourt' },
        peakRate: { type: 'integer', minimum: 0 },
        offPeakRate: { type: 'integer', minimum: 0 },
      },
      required: ['name', 'surface', 'peakRate', 'offPeakRate'],
    },
  },
  {
    name: 'pickleball_update_court',
    description:
      'Update a court. Pass only the fields to change. Changing rates does NOT ' +
      'reprice existing bookings or holds — those froze their rate at booking time.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        surface: { type: 'string' },
        peakRate: { type: 'integer', minimum: 0 },
        offPeakRate: { type: 'integer', minimum: 0 },
        status: { type: 'string', enum: ['active', 'maintenance'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'pickleball_toggle_court_maintenance',
    description: 'Flip a court between active and maintenance. Admin/staff.',
    inputSchema: idOnly('Court'),
  },

  // --- bookings ---
  {
    name: 'pickleball_create_booking',
    description:
      'Front-desk booking for a walk-in or phone customer. Money is taken at the ' +
      'counter, so this creates a CONFIRMED booking immediately — no hold, no ' +
      'approval step. Fails with 409 if any slot is taken, 400 if outside opening hours.',
    inputSchema: {
      type: 'object',
      properties: {
        items: slotItems,
        contact,
        customerId: {
          type: 'string',
          description: 'Existing customer uuid. Omit for a walk-in with no account.',
        },
        paymentMethod: {
          type: 'string',
          description:
            'Must be one of the facility’s accepted methods (see pickleball_get_settings).',
        },
        referenceNumber: {
          type: 'string',
          description: 'Required for every method except Cash.',
        },
      },
      required: ['items', 'contact', 'paymentMethod'],
    },
  },
  {
    name: 'pickleball_approve_booking',
    description:
      'Approve a pending payment. Both fields are required — approving asserts the ' +
      'money arrived. The receipt image is deleted from storage on approval; the ' +
      'method + reference become the record.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        paymentMethod: { type: 'string' },
        referenceNumber: { type: 'string' },
      },
      required: ['id', 'paymentMethod', 'referenceNumber'],
    },
  },
  {
    name: 'pickleball_reject_booking',
    description:
      'Reject a pending payment and reopen the slot. Also deletes the receipt image.',
    inputSchema: withReason('Booking'),
  },
  {
    name: 'pickleball_cancel_booking',
    description: 'Cancel a booking and reopen its slots.',
    inputSchema: withReason('Booking'),
  },
  {
    name: 'pickleball_check_in_booking',
    description: 'Mark a confirmed booking as checked in.',
    inputSchema: idOnly('Booking'),
  },
  {
    name: 'pickleball_complete_booking',
    description: 'Mark a checked-in booking as completed.',
    inputSchema: idOnly('Booking'),
  },
  {
    name: 'pickleball_no_show_booking',
    description: 'Mark a confirmed booking as a no-show.',
    inputSchema: idOnly('Booking'),
  },
  {
    name: 'pickleball_acknowledge_booking',
    description: 'Clear the "needs attention" flag on a booking.',
    inputSchema: idOnly('Booking'),
  },

  // --- overrides ---
  {
    name: 'pickleball_create_override',
    description:
      'Block out time. scope "date" closes the whole day, "hours" needs ' +
      'startHour/endHour, "week" closes the week starting at `date`. courtId "all" ' +
      'blocks every court.',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        reason: {
          type: 'string',
          enum: ['maintenance', 'holiday', 'private_event', 'other'],
        },
        courtId: { type: 'string', description: '"all" or a court uuid' },
        scope: { type: 'string', enum: ['date', 'hours', 'week'] },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        startHour: { type: 'integer', minimum: 0, maximum: 23 },
        endHour: { type: 'integer', minimum: 0, maximum: 24 },
      },
      required: ['label', 'reason', 'courtId', 'scope', 'date'],
    },
  },
  {
    name: 'pickleball_delete_override',
    description: 'Remove a blackout.',
    inputSchema: idOnly('Override'),
  },

  // --- settings ---
  {
    name: 'pickleball_update_settings',
    description:
      'Update facility settings. Pass only the fields to change. `paymentMethods` ' +
      'is replaced wholesale, not merged — send the full list. Changing peak hours ' +
      'reprices unbooked slots only.',
    inputSchema: {
      type: 'object',
      properties: {
        appName: { type: 'string' },
        primary: { type: 'string', description: 'Hex colour, e.g. #16a34a' },
        secondary: { type: 'string' },
        fontFamily: {
          type: 'string',
          enum: ['space-grotesk', 'inter', 'poppins', 'dm-sans', 'outfit', 'system'],
        },
        openHour: { type: 'integer', minimum: 0, maximum: 23 },
        closeHour: {
          type: 'integer',
          minimum: 1,
          maximum: 24,
          description: 'Exclusive — the last bookable slot starts at closeHour - 1.',
        },
        peakHoursWeekday: { type: 'array', items: { type: 'integer' } },
        peakHoursWeekend: { type: 'array', items: { type: 'integer' } },
        paymentMethods: {
          type: 'array',
          items: { type: 'string' },
          description: 'Full replacement list, e.g. ["Cash", "GCash", "Maya"].',
        },
      },
    },
  },
];

async function handleTool(name, a = {}) {
  switch (name) {
    // read
    case 'pickleball_list_courts':
      return apiFetch('/courts');
    case 'pickleball_list_bookings':
      return apiFetch('/bookings');
    case 'pickleball_availability':
      return apiFetch('/bookings/availability');
    case 'pickleball_list_customers':
      return apiFetch('/customers');
    case 'pickleball_get_settings':
      return apiFetch('/settings');
    case 'pickleball_list_overrides':
      return apiFetch('/overrides');

    // courts
    case 'pickleball_create_court':
      return apiFetch('/courts', { method: 'POST', body: a });
    case 'pickleball_update_court': {
      const { id, ...rest } = a;
      return apiFetch(`/courts/${id}`, { method: 'PATCH', body: defined(rest) });
    }
    case 'pickleball_toggle_court_maintenance':
      return apiFetch(`/courts/${a.id}/toggle-maintenance`, { method: 'POST' });

    // bookings
    case 'pickleball_create_booking':
      return apiFetch('/bookings/admin-create', {
        method: 'POST',
        body: defined(a),
      });
    case 'pickleball_approve_booking':
      return apiFetch(`/bookings/${a.id}/approve`, {
        method: 'POST',
        body: {
          paymentMethod: a.paymentMethod,
          referenceNumber: a.referenceNumber,
        },
      });
    case 'pickleball_reject_booking':
      return apiFetch(`/bookings/${a.id}/reject`, {
        method: 'POST',
        body: defined({ reason: a.reason }),
      });
    case 'pickleball_cancel_booking':
      return apiFetch(`/bookings/${a.id}/cancel`, {
        method: 'POST',
        body: defined({ reason: a.reason }),
      });
    case 'pickleball_check_in_booking':
      return apiFetch(`/bookings/${a.id}/check-in`, { method: 'POST' });
    case 'pickleball_complete_booking':
      return apiFetch(`/bookings/${a.id}/complete`, { method: 'POST' });
    case 'pickleball_no_show_booking':
      return apiFetch(`/bookings/${a.id}/no-show`, { method: 'POST' });
    case 'pickleball_acknowledge_booking':
      return apiFetch(`/bookings/${a.id}/acknowledge`, { method: 'POST' });

    // overrides
    case 'pickleball_create_override':
      return apiFetch('/overrides', { method: 'POST', body: defined(a) });
    case 'pickleball_delete_override':
      return apiFetch(`/overrides/${a.id}`, { method: 'DELETE' });

    // settings
    case 'pickleball_update_settings':
      return apiFetch('/settings', { method: 'PATCH', body: defined(a) });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: 'pickleball', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const result = await handleTool(name, args || {});
    return {
      content: [
        { type: 'text', text: JSON.stringify(result ?? { ok: true }, null, 2) },
      ],
    };
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`pickleball MCP server ready (API: ${BASE})`);
