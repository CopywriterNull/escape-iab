// Slack follow-up detection: which client conversations are waiting on us.
//
// Reads the shared client channels (Slack Connect / #escapehatch-<brand>) with
// a read-only user token and answers one question per channel: was the last
// human message from THEM? If so, we owe a reply, and the digest says so.
//
// Scopes required on SLACK_USER_TOKEN: channels:history, groups:history,
// channels:read, groups:read, users:read. Deliberately no DM scopes — this
// can only ever see channels, never direct messages.
//
// Everything here degrades to an empty list rather than throwing: a Slack
// outage or a revoked token must never take the daily digest down.

const SLACK_API = "https://slack.com/api";

type SlackChannel = {
  id: string;
  name: string;
  is_archived?: boolean;
  is_ext_shared?: boolean;
  is_private?: boolean;
};

type SlackMessage = {
  type: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
};

export type FollowUp = {
  channel: string;
  channelId: string;
  /** Display name of whoever spoke last, when we can resolve it. */
  lastSpeaker: string | null;
  hoursWaiting: number;
  /** First ~140 chars of their message, for context in the digest. */
  excerpt: string;
  /** Their message ended in a question mark — an explicit ask, not just chatter. */
  isQuestion: boolean;
};

async function slack<T>(
  method: string,
  token: string,
  params: Record<string, string>,
): Promise<T | null> {
  try {
    const url = `${SLACK_API}/${method}?${new URLSearchParams(params).toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok: boolean } & Record<string, unknown>;
    if (!json.ok) return null;
    return json as T;
  } catch {
    return null;
  }
}

/** Channels that represent a client relationship. Slack Connect channels are
 *  unambiguous; the #escapehatch-<brand> convention covers the rest. */
function isClientChannel(c: SlackChannel): boolean {
  if (c.is_archived) return false;
  if (c.is_ext_shared) return true;
  return /^escapehatch[-_]/i.test(c.name) && !/^escapehatch[-_]?(ops|internal|test)/i.test(c.name);
}

function cleanText(raw: string): string {
  return raw
    .replace(/<@[^>]+>/g, "")           // user mentions
    .replace(/<#[^|>]+\|([^>]*)>/g, "#$1") // channel refs
    .replace(/<([^|>]+)\|([^>]+)>/g, "$2") // named links
    .replace(/<([^>]+)>/g, "$1")        // bare links
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchFollowUps(
  token: string,
  opts: { minHoursWaiting?: number; maxChannels?: number } = {},
): Promise<FollowUp[]> {
  const minHours = opts.minHoursWaiting ?? 4;
  const maxChannels = opts.maxChannels ?? 40;

  const auth = await slack<{ team_id: string; user_id: string }>("auth.test", token, {});
  if (!auth) return [];
  const ourTeam = auth.team_id;

  const list = await slack<{ channels: SlackChannel[] }>("conversations.list", token, {
    types: "public_channel,private_channel",
    exclude_archived: "true",
    limit: "200",
  });
  if (!list) return [];

  const channels = list.channels.filter(isClientChannel).slice(0, maxChannels);
  const userCache = new Map<string, { name: string; external: boolean } | null>();

  async function resolveUser(id: string) {
    if (userCache.has(id)) return userCache.get(id)!;
    const info = await slack<{
      user: { real_name?: string; name?: string; team_id?: string; is_bot?: boolean };
    }>("users.info", token, { user: id });
    const resolved = info
      ? {
          name: info.user.real_name || info.user.name || "someone",
          // A user whose home team isn't ours is the client side of a Connect
          // channel. is_bot users never count as "them".
          external: !info.user.is_bot && !!info.user.team_id && info.user.team_id !== ourTeam,
        }
      : null;
    userCache.set(id, resolved);
    return resolved;
  }

  const now = Date.now();
  const out: FollowUp[] = [];

  for (const c of channels) {
    const hist = await slack<{ messages: SlackMessage[] }>("conversations.history", token, {
      channel: c.id,
      limit: "25",
    });
    if (!hist || hist.messages.length === 0) continue;

    // Last human message — skip joins/leaves and anything posted by an app.
    const lastHuman = hist.messages.find(
      (m) => m.type === "message" && !m.bot_id && !m.subtype && m.user,
    );
    if (!lastHuman?.user) continue;

    const speaker = await resolveUser(lastHuman.user);
    if (!speaker || !speaker.external) continue; // we spoke last → nothing owed

    const hoursWaiting = (now - Number(lastHuman.ts) * 1000) / 3600_000;
    if (hoursWaiting < minHours) continue; // give ourselves a working window

    const text = cleanText(lastHuman.text ?? "");
    out.push({
      channel: c.name,
      channelId: c.id,
      lastSpeaker: speaker.name,
      hoursWaiting,
      excerpt: text.length > 140 ? `${text.slice(0, 140)}…` : text,
      isQuestion: /\?\s*$/.test(text) || /\?/.test(text),
    });
  }

  return out.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
}

export function formatWaiting(hours: number): string {
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
